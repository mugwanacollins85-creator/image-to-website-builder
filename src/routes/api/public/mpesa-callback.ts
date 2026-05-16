import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildBookingSms, sendSMS } from "@/lib/notify.server";

// Safaricom Daraja STK callback. Receives async payment result and updates the booking.
// Docs: https://developer.safaricom.co.ke/Documentation
//
// Security:
// - Safaricom does NOT sign STK callback payloads, so we defend with:
//   1. Strict Zod schema validation on the payload shape.
//   2. Idempotency keyed on CheckoutRequestID — replays cannot double-apply.
//   3. We only act when the CheckoutRequestID matches a booking row we put in
//      "processing" state. Unknown IDs are acknowledged but ignored.
//   4. Optional shared-secret query param (MPESA_CALLBACK_SECRET) so only our
//      registered callback URL is accepted in production.

const ItemSchema = z.object({
  Name: z.string(),
  Value: z.union([z.string(), z.number()]).optional(),
});

const StkCallbackSchema = z.object({
  Body: z.object({
    stkCallback: z.object({
      MerchantRequestID: z.string(),
      CheckoutRequestID: z.string().min(1),
      ResultCode: z.number().int(),
      ResultDesc: z.string(),
      CallbackMetadata: z
        .object({ Item: z.array(ItemSchema).default([]) })
        .optional(),
    }),
  }),
});

export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Optional shared-secret check on the callback URL.
        const expectedSecret = process.env.MPESA_CALLBACK_SECRET;
        if (expectedSecret) {
          const url = new URL(request.url);
          if (url.searchParams.get("k") !== expectedSecret) {
            console.warn("[mpesa-callback] rejected: missing/invalid shared secret");
            return new Response("Forbidden", { status: 403 });
          }
        }

        // 2. Schema-validate the payload before acting on anything.
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const parsed = StkCallbackSchema.safeParse(raw);
        if (!parsed.success) {
          console.warn("[mpesa-callback] rejected: invalid payload", parsed.error.flatten());
          // Always 200 to avoid Safaricom retry storms on garbage payloads.
          return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        }

        const stk = parsed.data.Body.stkCallback;
        const checkoutId = stk.CheckoutRequestID;
        const resultCode = stk.ResultCode;
        const items = stk.CallbackMetadata?.Item ?? [];
        const get = (name: string) => items.find((i) => i.Name === name)?.Value;
        const mpesaReceipt = typeof get("MpesaReceiptNumber") === "string"
          ? (get("MpesaReceiptNumber") as string)
          : undefined;
        const amount = typeof get("Amount") === "number" ? (get("Amount") as number) : undefined;

        // 3. Find the booking we were waiting on. Unknown IDs → ignore.
        const { data: booking } = await supabaseAdmin
          .from("bookings")
          .select(
            "id, tracking_number, pickup_address, dropoff_address, vehicle_type, total_price, payment_status, pickup_contact_phone, dropoff_contact_phone"
          )
          .eq("mpesa_checkout_id", checkoutId)
          .maybeSingle();

        if (!booking) {
          console.warn("[mpesa-callback] no booking for checkoutId", checkoutId);
          return Response.json({ ResultCode: 0, ResultDesc: "OK" });
        }

        // 4. Idempotency: if already settled, just acknowledge.
        if (booking.payment_status === "paid" || booking.payment_status === "failed") {
          return Response.json({ ResultCode: 0, ResultDesc: "AlreadyProcessed" });
        }

        const paid = resultCode === 0;

        await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: paid ? "paid" : "failed",
            status: paid ? "confirmed" : "pending",
            mpesa_checkout_id: null,
            mpesa_receipt: paid && mpesaReceipt ? mpesaReceipt : null,
          })
          .eq("id", booking.id);

        await supabaseAdmin.from("booking_events").insert({
          booking_id: booking.id,
          status: paid ? "payment_received" : "payment_failed",
          note: paid
            ? `Payment received via M-Pesa (${mpesaReceipt ?? "no receipt"}, KSh ${amount ?? "?"})`
            : `Payment failed: ${stk.ResultDesc}`,
        });

        // 5. Send milestone SMS.
        const recipients = [booking.pickup_contact_phone, booking.dropoff_contact_phone].filter(
          (p): p is string => !!p && p.length >= 9
        );
        if (recipients.length) {
          try {
            const text = buildBookingSms(paid ? "confirmed" : "payment_failed", {
              ...booking,
              mpesa_receipt: paid ? mpesaReceipt ?? null : null,
            });
            await sendSMS(recipients, text);
          } catch (e) {
            console.error("[mpesa-callback] SMS failed", e);
          }
        }

        return Response.json({ ResultCode: 0, ResultDesc: "OK" });
      },
    },
  },
});
