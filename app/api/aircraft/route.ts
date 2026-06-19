// Aircraft photo + metadata lookup, proxied from planespotters.net (free, no
// key required). Keyed by ICAO24 hex, with registration as a fallback. We cache
// per-aircraft in memory for a day since photos/metadata rarely change — this
// also keeps us well under planespotters' fair-use limits no matter how often
// users click around.

export const revalidate = 0;
export const maxDuration = 15;

const UA = "worldview-clone/1.0 (+https://worldview-henna.vercel.app)";
const TTL = 24 * 60 * 60 * 1000; // 1 day

export interface AircraftInfo {
  photo: {
    thumb: string;
    large: string;
    link: string;
    photographer: string;
  } | null;
  photoCount: number;
  link: string | null; // planespotters aircraft page (history/photos)
}

const cache = new Map<string, { data: AircraftInfo; ts: number }>();

interface PSPhoto {
  thumbnail?: { src: string };
  thumbnail_large?: { src: string };
  link?: string;
  photographer?: string;
}
interface PSResponse {
  photos?: PSPhoto[];
}

async function planespotters(path: string): Promise<PSPhoto[]> {
  const res = await fetch(`https://api.planespotters.net/pub/photos/${path}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`planespotters ${res.status}`);
  const json = (await res.json()) as PSResponse;
  return json.photos ?? [];
}

async function lookup(hex: string, reg: string): Promise<AircraftInfo> {
  let photos: PSPhoto[] = [];
  // hex is the most reliable key; fall back to registration if no hit.
  if (hex) {
    try {
      photos = await planespotters(`hex/${hex}`);
    } catch (e) {
      console.error("[aircraft] hex lookup failed", e);
    }
  }
  if (photos.length === 0 && reg) {
    try {
      photos = await planespotters(`reg/${encodeURIComponent(reg)}`);
    } catch (e) {
      console.error("[aircraft] reg lookup failed", e);
    }
  }

  const p = photos[0];
  return {
    photo: p
      ? {
          thumb: p.thumbnail?.src ?? p.thumbnail_large?.src ?? "",
          large: p.thumbnail_large?.src ?? p.thumbnail?.src ?? "",
          link: p.link ?? "",
          photographer: p.photographer ?? "unknown",
        }
      : null,
    photoCount: photos.length,
    link: hex ? `https://www.planespotters.net/hex/${hex.toUpperCase()}` : null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hex = (searchParams.get("hex") ?? "")
    .replace(/^~/, "") // strip TIS-B / non-ICAO marker
    .trim()
    .toLowerCase();
  const reg = (searchParams.get("reg") ?? "").trim();

  const key = hex || reg;
  if (!key) {
    return Response.json({ photo: null, photoCount: 0, link: null });
  }

  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) {
    return Response.json(hit.data);
  }

  const data = await lookup(hex, reg);
  cache.set(key, { data, ts: Date.now() });

  return Response.json(data, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
