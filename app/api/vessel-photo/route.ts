// Real vessel photos via VesselFinder (the de-facto ship equivalent of
// planespotters). We look a vessel up by its exact AIS MMSI — VesselFinder
// redirects /vessels/details/{mmsi} to the canonical vessel page — and pull the
// main ship photo off that page. Falls back to a name search, then to "no
// photo". Coverage is broad (most commercial vessels have a photo); genuinely
// photo-less ships return null and the panel shows the blank plate.
//
// NOTE: this scrapes a public page rather than using an official API, so it can
// break if VesselFinder changes their markup or rate-limits datacenter IPs
// (e.g. on Vercel). The blank fallback keeps the UI safe if that happens.

export const revalidate = 0;
export const maxDuration = 15;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TTL = 24 * 60 * 60 * 1000;

export interface VesselPhoto {
  photo: { large: string; link: string; attribution: string } | null;
}

const cache = new Map<string, { data: VesselPhoto; ts: number }>();

const PHOTO_RE = /https:\/\/static\.vesselfinder\.net\/ship-photo\/[^"?\s]+/;
const DETAIL_RE = /\/vessels\/details\/[0-9]+/;

async function getHtml(url: string): Promise<{ html: string; url: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    return { html: await res.text(), url: res.url };
  } catch {
    return null;
  }
}

async function lookup(mmsi: string, name: string): Promise<VesselPhoto> {
  // 1) exact lookup by MMSI (VesselFinder redirects to the canonical page)
  let page = mmsi
    ? await getHtml(`https://www.vesselfinder.com/vessels/details/${mmsi}`)
    : null;

  // 2) fallback: search by name, follow the first vessel result
  if ((!page || !PHOTO_RE.test(page.html)) && name) {
    const search = await getHtml(
      `https://www.vesselfinder.com/vessels?name=${encodeURIComponent(name)}`
    );
    const path = search?.html.match(DETAIL_RE)?.[0];
    if (path) {
      const detail = await getHtml(`https://www.vesselfinder.com${path}`);
      if (detail && PHOTO_RE.test(detail.html)) page = detail;
    }
  }

  if (!page) return { photo: null };
  const photo = page.html.match(PHOTO_RE)?.[0];
  if (!photo) return { photo: null };

  return {
    photo: { large: photo, link: page.url, attribution: "VesselFinder" },
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mmsi = (searchParams.get("mmsi") ?? "").replace(/\D/g, "");
  const name = (searchParams.get("name") ?? "").trim();

  const key = mmsi || name.toLowerCase();
  if (!key || /^mmsi/i.test(name)) {
    return Response.json({ photo: null } satisfies VesselPhoto);
  }

  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    return Response.json(hit.data);
  }

  const data = await lookup(mmsi, name);
  cache.set(key, { data, ts: Date.now() });

  // hits stable for a day; misses retry within the hour
  const maxAge = data.photo ? 86400 : 3600;
  return Response.json(data, {
    headers: { "Cache-Control": `public, max-age=${maxAge}` },
  });
}
