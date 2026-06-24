export const dynamic = "force-dynamic";

// LIVE TV — resolves a news channel's *current* YouTube live video id by reading
// its public /live page (the canonical link points at whatever is streaming now,
// so it survives stream restarts). No API key. Cached per channel.
const CHANNELS: Record<string, { label: string; handle: string }> = {
  aljazeera: { label: "Al Jazeera", handle: "aljazeeraenglish" },
  france24: { label: "France 24", handle: "France24_en" },
  skynews: { label: "Sky News", handle: "skynews" },
  dw: { label: "DW News", handle: "DWNews" },
  euronews: { label: "Euronews", handle: "euronews" },
  trtworld: { label: "TRT World", handle: "trtworld" },
  i24news: { label: "i24NEWS", handle: "i24NEWS_EN" },
  abcnews: { label: "ABC News", handle: "ABCNews" },
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124 Safari/537.36";
const CACHE_TTL = 600_000; // 10 min per channel
const cache = new Map<string, { at: number; videoId: string }>();

function json(
  payload: { channel: string; label: string; videoId: string | null; error?: string },
  sMaxAge: number
) {
  return Response.json(payload, {
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=600`,
    },
  });
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("channel") || "aljazeera";
  const ch = CHANNELS[key];
  if (!ch) return Response.json({ error: "unknown channel" }, { status: 404 });

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL)
    return json({ channel: key, label: ch.label, videoId: hit.videoId }, 600);

  try {
    const res = await fetch(`https://www.youtube.com/@${ch.handle}/live`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) throw new Error(`youtube ${res.status}`);
    const html = await res.text();
    const m =
      html.match(
        /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/
      ) || html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    const videoId = m?.[1];
    if (!videoId) throw new Error("no live stream found");
    cache.set(key, { at: Date.now(), videoId });
    return json({ channel: key, label: ch.label, videoId }, 600);
  } catch (err) {
    // serve last good id if we have one, else signal "offline" to the client
    if (hit) return json({ channel: key, label: ch.label, videoId: hit.videoId }, 60);
    return json(
      { channel: key, label: ch.label, videoId: null, error: String(err) },
      30
    );
  }
}
