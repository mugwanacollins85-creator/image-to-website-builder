import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/logo.png";
import { Plus, LogOut, Package } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard · SwiftLink" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (user) {
      supabase.from("bookings").select("*").eq("customer_id", user.id).order("created_at", { ascending: false })
        .then(({ data }) => setBookings(data ?? []));
    }
  }, [user, loading]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><img src={logo} className="h-8 w-8" /><span className="font-bold">SwiftLink</span></Link>
          <div className="flex items-center gap-3 text-sm">
            {isAdmin && <Link to="/admin" className="text-primary font-medium">Admin</Link>}
            <span className="text-muted-foreground hidden sm:block">{user.email}</span>
            <button onClick={() => signOut().then(() => nav({ to: "/" }))} className="inline-flex items-center gap-1 hover:text-destructive"><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">My deliveries</h1>
            <p className="text-muted-foreground">{bookings.length} total bookings</p>
          </div>
          <Link to="/book" className="inline-flex items-center gap-1 h-11 px-5 rounded-md bg-primary text-primary-foreground font-medium"><Plus className="h-4 w-4" /> New booking</Link>
        </div>
        {bookings.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No bookings yet.</p>
            <Link to="/book" className="text-primary font-medium underline">Book your first delivery</Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {bookings.map((b) => (
              <Link key={b.id} to="/track/$trackingId" params={{ trackingId: b.tracking_number }}
                className="bg-card border rounded-xl p-4 flex justify-between items-center hover:border-primary transition">
                <div>
                  <div className="font-mono text-sm text-muted-foreground">{b.tracking_number}</div>
                  <div className="font-medium">{b.pickup_address} → {b.dropoff_address}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(b.created_at).toLocaleString()} · {b.vehicle_type}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">KSh {Number(b.total_price).toLocaleString()}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{b.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
