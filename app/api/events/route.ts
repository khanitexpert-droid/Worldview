import type { WorldEvent } from "@/lib/types";
import {
  aggregate,
  buildDocUrl,
  KEYWORD_QUERY,
  THEME_QUERY,
  type GdeltArticle,
} from "@/lib/gdelt";

// Run on Vercel's EDGE network, not the serverless (AWS) runtime: GDELT blocks
// the AWS egress IPs (the default route times out / 429s), but the Edge network
// egresses from different IPs that may get through. The browser hits this route
// same-origin, so there's no dependence on GDELT's (unreliable) CORS either.
// The response Cache-Control drives CDN edge caching (see `json()`); we
// deliberately do NOT set `revalidate = 0`, which would force `no-store`.
export const runtime = "edge";
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = "WORLDVIEW/1.0 (+https://worldview-henna.vercel.app)";

interface EventsPayload {
  items: WorldEvent[];
  source: string;
  live: boolean;
  fetchedAt: string;
  error?: string;
}

// GDELT throttling shows up two ways: HTTP 429, or HTTP 200 with a plain-text
// notice ("Please limit requests to one every 5 seconds"). Both are transient —
// back off past the 5s window (with jitter, so concurrent callers desync) and
// retry to catch an open slot. Network errors get a short retry too.
async function fetchArticles(query: string, retries = 1): Promise<GdeltArticle[]> {
  const url = buildDocUrl(query);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        cache: "no-store",
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(6000),
      });
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(2000);
      continue;
    }

    if (res.status === 429 && attempt < retries) {
      await sleep(5000 + Math.random() * 1500);
      continue;
    }
    if (!res.ok) throw new Error(`gdelt ${res.status}`);

    const text = await res.text();
    if (!text.trimStart().startsWith("{")) {
      if (attempt < retries) {
        await sleep(5000 + Math.random() * 1500);
        continue;
      }
      throw new Error(`gdelt non-json: ${text.slice(0, 80)}`);
    }
    const data = JSON.parse(text) as { articles?: GdeltArticle[] };
    return data.articles ?? [];
  }
}

// Send the payload with Cache-Control tuned to whether we actually have data:
//  - real data  -> cache at the CDN edge for 5 min and serve stale for a day
//    while revalidating, so one success keeps the layer populated edge-wide.
//  - empty fallback -> only a short cache, so we retry GDELT again soon.
function json(payload: EventsPayload) {
  const fresh = payload.items.length > 0;
  return Response.json(payload, {
    headers: {
      "Cache-Control": fresh
        ? "public, s-maxage=300, stale-while-revalidate=86400"
        : "public, s-maxage=20",
    },
  });
}

// Module-scope cache: protects GDELT when a warm instance fields several polls.
let cache: { at: number; payload: EventsPayload } | null = null;
const TTL_MS = 90_000; // serve fresh cache without re-hitting GDELT
const STALE_MS = 6 * 60 * 60_000; // on upstream failure, serve stale up to 6h

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return json(cache.payload);
  }

  try {
    let articles = await fetchArticles(THEME_QUERY);
    if (articles.length < 25) {
      try {
        const kw = await fetchArticles(KEYWORD_QUERY);
        if (kw.length > articles.length) articles = kw;
      } catch {
        /* keep whatever the themed query gave us */
      }
    }

    const payload: EventsPayload = {
      items: aggregate(articles),
      source: "gdelt",
      live: true,
      fetchedAt: new Date().toISOString(),
    };
    // only let a non-empty result become/replace the cache
    if (payload.items.length > 0 || !cache) cache = { at: now, payload };
    return json(payload);
  } catch (err) {
    if (cache && now - cache.at < STALE_MS) {
      return json({ ...cache.payload, source: "gdelt (cached)" });
    }
    return json({
      items: [],
      source: "fallback",
      live: false,
      fetchedAt: new Date().toISOString(),
      error: String(err),
    });
  }
}
