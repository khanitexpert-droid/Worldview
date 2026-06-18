import type { Flight } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// OpenSky public "all states" feed. No key required (rate-limited).
// https://openskynetwork.github.io/opensky-api/rest.html
const OPENSKY = "https://opensky-network.org/api/states/all";

export async function GET() {
  try {
    const res = await fetch(OPENSKY, {
      cache: "no-store",
      headers: { "User-Agent": "worldview-clone/1.0" },
      // OpenSky can be slow; cap the wait.
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(`opensky ${res.status}`);
    const data = (await res.json()) as { states: unknown[][] | null };

    const items: Flight[] = (data.states ?? [])
      .map((s) => ({
        id: String(s[0]),
        callsign: (String(s[1] ?? "").trim() || "UNKNOWN").toUpperCase(),
        country: String(s[2] ?? "—"),
        lon: Number(s[5]),
        lat: Number(s[6]),
        altitude: Number(s[7] ?? s[13] ?? 0),
        velocity: Number(s[9] ?? 0),
        heading: Number(s[10] ?? 0),
      }))
      .filter(
        (f) =>
          Number.isFinite(f.lon) &&
          Number.isFinite(f.lat) &&
          !(f.lon === 0 && f.lat === 0)
      )
      // cap payload — the globe doesn't need 10k points
      .slice(0, 1500);

    return Response.json({ items, source: "opensky", live: true });
  } catch (err) {
    // Fallback so the UI keeps working if OpenSky throttles us.
    return Response.json({
      items: syntheticFlights(),
      source: "fallback",
      live: false,
      error: String(err),
    });
  }
}

function syntheticFlights(): Flight[] {
  const hubs: [number, number, string][] = [
    [-0.45, 51.47, "EGLL"],
    [-73.78, 40.64, "KJFK"],
    [139.78, 35.55, "RJTT"],
    [55.36, 25.25, "OMDB"],
    [2.55, 49.0, "LFPG"],
    [103.99, 1.36, "WSSS"],
  ];
  const out: Flight[] = [];
  for (let i = 0; i < 240; i++) {
    const [hlon, hlat] = hubs[i % hubs.length];
    out.push({
      id: `SIM${i}`,
      callsign: `WV${String(100 + i)}`,
      country: "SIMULATED",
      lon: hlon + (Math.random() - 0.5) * 40,
      lat: hlat + (Math.random() - 0.5) * 30,
      altitude: 8000 + Math.random() * 4000,
      velocity: 180 + Math.random() * 80,
      heading: Math.random() * 360,
    });
  }
  return out;
}
