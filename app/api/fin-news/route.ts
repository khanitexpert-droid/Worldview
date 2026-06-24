import type { FinHeadline } from "@/lib/types";

export const dynamic = "force-dynamic";

// FIN NEWS — recent financial headlines for the MARKETS tab. Free CNBC RSS desks
// (no key), merged + de-duped server-side. Kept lean/clean, not an endless wall.
const FEEDS: { id: string; label: string }[] = [
  { id: "20910258", label: "MARKETS" },
  { id: "10000664", label: "FINANCE" },
  { id: "10001147", label: "BUSINESS" },
];
const MAX = 24;
const CACHE_TTL = 300_000; // 5 min — CNBC refreshes slowly; be gentle

let cache: { at: number; items: FinHeadline[] } | null = null;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// pull one tag's text out of an <item> chunk, unwrapping CDATA if present
function tag(chunk: string, name: string): string {
  const m = chunk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  const cd = m[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return decode(cd ? cd[1] : m[1]);
}

function parseItems(xml: string, source: string): FinHeadline[] {
  const out: FinHeadline[] = [];
  for (const chunk of xml.split("<item>").slice(1)) {
    const body = chunk.split("</item>")[0];
    const title = tag(body, "title");
    const url = tag(body, "link");
    if (!title || !url) continue;
    const t = Date.parse(tag(body, "pubDate"));
    out.push({
      id: tag(body, "guid") || url,
      title,
      url,
      source,
      time: Number.isFinite(t) ? t : Date.now(),
    });
  }
  return out;
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<FinHeadline[]> {
  const res = await fetch(
    `https://www.cnbc.com/id/${feed.id}/device/rss/rss.html`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; WorldViewBot/1.0)" },
    }
  );
  if (!res.ok) throw new Error(`cnbc ${feed.label} ${res.status}`);
  return parseItems(await res.text(), feed.label);
}

function json(items: FinHeadline[], sMaxAge: number) {
  return Response.json(
    { items, source: "CNBC", fetchedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=600`,
      },
    }
  );
}

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_TTL) return json(cache.items, 300);

  const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const merged = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));

  // de-dupe the same story appearing on multiple desks (by normalized title)
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
    return json(items, 300);
  }
  if (cache) return json(cache.items, 60);
  return json([], 60);
}
