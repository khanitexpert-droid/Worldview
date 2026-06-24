import type { CaspianReport } from "@/lib/types";

export const dynamic = "force-dynamic";

// CASPIAN — rolling geopolitical report feed. Aggregated from free world/
// geopolitics RSS (no key), merged + de-duped server-side. deltasweep uses paid
// STRATFOR; this is the real free equivalent.
const FEEDS: { source: string; url: string }[] = [
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { source: "France 24", url: "https://www.france24.com/en/rss" },
  { source: "DW", url: "https://rss.dw.com/xml/rss-en-world" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
];
const MAX = 36;
const SUMMARY_MAX = 240;
const CACHE_TTL = 300_000; // 5 min

let cache: { at: number; items: CaspianReport[] } | null = null;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

const stripHtml = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

// pull one tag's text from an <item> chunk, unwrapping CDATA
function tag(chunk: string, name: string): string {
  const m = chunk.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  if (!m) return "";
  const cd = m[1].match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return decode(cd ? cd[1] : m[1]);
}

function parseItems(xml: string, source: string): CaspianReport[] {
  const out: CaspianReport[] = [];
  // split on "<item" so it matches both <item> and <item rdf:about="…">
  for (const chunk of xml.split("<item").slice(1)) {
    const body = chunk.split("</item>")[0];
    const title = tag(body, "title");
    const url = tag(body, "link");
    if (!title || !url) continue;
    const t = Date.parse(tag(body, "pubDate") || tag(body, "dc:date"));
    const rawSummary = tag(body, "description") || tag(body, "summary");
    let summary = stripHtml(rawSummary);
    if (summary.length > SUMMARY_MAX) summary = summary.slice(0, SUMMARY_MAX - 1) + "…";
    out.push({
      id: tag(body, "guid") || url,
      title,
      url,
      source,
      time: Number.isFinite(t) ? t : Date.now(),
      summary,
    });
  }
  return out;
}

async function fetchFeed(feed: (typeof FEEDS)[number]): Promise<CaspianReport[]> {
  const res = await fetch(feed.url, {
    cache: "no-store",
    signal: AbortSignal.timeout(9000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; WorldViewBot/1.0)" },
  });
  if (!res.ok) throw new Error(`${feed.source} ${res.status}`);
  return parseItems(await res.text(), feed.source);
}

function json(items: CaspianReport[], sMaxAge: number) {
  return Response.json(
    { items, source: "RSS", fetchedAt: new Date().toISOString() },
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

  const seen = new Set<string>();
  const items = merged
    .sort((a, b) => b.time - a.time)
    .filter((r) => {
      const k = r.title.toLowerCase();
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
