import type { MissileSpec } from "./types";

// Operator metadata: accent color + the origin point the range rings are centered
// on (a representative launch location, ~national capital/centroid).
export interface MissileOperator {
  name: string;
  color: string;
  origin: [number, number]; // [lon, lat]
}

export const MISSILE_OPERATORS: Record<string, MissileOperator> = {
  Iran: { name: "Iran", color: "#ff414e", origin: [51.39, 35.69] }, // Tehran
  Israel: { name: "Israel", color: "#00e5ff", origin: [34.95, 31.5] }, // central Israel
};

// Curated open-source reference (figures match public missile databases). NOT a
// live feed — arsenals don't change daily. Estimates are flagged in `note`.
export const MISSILES: MissileSpec[] = [
  // ---- Iran ----
  { id: "soumar", name: "Soumar", operator: "Iran", category: "Cruise", rangeKm: 2000, payloadKg: 410, status: "OPERATIONAL", note: "Kh-55 derivative." },
  { id: "hoveyzeh", name: "Hoveyzeh", operator: "Iran", category: "Cruise", rangeKm: 1350, payloadKg: 410, status: "OPERATIONAL" },
  { id: "paveh", name: "Paveh", operator: "Iran", category: "Cruise", rangeKm: 1650, payloadKg: 450, status: "OPERATIONAL" },
  { id: "shahed-136", name: "Shahed-136", operator: "Iran", category: "Loitering", rangeKm: 2500, payloadKg: 50, status: "OPERATIONAL", note: "One-way attack drone (Kamikaze)." },
  { id: "shahed-238", name: "Shahed-238", operator: "Iran", category: "Loitering (jet)", rangeKm: 2000, payloadKg: 90, status: "OPERATIONAL" },
  // ---- Israel ----
  { id: "jericho-1", name: "Jericho I", operator: "Israel", category: "SRBM", rangeKm: 500, payloadKg: 1000, status: "RETIRED", note: "1973-era SRBM, no longer in service." },
  { id: "jericho-2", name: "Jericho II", operator: "Israel", category: "IRBM", rangeKm: 1500, payloadKg: 1000, status: "OPERATIONAL", note: "Two-stage solid IRBM." },
  { id: "jericho-3", name: "Jericho III", operator: "Israel", category: "ICBM", rangeKm: 6500, payloadKg: 1300, status: "OPERATIONAL", note: "Nuclear-capable (presumed). Range estimates 4,800–6,500 km." },
  { id: "jericho-4", name: "Jericho IV", operator: "Israel", category: "ICBM", rangeKm: 8000, payloadKg: 1300, status: "REPORTED", note: "Reported in development, range unconfirmed." },
  { id: "lora", name: "LORA", operator: "Israel", category: "SRBM (solid)", rangeKm: 400, payloadKg: 570, status: "OPERATIONAL" },
  { id: "predator-hawk", name: "Predator Hawk", operator: "Israel", category: "SRBM", rangeKm: 300, payloadKg: 140, status: "OPERATIONAL" },
];
