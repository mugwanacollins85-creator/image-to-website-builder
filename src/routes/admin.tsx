import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · SwiftLink" }] }),
  component: Admin,
});

const STATUSES = ["all", "pending", "assigned", "picked_up", "in_transit", "delivered", "cancelled"];

function Admin() {
  const { user, loading, isAdmin } = useAuth();
  const nav = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"bookings" | "riders" | "analytics">("bookings");

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
    setBookings(b ?? []); setRiders(r ?? []);
  }
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  async function updateStatus(id: string, status: string) {
    await supabase.from("bookings").update({ status, ...(status === "delivered" ? { delivered_at: new Date().toISOString() } : {}) }).eq("id", id);
    await supabase.from("booking_events").insert({ booking_id: id, status });
    load();
  }

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);
  const stats = useMemo(() => ({
    total: bookings.length,
    revenue: bookings.filter(b => b.status === "delivered").reduce((s, b) => s + Number(b.total_price), 0),
    active: bookings.filter(b => !["delivered", "cancelled"].includes(b.status)).length,
    delivered: bookings.filter(b => b.status === "delivered").length,
  }), [bookings]);

  if (loading || !user || !isAdmin) return <div className="min-h-screen flex items-center justify-center">Loading admin…</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><img src={logo} className="h-8 w-8" /><span className="font-bold">SwiftLink Admin</span></Link>
          <Link to="/dashboard" className="text-sm hover:underline">My account</Link>
        </div>
      </header>
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Stat label="Total bookings" value={stats.total} />
          <Stat label="Active" value={stats.active} />
          <Stat label="Delivered" value={stats.delivered} />
          <Stat label="Revenue (KSh)" value={stats.revenue.toLocaleString()} />
        </div>

        <div className="flex gap-2 mb-4 border-b">
          {(["bookings", "riders", "analytics"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t}</button>
          ))}
        </div>

        {tab === "bookings" && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {STATUSES.map(s => (
                <button key={s} onClick={() => setFilter(s)} className={`px-3 h-8 text-xs rounded-full border capitalize ${filter === s ? "bg-primary text-primary-foreground border-primary" : ""}`}>{s}</button>
              ))}
            </div>
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase">
                  <tr><th className="p-3">Tracking</th><th className="p-3">Route</th><th className="p-3">Vehicle</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Action</th></tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} className="border-t">
                      <td className="p-3 font-mono text-xs">
                        <Link to="/track/$trackingId" params={{ trackingId: b.tracking_number }} className="text-primary hover:underline">{b.tracking_number}</Link>
                      </td>
                      <td className="p-3 max-w-xs truncate">{b.pickup_address} → {b.dropoff_address}</td>
                      <td className="p-3 capitalize">{b.vehicle_type}</td>
                      <td className="p-3">KSh {Number(b.total_price).toLocaleString()}</td>
                      <td className="p-3"><span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary capitalize">{b.status}</span></td>
                      <td className="p-3">
                        <select value={b.status} onChange={(e) => updateStatus(b.id, e.target.value)} className="h-8 text-xs border rounded px-2 bg-background">
                          {STATUSES.filter(s => s !== "all").map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No bookings.</td></tr>}
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
                {riders.map(r => (
                  <div key={r.id} className="border rounded-lg p-3">
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.vehicle_type} · {r.plate_number} · ⭐ {r.rating}</div>
                    <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${r.status === "online" ? "bg-green-100 text-green-700" : "bg-muted"}`}>{r.status}</span>
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
              <Stat label="Avg order value (KSh)" value={stats.delivered ? Math.round(stats.revenue / stats.delivered).toLocaleString() : "—"} />
              <Stat label="Completion rate" value={stats.total ? `${Math.round((stats.delivered / stats.total) * 100)}%` : "—"} />
              <Stat label="Active deliveries" value={stats.active} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
