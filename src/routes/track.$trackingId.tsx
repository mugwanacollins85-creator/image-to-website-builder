import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CheckCircle2, Circle, Clock, Phone, Package } from "lucide-react";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/track/$trackingId")({
  head: ({ params }) => ({ meta: [{ title: `Track ${params.trackingId} · SwiftLink` }] }),
  component: TrackPage,
});

const STAGES = ["pending", "assigned", "picked_up", "in_transit", "arriving", "delivered"] as const;
const STAGE_LABEL: Record<string, string> = {
  pending: "Order Placed", assigned: "Rider Assigned", picked_up: "Package Picked Up",
  in_transit: "In Transit", arriving: "Arriving Soon", delivered: "Delivered",
};

const icon = (color: string) => L.divIcon({
  html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
  className: "", iconSize: [20, 20], iconAnchor: [10, 10],
});

function TrackPage() {
  const { trackingId } = Route.useParams();
  const [booking, setBooking] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: b } = await supabase.from("bookings").select("*").eq("tracking_number", trackingId).maybeSingle();
    setBooking(b);
    if (b) {
      const { data: ev } = await supabase.from("booking_events").select("*").eq("booking_id", b.id).order("created_at");
      setEvents(ev ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel(`track-${trackingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `tracking_number=eq.${trackingId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [trackingId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center text-center p-4">
      <div>
        <h1 className="text-2xl font-bold mb-2">Tracking number not found</h1>
        <p className="text-muted-foreground mb-4">Check the code and try again.</p>
        <Link to="/" className="text-primary underline">Back home</Link>
      </div>
    </div>
  );

  const pickup: [number, number] = [booking.pickup_lat ?? -1.286, booking.pickup_lng ?? 36.817];
  const dropoff: [number, number] = [booking.dropoff_lat ?? -1.29, booking.dropoff_lng ?? 36.82];
  const currentStageIdx = STAGES.indexOf(booking.status);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SwiftLink" className="h-8 w-8" />
            <span className="font-bold">SwiftLink</span>
          </Link>
          <div className="text-sm font-mono">{trackingId}</div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid lg:grid-cols-[400px_1fr] gap-4">
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border p-5">
            <div className="text-xs text-muted-foreground uppercase">Status</div>
            <div className="text-2xl font-bold capitalize">{STAGE_LABEL[booking.status] || booking.status}</div>
            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Total: KSh {Number(booking.total_price).toLocaleString()}
            </div>
          </div>

          <div className="bg-card rounded-2xl border p-5">
            <div className="text-sm font-semibold mb-3">Timeline</div>
            <ol className="space-y-3">
              {STAGES.filter(s => s !== "arriving" || currentStageIdx >= 4).map((s, i) => {
                const done = STAGES.indexOf(s) <= currentStageIdx;
                const ev = events.find(e => e.status === s);
                return (
                  <li key={s} className="flex gap-3">
                    {done ? <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" /> : <Circle className="h-5 w-5 text-muted-foreground mt-0.5" />}
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}>{STAGE_LABEL[s]}</div>
                      {ev && <div className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="bg-card rounded-2xl border p-5">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> Delivery details</div>
            <div className="text-sm space-y-2">
              <div><span className="text-muted-foreground">From:</span> {booking.pickup_address}</div>
              <div><span className="text-muted-foreground">To:</span> {booking.dropoff_address}</div>
              <div><span className="text-muted-foreground">Vehicle:</span> {booking.vehicle_type}</div>
              <div><span className="text-muted-foreground">Distance:</span> {booking.distance_km} km</div>
              {booking.dropoff_contact_phone && (
                <div className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {booking.dropoff_contact_phone}</div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border overflow-hidden h-[60vh] lg:h-[calc(100vh-7rem)]">
          <MapContainer center={[(pickup[0] + dropoff[0]) / 2, (pickup[1] + dropoff[1]) / 2]} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={pickup} icon={icon("#22c55e")}><Popup>Pickup<br />{booking.pickup_address}</Popup></Marker>
            <Marker position={dropoff} icon={icon("#ef4444")}><Popup>Drop-off<br />{booking.dropoff_address}</Popup></Marker>
            <Polyline positions={[pickup, dropoff]} color="#002D72" dashArray="6 8" />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
