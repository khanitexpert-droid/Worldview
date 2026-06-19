import type { WorldEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

// World-events data is produced by a scheduled GitHub Action (.github/workflows/
// events.yml + scripts/fetch-events.ts): it fetches GDELT from GitHub's clean
// runner IP — GDELT blocks Vercel's serverless/edge egress IPs, so we must NOT
// fetch GDELT from here — and publishes events.json to the `data` branch. This
// route just relays that file (GitHub serves Vercel fine) and lets the CDN cache
// it, so the browser gets the data same-origin with no CORS / rate-limit issues.
const DATA_URL =
  "https://raw.githubusercontent.com/khanitexpert-droid/Worldview/data/events.json";

interface EventsPayload {
  items: WorldEvent[];
  source: string;
  live: boolean;
  fetchedAt: string;
  error?: string;
}

function json(payload: EventsPayload) {
  const fresh = payload.items.length > 0;
  return Response.json(payload, {
    headers: {
      "Cache-Control": fresh
        ? "public, s-maxage=120, stale-while-revalidate=86400"
        : "public, s-maxage=20",
    },
  });
}

export async function GET() {
  try {
    // bust raw.githubusercontent's ~5-min CDN cache once a minute so we pick up
    // the Action's fresh publish promptly
    const url = `${DATA_URL}?t=${Math.floor(Date.now() / 60000)}`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`data branch ${res.status}`);
    const data = (await res.json()) as { items?: WorldEvent[]; fetchedAt?: string };
    const items = data.items ?? [];
    return json({
      items,
      source: "gdelt",
      live: items.length > 0,
      fetchedAt: data.fetchedAt ?? new Date().toISOString(),
    });
  } catch (err) {
    return json({
      items: [],
      source: "fallback",
      live: false,
      fetchedAt: new Date().toISOString(),
      error: String(err),
    });
  }
}
