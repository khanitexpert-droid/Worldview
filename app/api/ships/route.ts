import type { Ship } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simulated AIS. Swap this route for a real AIS provider (aisstream.io,
// MarineTraffic, etc.) without touching the front end.
const LANES: [number, number, string][] = [
  [4.0, 51.9, "ROTTERDAM APPROACH"],
  [121.8, 31.2, "SHANGHAI YANGSHAN"],
  [-118.25, 33.72, "SAN PEDRO BAY"],
  [55.05, 25.0, "JEBEL ALI"],
  [103.7, 1.26, "SINGAPORE STRAIT"],
  [32.35, 31.25, "SUEZ NORTH"],
  [-79.9, 9.35, "PANAMA CARIBBEAN"],
];

const TYPES = ["CARGO", "TANKER", "CONTAINER", "BULK CARRIER", "RO-RO", "LNG"];
const NAMES = [
  "EVER",
  "MAERSK",
  "MSC",
  "CMA",
  "NORDIC",
  "PACIFIC",
  "ATLANTIC",
  "STAR",
];

export async function GET() {
  const t = Date.now() / 1000;
  const items: Ship[] = [];
  let n = 0;
  for (const [lon, lat, area] of LANES) {
    for (let i = 0; i < 14; i++) {
      const phase = (n * 1.7 + t / 90) % (Math.PI * 2);
      const spread = ((i % 7) - 3) * 0.35;
      items.push({
        id: `MMSI${200000000 + n}`,
        name: `${NAMES[(n + i) % NAMES.length]} ${area.split(" ")[0]} ${n}`,
        lon: lon + Math.cos(phase) * 0.6 + spread,
        lat: lat + Math.sin(phase) * 0.45 + spread * 0.4,
        heading: (Math.cos(phase) * 180 + 180) % 360,
        type: TYPES[(n + i) % TYPES.length],
        speed: 6 + ((n * 7 + i * 3) % 16),
      });
      n++;
    }
  }
  return Response.json({ items, source: "sim-ais", live: false });
}
