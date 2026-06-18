import type { RoadTraffic } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simulated road-sensor congestion. Swap for TomTom / HERE traffic flow later.
const CITIES: [string, number, number][] = [
  ["LONDON", -0.1276, 51.5072],
  ["NEW YORK", -74.006, 40.7128],
  ["TOKYO", 139.6917, 35.6895],
  ["LOS ANGELES", -118.2437, 34.0522],
  ["DUBAI", 55.2708, 25.2048],
  ["PARIS", 2.3522, 48.8566],
];

const LEVELS: RoadTraffic["level"][] = ["FREE", "MODERATE", "HEAVY", "JAM"];

export async function GET() {
  const t = Math.floor(Date.now() / 15000); // shift every 15s
  const items: RoadTraffic[] = [];
  let n = 0;
  for (const [city, clon, clat] of CITIES) {
    for (let i = 0; i < 18; i++) {
      const lvl = LEVELS[(n + t + i) % LEVELS.length];
      items.push({
        id: `RD-${city.slice(0, 3)}-${i}`,
        road: `${city} ARTERIAL ${i + 1}`,
        lon: clon + (Math.random() - 0.5) * 0.22,
        lat: clat + (Math.random() - 0.5) * 0.18,
        level: lvl,
      });
      n++;
    }
  }
  return Response.json({ items, source: "sim-traffic", live: false });
}
