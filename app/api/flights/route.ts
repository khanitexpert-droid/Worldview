import type { Flight } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Vercel defaults serverless functions to 10s; the auth + ~1.7MB global feed
// from OpenSky's EU servers (plus cold start) can exceed that. Give it room.
export const maxDuration = 60;

// OpenSky "all states" feed.
// - Anonymous works but is heavily rate-limited (you get throttled fast).
// - With an API client (OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET) we use
//   OAuth2 client-credentials for far higher limits + the full global feed.
//   https://openskynetwork.github.io/opensky-api/rest.html
const OPENSKY = "https://opensky-network.org/api/states/all";
const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

// How many aircraft to ship to the client. The globe handles a lot of moving
// points; the original site tracks ~6.5k.
const MAX_FLIGHTS = 6000;

// cached OAuth token (module scope persists across requests on a warm lambda)
let tokenCache: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const id = process.env.OPENSKY_CLIENT_ID;
  const secret = process.env.OPENSKY_CLIENT_SECRET;
  if (!id || !secret) return null;

  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });
  const res = await fetch(OPENSKY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`opensky auth ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    // refresh a minute before actual expiry
    expires: Date.now() + (json.expires_in - 60) * 1000,
  };
  return json.access_token;
}

export async function GET() {
  // Don't let an auth failure kill the request — if the OAuth token can't be
  // fetched (OpenSky's auth server is flaky from some datacenters), still try
  // an anonymous (rate-limited) states call rather than giving up entirely.
  let token: string | null = null;
  try {
    token = await getAccessToken();
  } catch (e) {
    console.error("[flights] OpenSky auth failed, trying anonymous:", e);
  }

  try {
    const res = await fetch(OPENSKY, {
      cache: "no-store",
      headers: {
        "User-Agent": "worldview-clone/1.0",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(20000),
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
      .slice(0, MAX_FLIGHTS);

    return Response.json({
      items,
      source: token ? "opensky-auth" : "opensky-anon",
      live: true,
    });
  } catch (err) {
    // Fallback so the UI keeps working if OpenSky throttles or is down.
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
