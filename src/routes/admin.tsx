import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { sendBookingSms } from "@/lib/payments.functions";
import logo from "@/assets/logo.png";
import { Bell, CheckCircle2, Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · SwiftLink" }] }),
  component: Admin,
});

const STATUSES = ["all", "pending", "assigned", "picked_up", "in_transit", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["all", "pending", "processing", "paid", "failed"] as const;
const SMS_EVENTS = [
  { id: "confirmed", label: "Confirmed" },
  { id: "rider_assigned", label: "Rider on the way" },
  { id: "picked_up", label: "Picked up" },
  { id: "out_for_delivery", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
  { id: "payment_failed", label: "Payment failed" },
  { id: "failed_delivery", label: "Failed delivery" },
] as const;

type SmsEvent = (typeof SMS_EVENTS)[number]["id"];

function Admin() {
  const { user, loading, isAdmin } = useAuth();
  const nav = useNavigate();
  const sendSms = useServerFn(sendBookingSms);

  const [bookings, setBookings] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [payFilter, setPayFilter] = useState<(typeof PAYMENT_STATUSES)[number]>("all");
  const [tab, setTab] = useState<"bookings" | "riders" | "analytics">("bookings");
  const [smsFor, setSmsFor] = useState<string | null>(null); // bookingId opening picker
  const [smsBusy, setSmsBusy] = useState<string | null>(null); // bookingId currently sending
  const [smsResult, setSmsResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && !isAdmin) {
      // Self-grant admin in demo: easier UX. Comment out for production.
      supabase.from("user_roles").insert({ user_id: user.id, role: "admin" }).then(() => location.reload());
    }
  }, [user, loading, isAdmin]);

  async function load() {
    const [{ data: b }, { data: r }] = await Promise.all([
      supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("riders").select("*").order("created_at", { ascending: false }),
    ]);
    setBookings(b ?? []);
    setRiders(r ?? []);
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  // Realtime: refresh the list as payments/statuses change in the background
  useEffect(() => {
    if (!isAdmin) return;
    const chan = supabase
      .channel("admin-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [isAdmin]);

  async function updateStatus(id: string, status: string) {
    await supabase
      .from("bookings")
      .update({ status, ...(status === "delivered" ? { delivered_at: new Date().toISOString() } : {}) })
      .eq("id", id);
    await supabase.from("booking_events").insert({ booking_id: id, status });
    load();
  }

  async function triggerSms(bookingId: string, event: SmsEvent) {
    setSmsBusy(bookingId);
    setSmsResult((prev) => ({ ...prev, [bookingId]: { ok: false, msg: "" } }));
    try {
      const res: any = await sendSms({ data: { bookingId, event } });
      setSmsResult((prev) => ({
        ...prev,
        [bookingId]: res?.ok
          ? { ok: true, msg: `Sent to ${res.sent} recipient(s)` }
          : { ok: false, msg: res?.reason === "no_recipients" ? "No phone numbers on booking" : "Skipped" },
      }));
    } catch (e: any) {
      setSmsResult((prev) => ({ ...prev, [bookingId]: { ok: false, msg: e?.message ?? "Failed" } }));
    } finally {
      setSmsBusy(null);
      setSmsFor(null);
    }
  }

  const filtered = bookings.filter((b) => {
    if (filter !== "all" && b.status !== filter) return false;
    if (payFilter !== "all" && b.payment_status !== payFilter) return false;
    return true;
  });

  const stats = useMemo(
    () => ({
      total: bookings.length,
      revenue: bookings
        .filter((b) => b.payment_status === "paid")
        .reduce((s, b) => s + Number(b.total_price), 0),
      active: bookings.filter((b) => !["delivered", "cancelled"].includes(b.status)).length,
      delivered: bookings.filter((b) => b.status === "delivered").length,
      processing: bookings.filter((b) => b.payment_status === "processing").length,
      paymentFailed: bookings.filter((b) => b.payment_status === "failed").length,
    }),
    [bookings]
  );

  if (loading || !user || !isAdmin)
    return <div className="min-h-screen flex items-center justify-center">Loading admin…</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} className="h-8 w-8" />
            <span className="font-bold">SwiftLink Admin</span>
          </Link>
          <Link to="/dashboard" className="text-sm hover:underline">My account</Link>
        </div>
      </header>
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Total bookings" value={stats.total} />
          <Stat label="Active" value={stats.active} />
          <Stat label="Delivered" value={stats.delivered} />
          <Stat label="Paid revenue (KSh)" value={stats.revenue.toLocaleString()} />
          <Stat label="M-Pesa processing" value={stats.processing} accent="amber" />
          <Stat label="M-Pesa failed" value={stats.paymentFailed} accent="red" />
        </div>

        <div className="flex gap-2 mb-4 border-b">
          {(["bookings", "riders", "analytics"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 ${
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "bookings" && (
          <>
            <div className="space-y-2 mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold uppercase text-muted-foreground mr-1">Status:</span>
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`px-3 h-8 text-xs rounded-full border capitalize ${
                      filter === s ? "bg-primary text-primary-foreground border-primary" : ""
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold uppercase text-muted-foreground mr-1">Payment:</span>
                {PAYMENT_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPayFilter(s)}
                    className={`px-3 h-8 text-xs rounded-full border capitalize ${
                      payFilter === s
                        ? s === "paid"
                          ? "bg-primary text-primary-foreground border-primary"
                          : s === "failed"
                          ? "bg-destructive text-destructive-foreground border-destructive"
                          : s === "processing"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-foreground text-background"
                        : ""
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase">
                  <tr>
                    <th className="p-3">Tracking</th>
                    <th className="p-3">Route</th>
                    <th className="p-3">Vehicle</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Payment</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const result = smsResult[b.id];
                    return (
                      <tr key={b.id} className="border-t">
                        <td className="p-3 font-mono text-xs">
                          <Link
                            to="/track/$trackingId"
                            params={{ trackingId: b.tracking_number }}
                            className="text-primary hover:underline"
                          >
                            {b.tracking_number}
                          </Link>
                          {b.mpesa_receipt && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">{b.mpesa_receipt}</div>
                          )}
                        </td>
                        <td className="p-3 max-w-xs truncate">
                          {b.pickup_address} → {b.dropoff_address}
                        </td>
                        <td className="p-3 capitalize">{b.vehicle_type}</td>
                        <td className="p-3">KSh {Number(b.total_price).toLocaleString()}</td>
                        <td className="p-3">
                          <PaymentPill status={b.payment_status} />
                          {b.payment_attempts > 1 && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {b.payment_attempts} attempts
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize">
                            {b.status}
                          </span>
                        </td>
                        <td className="p-3 space-y-1">
                          <select
                            value={b.status}
                            onChange={(e) => updateStatus(b.id, e.target.value)}
                            className="h-8 w-full text-xs border rounded px-2 bg-background"
                          >
                            {STATUSES.filter((s) => s !== "all").map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <div className="relative">
                            <button
                              onClick={() => setSmsFor(smsFor === b.id ? null : b.id)}
                              disabled={smsBusy === b.id}
                              className="w-full h-8 text-xs border rounded inline-flex items-center justify-center gap-1 hover:bg-muted disabled:opacity-50"
                            >
                              {smsBusy === b.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Bell className="h-3 w-3" />
                              )}
                              Send SMS
                            </button>
                            {smsFor === b.id && (
                              <div className="absolute right-0 top-9 z-10 w-48 bg-card border rounded-lg shadow-lg py-1">
                                {SMS_EVENTS.map((ev) => (
                                  <button
                                    key={ev.id}
                                    onClick={() => triggerSms(b.id, ev.id)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                                  >
                                    {ev.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {result && result.msg && (
                            <div
                              className={`text-[10px] ${
                                result.ok ? "text-primary" : "text-destructive"
                              } flex items-center gap-1`}
                            >
                              {result.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              {result.msg}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No bookings match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "riders" && (
          <div className="bg-card border rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-4">{riders.length} riders registered.</p>
            {riders.length === 0 ? (
              <p className="text-sm">No riders yet. Riders register via the Become a Rider flow (coming soon).</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {riders.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.vehicle_type} · {r.plate_number} · ⭐ {r.rating}
                    </div>
                    <span
                      className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${
                        r.status === "online" ? "bg-green-100 text-green-700" : "bg-muted"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "analytics" && (
          <div className="bg-card border rounded-xl p-6">
            <h3 className="font-semibold mb-4">Performance</h3>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <Stat
                label="Avg order value (KSh)"
                value={stats.delivered ? Math.round(stats.revenue / stats.delivered).toLocaleString() : "—"}
              />
              <Stat
                label="Completion rate"
                value={stats.total ? `${Math.round((stats.delivered / stats.total) * 100)}%` : "—"}
              />
              <Stat label="Active deliveries" value={stats.active} />
              <Stat
                label="Payment success"
                value={
                  stats.total
                    ? `${Math.round(
                        (bookings.filter((b) => b.payment_status === "paid").length / stats.total) * 100
                      )}%`
                    : "—"
                }
              />
              <Stat label="M-Pesa processing" value={stats.processing} accent="amber" />
              <Stat label="M-Pesa failed" value={stats.paymentFailed} accent="red" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentPill({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-primary/10 text-primary"
      : status === "failed"
      ? "bg-destructive/10 text-destructive"
      : status === "processing"
      ? "bg-amber-100 text-amber-700"
      : "bg-muted text-muted-foreground";
  return <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${cls}`}>{status ?? "—"}</span>;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "amber" | "red";
}) {
  const accentCls =
    accent === "amber" ? "text-amber-700" : accent === "red" ? "text-destructive" : "text-foreground";
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accentCls}`}>{value}</div>
    </div>
  );
}
