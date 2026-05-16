// Server-only helpers for Africa's Talking SMS.
// Docs: https://developers.africastalking.com/docs/sms/sending/bulk

function normalizeKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `+254${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

export async function sendSMS(to: string | string[], message: string) {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const from = process.env.AFRICASTALKING_SENDER_ID; // optional shortcode/alphanumeric
  if (!username || !apiKey) {
    console.warn("[SMS] Africa's Talking credentials missing — skipping send");
    return { skipped: true };
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map(normalizeKenyanPhone)
    .join(",");
  if (!recipients) return { skipped: true };

  const isSandbox = username === "sandbox";
  const url = isSandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const body = new URLSearchParams({ username, to: recipients, message });
  if (from) body.set("from", from);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[SMS] failed ${res.status}: ${text}`);
    throw new Error(`SMS provider error: ${res.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const APP_ORIGIN = "https://swiftlink.lovable.app";
const trackUrl = (t: string) => `${APP_ORIGIN}/track/${t}`;

export type BookingEvent =
  | "confirmed"
  | "payment_failed"
  | "rider_assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery";

interface BookingForSms {
  tracking_number: string;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  vehicle_type?: string | null;
  total_price?: number | string | null;
  mpesa_receipt?: string | null;
  rider_name?: string | null;
  rider_phone?: string | null;
}

/** Returns the SMS body for a given milestone, including the tracking link. */
export function buildBookingSms(event: BookingEvent, b: BookingForSms): string {
  const t = b.tracking_number;
  const link = trackUrl(t);
  switch (event) {
    case "confirmed":
      return [
        `SwiftLink: Booking ${t} confirmed.`,
        b.pickup_address && b.dropoff_address
          ? `${b.pickup_address} → ${b.dropoff_address}.`
          : null,
        b.total_price ? `Total KSh ${Number(b.total_price).toLocaleString()}.` : null,
        b.mpesa_receipt ? `M-Pesa: ${b.mpesa_receipt}.` : null,
        `Track: ${link}`,
      ]
        .filter(Boolean)
        .join(" ");
    case "payment_failed":
      return `SwiftLink: Payment failed for ${t}. Open the app to retry your M-Pesa payment. ${link}`;
    case "rider_assigned":
      return `SwiftLink: A rider is on the way for ${t}${
        b.rider_name ? ` (${b.rider_name}${b.rider_phone ? `, ${b.rider_phone}` : ""})` : ""
      }. Live tracking: ${link}`;
    case "picked_up":
      return `SwiftLink: Parcel ${t} picked up. Out for delivery soon. ${link}`;
    case "out_for_delivery":
      return `SwiftLink: Parcel ${t} is out for delivery. ${link}`;
    case "delivered":
      return `SwiftLink: Parcel ${t} delivered. Thank you for choosing SwiftLink! Receipt: ${link}`;
    case "failed_delivery":
      return `SwiftLink: Delivery attempt for ${t} was unsuccessful. We will retry. Details: ${link}`;
  }
}
