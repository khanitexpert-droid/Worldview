import type { ActivityEvent } from "@/lib/types";
import { classifyTitle } from "@/lib/activity";
import { geolocate } from "@/lib/places";
import { fetchTelegramPosts } from "@/lib/telegramFeed";

export const dynamic = "force-dynamic";

// ACTIVITY — live conflict/incident stream. Aggregated from free news RSS fetched
// per request (works from Vercel, unlike GDELT which permanently 429s datacenter
// IPs), then keyword-classified into STRIKE/AIR/NAVAL/GROUND/EXPLOSION/DIPLOMATIC.
// Always fresh — no GitHub Action / relay / data-branch dependency.
const FEEDS: { source: string; url: string }[] = [
  { source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { source: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { source: "France 24", url: "https://www.france24.com/en/rss" },
  { source: "Times of Israel", url: "https://www.timesofisrael.com/feed/" },
  { source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { source: "Naval News", url: "https://www.navalnews.com/feed/" },
  { source: "The War Zone", url: "https://www.twz.com/feed" },
  { source: "Military Times", url: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml" },
];
const MAX = 50;
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

// pull a thumbnail URL from common RSS image fields (Media RSS / enclosure / img)
function imageOf(body: string): string | undefined {
  const m =
    body.match(/<media:thumbnail[^>]*\burl="([^"]+)"/i) ||
    body.match(/<media:content[^>]*\burl="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
    body.match(/<enclosure[^>]*\burl="([^"]+)"[^>]*type="image/i) ||
    body.match(/<img[^>]*\bsrc="([^"]+)"/i);
  return m ? m[1] : undefined;
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
    const g = geolocate(title);
    out.push({
      id: url,
      category: c.category,
      severity: c.severity,
      title,
      url,
      domain: source,
      time: Number.isFinite(t) ? t : Date.now(),
      lat: g?.lat,
      lon: g?.lon,
      place: g?.name,
      image: imageOf(body),
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

// collapse a multi-line social post into a single clean headline line, and
// scrub source fingerprints (@channel sign-offs, t.me links, "subscribe" CTAs)
// so a post can't be traced back to its Telegram channel.
function headline(text: string, max = 160): string {
  const one = text
    .replace(/https?:\/\/t\.me\/\S+/gi, "")
    .replace(/@[A-Za-z0-9_]+/g, "")
    .replace(/\b(subscribe|join|follow)\b[^.!?]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return one.length > max ? one.slice(0, max - 1).trimEnd() + "…" : one;
}

// Live social-OSINT posts, classified into the same categories as the RSS feed
// and merged into the stream. Source is deliberately shown as generic "OSINT" —
// the channel/platform name is not surfaced. Only conflict-classifiable posts
// are kept (same rule the RSS items follow), so the feed stays coherent.
async function fetchOsint(): Promise<ActivityEvent[]> {
  const posts = await fetchTelegramPosts(60);
  const out: ActivityEvent[] = [];
  for (const p of posts) {
    const c = classifyTitle(p.text);
    if (!c) continue;
    const g = geolocate(p.text);
    out.push({
      id: p.url,
      category: c.category,
      severity: c.severity,
      title: headline(p.text),
      url: p.url,
      domain: "OSINT", // hide the telegram/channel source
      time: p.ts || Date.now(),
      lat: g?.lat,
      lon: g?.lon,
      place: g?.name,
      image: p.photo,
    });
  }
  return out;
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

  const settled = await Promise.allSettled([
    ...FEEDS.map(fetchFeed),
    fetchOsint(),
  ]);
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
