import type { ActivityEvent } from "@/lib/types";
import { classifyTitle } from "@/lib/activity";

export const dynamic = "force-dynamic";

// ACTIVITY — live conflict/incident stream. Aggregated from free news RSS fetched
// per request (works from Vercel, unlike GDELT which permanently 429s datacenter
// IPs), then keyword-classified into STRIKE/AIR/NAVAL/GROUND/EXPLOSION/DIPLOMATIC.
// Always fresh — no GitHub Action / relay / data-branch dependency.
const FEEDS: { source: string; url: string }[] = [
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { source: "Times of Israel", url: "https://www.timesofisrael.com/feed/" },
  { source: "France 24", url: "https://www.france24.com/en/rss" },
];
const MAX = 40;
const CACHE_TTL = 180_000; // 3 min

let cache: { at: number; items: ActivityEvent[] } | null = null;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function tag(chunk: string, name: string): string {
  const m = chunk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  const cd = m[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return decode(cd ? cd[1] : m[1]);
}

function parse(xml: string, source: string): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  for (const chunk of xml.split("<item").slice(1)) {
    const body = chunk.split("</item>")[0];
    const title = tag(body, "title");
    const url = tag(body, "link");
    if (!title || !url) continue;
    const c = classifyTitle(title);
    if (!c) continue; // keep only conflict-classifiable headlines
    const t = Date.parse(tag(body, "pubDate") || tag(body, "dc:date"));
    out.push({
      id: url,
      category: c.category,
      severity: c.severity,
      title,
      url,
      domain: source,
      time: Number.isFinite(t) ? t : Date.now(),
    });
  }
  return out;
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<ActivityEvent[]> {
  const res = await fetch(feed.url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; WorldViewBot/1.0)" },
  });
  if (!res.ok) throw new Error(`${feed.source} ${res.status}`);
  return parse(await res.text(), feed.source);
}

function json(items: ActivityEvent[], sMaxAge: number) {
  return Response.json(
    { items, source: "RSS", live: items.length > 0, fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=600`,
      },
    }
  );
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL) return json(cache.items, 180);

  const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const merged = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));

  // de-dupe by title, newest first
  const seen = new Set<string>();
  const items = merged
    .sort((a, b) => b.time - a.time)
    .filter((h) => {
      const k = h.title.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX);

  if (items.length) {
    cache = { at: Date.now(), items };
    return json(items, 180);
  }
  if (cache) return json(cache.items, 60);
  return json([], 60);
}
