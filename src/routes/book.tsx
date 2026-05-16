import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { initiateMpesaPayment, sendBookingSms } from "@/lib/payments.functions";
import { quote, haversineKm, generateTrackingNumber, generateOTP, VEHICLES, type Vehicle, type Urgency } from "@/lib/pricing";
import logo from "@/assets/logo.png";
import { ArrowLeft, ArrowRight, CheckCircle2, MapPin, Package as PkgIcon, Bike, Truck, Zap, Shield, Bell, Smartphone, Copy } from "lucide-react";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [{ title: "Book a Delivery · SwiftLink" }] }),
  component: BookPage,
});

const SERVICES = [
  { id: "parcel", label: "Parcel Delivery", icon: PkgIcon },
  { id: "document", label: "Document Courier", icon: PkgIcon },
  { id: "food", label: "Food & Groceries", icon: PkgIcon },
  { id: "furniture", label: "Furniture & Large", icon: Truck },
  { id: "electronics", label: "Electronics", icon: PkgIcon },
  { id: "business", label: "Business Bulk", icon: Truck },
];

// Approximate Nairobi-area locations for demo geocoding
const KNOWN_PLACES: Record<string, { lat: number; lng: number }> = {
  "nairobi cbd": { lat: -1.2864, lng: 36.8172 },
  "westlands": { lat: -1.2676, lng: 36.8108 },
  "karen": { lat: -1.3197, lng: 36.7076 },
  "kilimani": { lat: -1.2906, lng: 36.7826 },
  "kasarani": { lat: -1.2167, lng: 36.8967 },
  "thika": { lat: -1.0333, lng: 37.0833 },
  "kiambu": { lat: -1.1714, lng: 36.8356 },
  "ruiru": { lat: -1.1456, lng: 36.9636 },
  "embakasi": { lat: -1.3236, lng: 36.8947 },
  "ngong": { lat: -1.3667, lng: 36.6500 },
  "mombasa": { lat: -4.0435, lng: 39.6682 },
  "kisumu": { lat: -0.0917, lng: 34.7680 },
};

function geocodeFallback(addr: string): { lat: number; lng: number } {
  const k = addr.trim().toLowerCase();
  for (const [name, c] of Object.entries(KNOWN_PLACES)) {
    if (k.includes(name)) return c;
  }
  // hash-based fallback around Nairobi
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) | 0;
  return { lat: -1.286 + ((h % 100) - 50) / 1000, lng: 36.817 + (((h >> 8) % 100) - 50) / 1000 };
}

type Step = 1 | 2 | 3 | 4 | 5;

function BookPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const initiateMpesa = useServerFn(initiateMpesaPayment);
  const sendSms = useServerFn(sendBookingSms);
  const [step, setStep] = useState<Step>(1);

  const [service, setService] = useState("parcel");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [pickupContactName, setPickupContactName] = useState("");
  const [pickupContactPhone, setPickupContactPhone] = useState("");
  const [dropoffContactName, setDropoffContactName] = useState("");
  const [dropoffContactPhone, setDropoffContactPhone] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgWeight, setPkgWeight] = useState("");
  const [fragile, setFragile] = useState(false);
  const [instructions, setInstructions] = useState("");

  const [vehicle, setVehicle] = useState<Vehicle>("motorbike");
  const [urgency, setUrgency] = useState<Urgency>("standard");
  const [insurance, setInsurance] = useState(false);
  const [priority, setPriority] = useState(false);
  const [smsRecipient, setSmsRecipient] = useState(false);
  const [promo, setPromo] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card" | "wallet" | "cod">("mpesa");
  const [mpesaPhone, setMpesaPhone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ tracking: string; id: string } | null>(null);
  const [err, setErr] = useState("");

  const distance = useMemo(() => {
    if (!pickup || !dropoff) return 0;
    return Math.round(haversineKm(geocodeFallback(pickup), geocodeFallback(dropoff)) * 10) / 10;
  }, [pickup, dropoff]);

  const promoDiscount = promo.toUpperCase() === "FIRST10" ? 0.1 : promo.toUpperCase() === "SWIFT20" ? 0.2 : 0;
  const q = useMemo(() => quote({ vehicle, distanceKm: distance, urgency, insurance, priority, smsRecipient, promoDiscount }),
    [vehicle, distance, urgency, insurance, priority, smsRecipient, promoDiscount]);

  async function submitBooking() {
    if (!user) { nav({ to: "/auth" }); return; }
    setSubmitting(true); setErr("");
    try {
      const tracking = generateTrackingNumber();
      const pickupCoord = geocodeFallback(pickup);
      const dropoffCoord = geocodeFallback(dropoff);
      const { data, error } = await supabase.from("bookings").insert({
        tracking_number: tracking,
        customer_id: user.id,
        service_type: service,
        vehicle_type: vehicle,
        urgency,
        pickup_address: pickup,
        pickup_lat: pickupCoord.lat, pickup_lng: pickupCoord.lng,
        pickup_contact_name: pickupContactName, pickup_contact_phone: pickupContactPhone,
        dropoff_address: dropoff,
        dropoff_lat: dropoffCoord.lat, dropoff_lng: dropoffCoord.lng,
        dropoff_contact_name: dropoffContactName, dropoff_contact_phone: dropoffContactPhone,
        package_description: pkgDesc,
        package_weight_kg: pkgWeight ? Number(pkgWeight) : null,
        fragile,
        special_instructions: instructions,
        distance_km: distance,
        base_price: q.base,
        distance_price: q.distance,
        urgency_multiplier: q.urgencyMultiplier,
        total_price: q.total,
        status: "pending",
        payment_method: paymentMethod,
        payment_status: paymentMethod === "cod" ? "pending" : "paid", // demo: simulate immediate confirm for non-COD
        otp: generateOTP(),
      }).select("id, tracking_number").single();
      if (error) throw error;
      await supabase.from("booking_events").insert({
        booking_id: data.id, status: "pending", note: "Order placed",
      });
      setConfirmed({ tracking: data.tracking_number, id: data.id });
      setStep(5);
    } catch (e: any) {
      setErr(e.message ?? "Could not create booking");
    } finally { setSubmitting(false); }
  }

  const canNext1 = !!service;
  const canNext2 = pickup.length > 2 && dropoff.length > 2 && distance > 0;
  const canNext3 = !!vehicle;
  const canPay = paymentMethod !== "mpesa" || mpesaPhone.length >= 10;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SwiftLink" className="h-8 w-8" />
            <span className="font-bold">SwiftLink</span>
          </Link>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">My bookings</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 text-xs">
          {(["Service", "Details", "Pricing", "Payment", "Done"] as const).map((label, i) => {
            const n = (i + 1) as Step;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-semibold ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                </div>
                <div className={`hidden sm:block ${active ? "font-semibold" : "text-muted-foreground"}`}>{label}</div>
                {i < 4 && <div className="h-px flex-1 bg-border" />}
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-6">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-1">What are you sending?</h2>
              <p className="text-sm text-muted-foreground mb-6">Pick the service that matches your delivery.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SERVICES.map((s) => (
                  <button key={s.id} onClick={() => setService(s.id)}
                    className={`p-4 rounded-xl border text-left transition ${service === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                    <s.icon className="h-6 w-6 mb-2 text-primary" />
                    <div className="font-medium">{s.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-1">Pickup & drop-off</h2>
              <p className="text-sm text-muted-foreground mb-6">Type a place name (e.g. "Westlands", "Karen", "Mombasa").</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Field icon={MapPin} label="Pickup address" value={pickup} onChange={setPickup} placeholder="e.g. Westlands, Nairobi" />
                  <Field label="Pickup contact name" value={pickupContactName} onChange={setPickupContactName} placeholder="Optional" />
                  <Field label="Pickup phone" value={pickupContactPhone} onChange={setPickupContactPhone} placeholder="+254…" />
                </div>
                <div className="space-y-3">
                  <Field icon={MapPin} label="Drop-off address" value={dropoff} onChange={setDropoff} placeholder="e.g. CBD, Nairobi" />
                  <Field label="Recipient name" value={dropoffContactName} onChange={setDropoffContactName} placeholder="Optional" />
                  <Field label="Recipient phone" value={dropoffContactPhone} onChange={setDropoffContactPhone} placeholder="+254…" />
                </div>
              </div>
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                <Field label="Package description" value={pkgDesc} onChange={setPkgDesc} placeholder="e.g. Box of clothes" />
                <Field label="Weight (kg)" value={pkgWeight} onChange={setPkgWeight} placeholder="Optional" type="number" />
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium">Special instructions</label>
                <textarea className="mt-1 w-full p-3 rounded-md border bg-background" rows={3}
                  value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Gate code, floor number, etc." />
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={fragile} onChange={(e) => setFragile(e.target.checked)} />
                Fragile / handle with care
              </label>
              {distance > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                  Estimated distance: <span className="font-semibold">{distance} km</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-1">Vehicle & pricing</h2>
              <p className="text-sm text-muted-foreground mb-6">Choose how your package travels.</p>
              <div className="grid md:grid-cols-3 gap-3">
                {(Object.keys(VEHICLES) as Vehicle[]).map((v) => {
                  const info = VEHICLES[v];
                  const p = quote({ vehicle: v, distanceKm: distance, urgency });
                  return (
                    <button key={v} onClick={() => setVehicle(v)}
                      className={`p-4 rounded-xl border text-left transition ${vehicle === v ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                      {v === "motorbike" ? <Bike className="h-6 w-6 mb-2 text-primary" /> : <Truck className="h-6 w-6 mb-2 text-primary" />}
                      <div className="font-semibold">{info.label}</div>
                      <div className="text-xs text-muted-foreground">{info.capacity}</div>
                      <div className="mt-2 text-lg font-bold">KSh {p.total.toLocaleString()}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-2">Urgency</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["standard", "express"] as Urgency[]).map((u) => (
                      <button key={u} onClick={() => setUrgency(u)}
                        className={`p-3 rounded-lg border text-sm ${urgency === u ? "border-primary bg-primary/5" : "border-border"}`}>
                        <div className="font-medium capitalize">{u}</div>
                        <div className="text-xs text-muted-foreground">{u === "express" ? "+50% — under 1hr" : "Normal speed"}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Add-ons</div>
                  <div className="space-y-1 text-sm">
                    <Toggle icon={Shield} label="Insurance (+KSh 50)" checked={insurance} onChange={setInsurance} />
                    <Toggle icon={Zap} label="Priority dispatch (+KSh 100)" checked={priority} onChange={setPriority} />
                    <Toggle icon={Bell} label="SMS recipient (+KSh 20)" checked={smsRecipient} onChange={setSmsRecipient} />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid md:grid-cols-3 gap-2 items-end">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Promo code</label>
                  <input className="mt-1 w-full h-10 px-3 rounded-md border bg-background"
                    value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Try FIRST10 or SWIFT20" />
                </div>
                {promoDiscount > 0 && <div className="text-sm text-primary font-medium">−{Math.round(promoDiscount * 100)}% applied</div>}
              </div>

              <div className="mt-6 p-4 rounded-xl bg-muted/50 space-y-1 text-sm">
                <Row label="Base fare" value={`KSh ${q.base.toLocaleString()}`} />
                <Row label={`Distance (${distance} km)`} value={`KSh ${q.distance.toLocaleString()}`} />
                {urgency === "express" && <Row label="Express ×1.5" value="" />}
                {q.addons > 0 && <Row label="Add-ons" value={`KSh ${q.addons.toLocaleString()}`} />}
                {q.discount > 0 && <Row label="Discount" value={`− KSh ${q.discount.toLocaleString()}`} />}
                <div className="h-px bg-border my-2" />
                <Row label="Total" value={`KSh ${q.total.toLocaleString()}`} bold />
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-1">Payment</h2>
              <p className="text-sm text-muted-foreground mb-6">Choose how to pay KSh {q.total.toLocaleString()}.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {(["mpesa", "card", "wallet", "cod"] as const).map((m) => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={`px-4 h-10 rounded-md border text-sm font-medium ${paymentMethod === m ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
                    {m === "mpesa" ? "M-Pesa" : m === "card" ? "Card" : m === "wallet" ? "Wallet" : "Cash on Delivery"}
                  </button>
                ))}
              </div>
              {paymentMethod === "mpesa" && (
                <div className="space-y-3">
                  <Field icon={Smartphone} label="M-Pesa phone number" value={mpesaPhone} onChange={setMpesaPhone} placeholder="+254 7XX XXX XXX" />
                  <p className="text-xs text-muted-foreground">You'll receive an STK push on your phone. Enter your M-Pesa PIN to confirm. <span className="italic">(Demo mode — payment will simulate as paid.)</span></p>
                </div>
              )}
              {paymentMethod === "card" && <p className="text-sm text-muted-foreground">Card payment via Flutterwave coming soon. Demo mode marks as paid.</p>}
              {paymentMethod === "wallet" && <p className="text-sm text-muted-foreground">Your wallet will be debited KSh {q.total.toLocaleString()}. (Demo)</p>}
              {paymentMethod === "cod" && <p className="text-sm text-muted-foreground">Pay the rider in cash on delivery. KSh 50 COD fee applies in production.</p>}
              {!user && <p className="mt-4 text-sm text-amber-600">You'll need to sign in to confirm. <Link to="/auth" className="underline font-medium">Sign in</Link></p>}
              {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
            </div>
          )}

          {step === 5 && confirmed && (
            <div className="text-center py-8">
              <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Booking confirmed!</h2>
              <p className="text-muted-foreground mb-6">A rider will be assigned in approximately 2 minutes.</p>
              <div className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-muted font-mono text-lg">
                {confirmed.tracking}
                <button onClick={() => navigator.clipboard.writeText(confirmed.tracking)} className="text-muted-foreground hover:text-foreground">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link to="/track/$trackingId" params={{ trackingId: confirmed.tracking }}
                  className="h-11 inline-flex items-center px-5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90">
                  Track delivery <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
                <Link to="/dashboard" className="h-11 inline-flex items-center px-5 rounded-md border font-medium">
                  My bookings
                </Link>
              </div>
            </div>
          )}

          {step < 5 && (
            <div className="flex justify-between mt-8 pt-6 border-t">
              <button onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))} disabled={step === 1}
                className="h-11 px-5 rounded-md border font-medium inline-flex items-center gap-1 disabled:opacity-40">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {step < 4 ? (
                <button
                  onClick={() => setStep((s) => (s + 1) as Step)}
                  disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2) || (step === 3 && !canNext3)}
                  className="h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium inline-flex items-center gap-1 disabled:opacity-50">
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={submitBooking} disabled={submitting || !canPay || !user}
                  className="h-11 px-6 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50">
                  {submitting ? "Booking…" : `Pay KSh ${q.total.toLocaleString()}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, value, onChange, placeholder, type = "text" }: any) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
        <input type={type} className={`w-full h-10 ${Icon ? "pl-9" : "px-3"} pr-3 rounded-md border bg-background`}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </div>
    </div>
  );
}

function Toggle({ icon: Icon, label, checked, onChange }: any) {
  return (
    <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/30">
      <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
