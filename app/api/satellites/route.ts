import * as satellite from "satellite.js";
import type { SatelliteTle, SatOrbit } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Cold start with an empty cache pulls a ~2 MB catalogue and builds ~12k
// satrecs, so give the function more than Vercel's 10s default. (Vercel honours
// this up to the plan's max; warm requests hit the in-memory cache instantly.)
export const maxDuration = 30;

// --- open-data sources, in priority order -------------------------------------
// 1) CelesTrak "active" group — the authoritative, complete catalogue of every
//    active satellite (~11k, LEO→GEO). Free, no key. Works from most hosts but
//    CelesTrak blocks some datacenter ASNs, so we keep a fallback.
// 2) celestrak-mirror — a community GitHub Actions mirror that re-fetches the
//    CelesTrak GP groups every ~30 min from un-blocked runner IPs and serves
//    them via raw.githubusercontent.com (reachable from anywhere). We stitch the
//    LEO/GEO-bearing groups together. Slightly less complete than "active" but
//    universally reachable.
// Either way we only KEEP what classifies as LEO or GEO; the client propagates.
const ACTIVE_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";
const MIRROR_BASE =
  "https://raw.githubusercontent.com/astrion-tech/celestrak-mirror/main/tle";
const MIRROR_GROUPS = [
  "starlink",
  "oneweb",
  "geo",
  "stations",
  "science",
  "weather",
  "resource",
  "military",
];
const UA = "worldview-clone/1.0 (orbital-viz)";

const RE_KM = 6378.137; // Earth equatorial radius (satrec distances are in earth radii)

interface SatPayload {
  items: SatelliteTle[];
  source: string;
  live: boolean;
  fetchedAt: string;
  counts: { LEO: number; GEO: number; total: number };
}

// CelesTrak asks clients to cache and not re-pull more than ~once every couple
// of hours; TLEs only change ~daily. The client loads once per session, and this
// in-memory cache keeps repeated cold starts from re-hammering the upstreams.
let CACHE: { at: number; data: SatPayload } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Classify an initialised satrec by its orbit geometry. We only keep LEO and
 * GEO (the user asked for those two); MEO/HEO and anything ambiguous is dropped.
 * Classification is purely geometric, so it's correct regardless of which named
 * group a satellite arrived in (e.g. a GOES weather sat still reads as GEO).
 */
function classify(satrec: satellite.SatRec): {
  orbit: SatOrbit | null;
  altKm: number;
} {
  // satrec distances (a, alta, altp) are in earth radii; no is rad/min.
  const revPerDay = (satrec.no * 1440) / (2 * Math.PI);
  const meanAltKm = (satrec.a - 1) * RE_KM;
  const perigeeKm = satrec.altp * RE_KM;
  const apogeeKm = satrec.alta * RE_KM;

  // LEO: low, near-circular orbit that stays below ~2,000 km.
  if (perigeeKm < 2000 && apogeeKm < 2000) {
    return { orbit: "LEO", altKm: Math.round(meanAltKm) };
  }
  // GEO / near-geosynchronous: ~1 revolution/day, ~35,786 km, near-circular.
  if (
    revPerDay > 0.9 &&
    revPerDay < 1.1 &&
    Math.abs(meanAltKm - 35786) < 2000 &&
    satrec.ecco < 0.1
  ) {
    return { orbit: "GEO", altKm: Math.round(meanAltKm) };
  }
  return { orbit: null, altKm: Math.round(meanAltKm) };
}

/** Split CelesTrak's 3-line element text into { name, l1, l2 } blocks. */
function parse3le(text: string): { name: string; l1: string; l2: string }[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: { name: string; l1: string; l2: string }[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim();
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (l1.startsWith("1 ") && l2.startsWith("2 ")) {
      out.push({ name, l1, l2 });
    }
  }
  return out;
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function fetchActive(): Promise<string> {
  // keep this well under maxDuration so a slow/blocked CelesTrak still leaves
  // time to fall through to the mirror within the function budget.
  return fetchText(ACTIVE_URL, 8000);
}

/** Fetch the mirror's LEO/GEO groups in parallel and stitch them together. */
async function fetchMirror(): Promise<string> {
  const settled = await Promise.allSettled(
    MIRROR_GROUPS.map((g) => fetchText(`${MIRROR_BASE}/${g}.tle`, 8000))
  );
  const texts = settled
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value);
  if (texts.length === 0) throw new Error("mirror: all groups failed");
  return texts.join("\n");
}

function build(text: string, source: string): SatPayload {
  const blocks = parse3le(text);
  const items: SatelliteTle[] = [];
  const seen = new Set<string>(); // dedupe (a sat can appear in >1 mirror group)
  let leo = 0;
  let geo = 0;

  for (const t of blocks) {
    let satrec: satellite.SatRec;
    try {
      satrec = satellite.twoline2satrec(t.l1, t.l2);
    } catch {
      continue; // unparseable element set
    }
    // twoline2satrec runs an init propagation; a non-zero error means the orbit
    // is decayed / degenerate, so skip it.
    if (!satrec || satrec.error) continue;
    if (seen.has(satrec.satnum)) continue;

    const { orbit, altKm } = classify(satrec);
    if (!orbit) continue;

    seen.add(satrec.satnum);
    items.push({ id: satrec.satnum, name: t.name, l1: t.l1, l2: t.l2, orbit, altKm });
    if (orbit === "LEO") leo++;
    else geo++;
  }

  // GEO last so the (sparse) belt draws on top of the dense LEO swarm.
  items.sort((a, b) => a.altKm - b.altKm);

  return {
    items,
    source,
    live: true,
    fetchedAt: new Date().toISOString(),
    counts: { LEO: leo, GEO: geo, total: items.length },
  };
}

export async function GET() {
  if (CACHE && Date.now() - CACHE.at < TTL_MS) {
    return Response.json({ ...CACHE.data, source: "cache" });
  }

  // 1) authoritative source
  try {
    const data = build(await fetchActive(), "celestrak");
    if (data.items.length > 0) {
      CACHE = { at: Date.now(), data };
      return Response.json(data);
    }
  } catch {
    /* fall through to the mirror */
  }

  // 2) universally-reachable mirror
  try {
    const data = build(await fetchMirror(), "celestrak-mirror");
    CACHE = { at: Date.now(), data };
    return Response.json(data);
  } catch (err) {
    // 3) serve the last good catalogue if we have one, even if it's stale
    if (CACHE) {
      return Response.json({ ...CACHE.data, source: "cache-stale", live: false });
    }
    return Response.json({
      items: [],
      source: "fallback",
      live: false,
      fetchedAt: new Date().toISOString(),
      counts: { LEO: 0, GEO: 0, total: 0 },
      error: String(err),
    });
  }
}
