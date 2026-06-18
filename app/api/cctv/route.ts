import type { Camera } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Simulated public-camera index. Swap for a real cam directory + proxy the
// snapshot through /api/cctv/image later.
const CAMS: [string, number, number][] = [
  ["TIMES SQUARE — NYC", -73.9855, 40.758],
  ["SHIBUYA CROSSING — TOKYO", 139.7005, 35.6595],
  ["ABBEY ROAD — LONDON", -0.1779, 51.5319],
  ["LAS VEGAS BLVD — NV", -115.1722, 36.1147],
  ["VENICE BEACH — CA", -118.4912, 33.985],
  ["BONDI BEACH — SYDNEY", 151.2767, -33.8908],
  ["BRANDENBURG GATE — BERLIN", 13.3777, 52.5163],
  ["TREVI FOUNTAIN — ROME", 12.4833, 41.9009],
  ["DAM SQUARE — AMSTERDAM", 4.8932, 52.3731],
  ["PIKE PLACE — SEATTLE", -122.3421, 47.6097],
  ["KÁRMELITER — VIENNA", 16.3738, 48.2167],
  ["MARINA BAY — SINGAPORE", 103.8607, 1.2834],
];

export async function GET() {
  const items: Camera[] = CAMS.map(([name, lon, lat], i) => ({
    id: `CAM-${String(i + 1).padStart(3, "0")}`,
    name,
    lon,
    lat,
    // a couple flagged offline for realism
    status: i % 5 === 4 ? "OFFLINE" : "ONLINE",
  }));
  return Response.json({ items, source: "sim-cctv", live: false });
}
