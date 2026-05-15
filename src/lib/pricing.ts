// SwiftLink pricing rules from product spec
export type Vehicle = "motorbike" | "van" | "lorry";
export type Urgency = "standard" | "express";

export const VEHICLES: Record<Vehicle, { label: string; base: number; perKm: number; capacity: string }> = {
  motorbike: { label: "Motorbike", base: 150, perKm: 30, capacity: "Parcels, docs, food (≤20kg)" },
  van: { label: "Van 1.5–3T", base: 800, perKm: 100, capacity: "Electronics, bulk (≤1500kg)" },
  lorry: { label: "Lorry 7–10T", base: 3500, perKm: 180, capacity: "Industrial freight (≤10T)" },
};

export interface QuoteInput {
  vehicle: Vehicle;
  distanceKm: number;
  urgency: Urgency;
  insurance?: boolean;
  priority?: boolean;
  smsRecipient?: boolean;
  promoDiscount?: number; // 0-1
}

export interface QuoteBreakdown {
  base: number;
  distance: number;
  addons: number;
  subtotal: number;
  urgencyMultiplier: number;
  discount: number;
  total: number;
}

export function quote(input: QuoteInput): QuoteBreakdown {
  const v = VEHICLES[input.vehicle];
  const base = v.base;
  // Base covers 0-3km; per-km after 3km
  const billable = Math.max(0, input.distanceKm - 3);
  const distance = Math.round(billable * v.perKm);
  let addons = 0;
  if (input.insurance) addons += 50;
  if (input.priority) addons += 100;
  if (input.smsRecipient) addons += 20;
  const urgencyMultiplier = input.urgency === "express" ? 1.5 : 1;
  const subtotal = (base + distance) * urgencyMultiplier + addons;
  const discount = Math.round(subtotal * (input.promoDiscount ?? 0));
  const total = Math.max(0, Math.round(subtotal - discount));
  return { base, distance, addons, subtotal: Math.round(subtotal), urgencyMultiplier, discount, total };
}

// Haversine distance in km
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function generateTrackingNumber(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SLT-${part()}-${part()}`;
}

export function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
