import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stkPush } from "./mpesa.server";
import { sendSMS } from "./notify.server";

const StkInput = z.object({
  bookingId: z.string().uuid(),
  phone: z.string().min(9).max(20),
});

export const initiateMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StkInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, tracking_number, total_price, customer_id, payment_status")
      .eq("id", data.bookingId)
      .single();
    if (error || !booking) throw new Error("Booking not found");
    if (booking.customer_id !== userId) throw new Error("Not your booking");
    if (booking.payment_status === "paid") {
      return { alreadyPaid: true };
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
        otp: result.checkoutRequestId, // temp store of checkout id; replaced on delivery
      })
      .eq("id", booking.id);

    return {
      ok: true,
      checkoutRequestId: result.checkoutRequestId,
      customerMessage: result.customerMessage,
    };
  });

const SmsInput = z.object({
  bookingId: z.string().uuid(),
  event: z.enum(["confirmed", "rider_assigned", "picked_up", "out_for_delivery", "delivered"]),
});

export const sendBookingSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SmsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: b, error } = await context.supabase
      .from("bookings")
      .select("tracking_number, pickup_contact_phone, dropoff_contact_phone")
      .eq("id", data.bookingId)
      .single();
    if (error || !b) throw new Error("Booking not found");

    const msgs: Record<typeof data.event, string> = {
      confirmed: `SwiftLink: Booking ${b.tracking_number} confirmed. Track at https://swiftlink.lovable.app/track/${b.tracking_number}`,
      rider_assigned: `SwiftLink: A rider is on the way for ${b.tracking_number}.`,
      picked_up: `SwiftLink: Parcel ${b.tracking_number} picked up. Out for delivery soon.`,
      out_for_delivery: `SwiftLink: Parcel ${b.tracking_number} is out for delivery.`,
      delivered: `SwiftLink: Parcel ${b.tracking_number} delivered. Thank you!`,
    };
    const text = msgs[data.event];

    const recipients = [b.pickup_contact_phone, b.dropoff_contact_phone].filter(
      (p): p is string => !!p && p.length >= 9
    );
    if (recipients.length === 0) return { skipped: true };

    await sendSMS(recipients, text);
    return { ok: true, sent: recipients.length };
  });
