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
