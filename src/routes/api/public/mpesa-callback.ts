import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendSMS } from "@/lib/notify.server";

// Safaricom Daraja STK callback. Receives async payment result and updates the booking.
// Docs: https://developer.safaricom.co.ke/Documentation
export const Route = createFileRoute("/api/public/mpesa-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }

        const stk = payload?.Body?.stkCallback;
        if (!stk) {
          // Always 200 OK to Safaricom to avoid retries on malformed events
          return Response.json({ ResultCode: 0, ResultDesc: "Ignored" });
        }

        const checkoutId: string = stk.CheckoutRequestID;
        const resultCode: number = stk.ResultCode;
        const items: Array<{ Name: string; Value?: string | number }> =
          stk.CallbackMetadata?.Item ?? [];
        const get = (name: string) => items.find((i) => i.Name === name)?.Value;

        const mpesaReceipt = get("MpesaReceiptNumber") as string | undefined;
        const amount = get("Amount") as number | undefined;

        // Match booking by checkoutRequestId we stored in `otp` at initiation
        const { data: booking } = await supabaseAdmin
          .from("bookings")
          .select("id, tracking_number, pickup_contact_phone, dropoff_contact_phone")
          .eq("otp", checkoutId)
          .maybeSingle();

        if (!booking) {
          console.warn("[mpesa-callback] no booking for checkoutId", checkoutId);
          return Response.json({ ResultCode: 0, ResultDesc: "OK" });
        }

        const paid = resultCode === 0;
        await supabaseAdmin
          .from("bookings")
          .update({
            payment_status: paid ? "paid" : "failed",
            status: paid ? "confirmed" : "pending",
            otp: null,
            special_instructions: mpesaReceipt
              ? `M-Pesa: ${mpesaReceipt} (KSh ${amount ?? "?"})`
              : undefined,
          })
          .eq("id", booking.id);

        await supabaseAdmin.from("booking_events").insert({
          booking_id: booking.id,
          status: paid ? "payment_received" : "payment_failed",
          note: paid
            ? `Payment received via M-Pesa (${mpesaReceipt})`
            : `Payment failed: ${stk.ResultDesc}`,
        });

        if (paid) {
          const recipients = [booking.pickup_contact_phone, booking.dropoff_contact_phone].filter(
            (p): p is string => !!p && p.length >= 9
          );
          if (recipients.length) {
            try {
              await sendSMS(
                recipients,
                `SwiftLink: Payment received for ${booking.tracking_number}. Track at https://swiftlink.lovable.app/track/${booking.tracking_number}`
              );
            } catch (e) {
              console.error("[mpesa-callback] SMS failed", e);
            }
          }
        }

        return Response.json({ ResultCode: 0, ResultDesc: "OK" });
      },
    },
  },
});
