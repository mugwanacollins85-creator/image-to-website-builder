import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stkPush } from "./mpesa.server";
import { sendSMS, buildBookingSms, type BookingEvent } from "./notify.server";

const PHONE_RE = /^\+?\d{9,15}$/;

const StkInput = z.object({
  bookingId: z.string().uuid(),
  phone: z.string().regex(PHONE_RE, "Invalid phone number"),
});

/**
 * Initiate (or retry) an M-Pesa STK push for a booking.
 * - Rejects if booking already paid (prevents duplicate charges).
 * - Throttles: at most one push every 30s while previous request is processing.
 */
export const initiateMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StkInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        "id, tracking_number, total_price, customer_id, payment_status, last_payment_attempt_at, payment_attempts"
      )
      .eq("id", data.bookingId)
      .single();
    if (error || !booking) throw new Error("Booking not found");
    if (booking.customer_id !== userId) throw new Error("Not your booking");

    if (booking.payment_status === "paid") {
      return { alreadyPaid: true as const };
    }

    // Throttle retries while Safaricom is still processing the previous attempt
    if (booking.payment_status === "processing" && booking.last_payment_attempt_at) {
      const sinceMs = Date.now() - new Date(booking.last_payment_attempt_at).getTime();
      if (sinceMs < 30_000) {
        throw new Error(
          `A payment request is still pending. Please wait ${Math.ceil(
            (30_000 - sinceMs) / 1000
          )}s before retrying.`
        );
      }
    }

    const origin = getRequest().headers.get("origin") ?? "https://swiftlink.lovable.app";
    const callbackUrl = `${origin}/api/public/mpesa-callback`;

    const result = await stkPush({
      phone: data.phone,
      amount: Number(booking.total_price),
      accountReference: booking.tracking_number,
      description: `SwiftLink ${booking.tracking_number}`,
      callbackUrl,
    });

    await supabaseAdmin
      .from("bookings")
      .update({
        payment_method: "mpesa",
        payment_status: "processing",
        mpesa_checkout_id: result.checkoutRequestId,
        last_payment_attempt_at: new Date().toISOString(),
        payment_attempts: (booking.payment_attempts ?? 0) + 1,
      })
      .eq("id", booking.id);

    await supabaseAdmin.from("booking_events").insert({
      booking_id: booking.id,
      status: "payment_pending",
      note:
        (booking.payment_attempts ?? 0) > 0
          ? `STK push retried (attempt ${(booking.payment_attempts ?? 0) + 1})`
          : "STK push sent to phone",
    });

    return {
      ok: true as const,
      checkoutRequestId: result.checkoutRequestId,
      customerMessage: result.customerMessage,
      attempt: (booking.payment_attempts ?? 0) + 1,
    };
  });

const SmsEventEnum = z.enum([
  "confirmed",
  "payment_failed",
  "rider_assigned",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "failed_delivery",
]);

const SmsInput = z.object({
  bookingId: z.string().uuid(),
  event: SmsEventEnum,
});

async function loadBookingForSms(supabase: any, bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, tracking_number, pickup_address, dropoff_address, vehicle_type, total_price, mpesa_receipt, pickup_contact_phone, dropoff_contact_phone, rider_id"
    )
    .eq("id", bookingId)
    .single();
  if (error || !data) throw new Error("Booking not found");

  let rider: { full_name: string; phone: string } | null = null;
  if (data.rider_id) {
    const { data: r } = await supabase
      .from("riders")
      .select("full_name, phone")
      .eq("id", data.rider_id)
      .maybeSingle();
    rider = r ?? null;
  }
  return { ...data, rider_name: rider?.full_name ?? null, rider_phone: rider?.phone ?? null };
}

/** Send the templated SMS for a booking milestone to pickup + dropoff contacts. */
export const sendBookingSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SmsInput.parse(input))
  .handler(async ({ data, context }) => {
    const b = await loadBookingForSms(context.supabase, data.bookingId);
    const text = buildBookingSms(data.event as BookingEvent, b);

    const recipients = [b.pickup_contact_phone, b.dropoff_contact_phone].filter(
      (p): p is string => !!p && p.length >= 9
    );
    if (recipients.length === 0) return { skipped: true as const, reason: "no_recipients" };

    await sendSMS(recipients, text);
    await supabaseAdmin.from("booking_events").insert({
      booking_id: b.id,
      status: `sms_${data.event}`,
      note: `SMS sent to ${recipients.length} recipient(s)`,
    });
    return { ok: true as const, sent: recipients.length };
  });
