import type { EventHeadline, WorldEvent } from "@/lib/types";
import { centroidFor } from "@/lib/countryCentroids";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// allow head-room for the 429 backoff-retry below (GDELT throttles to 1 req/5s)
export const maxDuration = 30;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GDELT DOC 2.0 — full-text news index, refreshed every 15 min, no key needed.
// (The old GEO 2.0 API that returned per-location GeoJSON has been retired —
// its endpoint now 404s — so we take the article list and cluster it ourselves
// by the article's source country.)
const GDELT = "https://api.gdeltproject.org/api/v2/doc/doc";
const UA = "WORLDVIEW/1.0 (+https://worldview-henna.vercel.app)";

// language-independent GDELT GKG themes: unrest / war / disaster / terror.
const THEME_QUERY =
  "(theme:PROTEST OR theme:ARMEDCONFLICT OR theme:NATURAL_DISASTER OR theme:TERROR)";
// keyword widener, only used if the themed feed comes back thin.
const KEYWORD_QUERY =
  "(protest OR clash OR attack OR strike OR explosion OR flood OR wildfire OR airstrike OR ceasefire OR evacuation OR sanctions)";

const MAX_HEADLINES = 12; // per country, kept in the detail panel

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language?: string;
  sourcecountry?: string;
}

interface EventsPayload {
  items: WorldEvent[];
  source: string;
  live: boolean;
  fetchedAt: string;
}

// "20260619T160000Z" -> epoch ms
function parseSeen(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s ?? "");
  if (!m) return Date.now();
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

// GDELT tokenises titles with spaces around punctuation ("Acht - Stunden - Tag",
// "word ?"). Tidy the obvious cases without mangling the text.
function cleanTitle(t: string): string {
  return (t ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?»)])/g, "$1")
    .replace(/([«(])\s+/g, "$1")
    .trim();
}

async function fetchArticles(
  query: string,
  retryOn429 = true
): Promise<GdeltArticle[]> {
  const u = new URL(GDELT);
  u.searchParams.set("query", query);
  u.searchParams.set("mode", "artlist");
  u.searchParams.set("format", "json");
  u.searchParams.set("maxrecords", "250");
  u.searchParams.set("timespan", "24h");
  u.searchParams.set("sort", "datedesc");

  const res = await fetch(u, {
    cache: "no-store",
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(8000),
  });
  // GDELT throttles to 1 request / 5 s per IP; on a throttle, wait it out once.
  if (res.status === 429 && retryOn429) {
    await sleep(5200);
    return fetchArticles(query, false);
  }
  if (!res.ok) throw new Error(`gdelt ${res.status}`);
  // GDELT returns a plain-text throttle notice (not JSON) when rate-limited.
  const text = await res.text();
  if (!text.trimStart().startsWith("{")) {
    throw new Error(`gdelt non-json: ${text.slice(0, 80)}`);
  }
  const data = JSON.parse(text) as { articles?: GdeltArticle[] };
  return data.articles ?? [];
}

function aggregate(articles: GdeltArticle[]): WorldEvent[] {
  const byCountry = new Map<string, WorldEvent>();

  for (const a of articles) {
    const country = (a.sourcecountry ?? "").trim();
    if (!country) continue;
    const c = centroidFor(country);
    if (!c) continue;

    const time = parseSeen(a.seendate);
    const headline: EventHeadline = {
      title: cleanTitle(a.title),
      url: a.url,
      domain: a.domain ?? "",
      time,
      language: a.language,
    };

    const ev = byCountry.get(country);
    if (ev) {
      ev.count++;
      if (time > ev.latest) ev.latest = time;
      ev.headlines.push(headline);
    } else {
      byCountry.set(country, {
        id: country.toLowerCase().replace(/[^a-z]+/g, "-"),
        name: country,
        lon: c[0],
        lat: c[1],
        count: 1,
        latest: time,
        headlines: [headline],
      });
    }
  }

  const items = [...byCountry.values()].map((ev) => ({
    ...ev,
    headlines: ev.headlines.sort((a, b) => b.time - a.time).slice(0, MAX_HEADLINES),
  }));
  items.sort((a, b) => b.count - a.count); // biggest hotspots first
  return items;
}

// Module-scope cache: protects GDELT's 1-request-per-5-seconds limit when the
// lambda is warm and several clients poll at once. Survives only within a warm
// instance, which is exactly the burst window we care about.
let cache: { at: number; payload: EventsPayload } | null = null;
const TTL_MS = 90_000; // serve fresh cache without re-hitting GDELT
const STALE_MS = 30 * 60_000; // on upstream failure, serve stale up to 30 min

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return Response.json(cache.payload);
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
    cache = { at: now, payload };
    return Response.json(payload);
  } catch (err) {
    // upstream down / throttled — serve the last good payload if we have one
    if (cache && now - cache.at < STALE_MS) {
      return Response.json({ ...cache.payload, source: "gdelt (cached)" });
    }
    return Response.json({
      items: [],
      source: "fallback",
      live: false,
      fetchedAt: new Date().toISOString(),
      error: String(err),
    });
  }
}
