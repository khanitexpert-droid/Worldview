import type {
  Earthquake,
  Fire,
  Flight,
  MilitaryBase,
  Ship,
  SatelliteTle,
  WorldEvent,
} from "./types";

export interface SatellitesResponse {
  items: SatelliteTle[];
  source: string;
  live: boolean;
  fetchedAt: string;
  counts: { LEO: number; GEO: number; total: number };
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const fetchFlights = () =>
  getJSON<{ items: Flight[]; source: string; live: boolean }>("/api/flights");
export const fetchShips = () => getJSON<{ items: Ship[] }>("/api/ships");
export const fetchSatellites = () =>
  getJSON<SatellitesResponse>("/api/satellites");
export const fetchEarthquakes = () =>
  getJSON<{ items: Earthquake[] }>("/api/earthquakes");
// Active fires / thermal anomalies — NASA FIRMS (VIIRS), relayed server-side so
// the FIRMS map key is never exposed to the browser.
export const fetchFires = () =>
  getJSON<{ items: Fire[]; source?: string }>("/api/fires");
// Bundled static snapshot of real OSM military bases (they don't move, so we
// don't poll an API for them). Wrapped to match the generic feed shape.
export const fetchBases = async () => ({
  items: await getJSON<MilitaryBase[]>("/military_bases.json"),
  source: "OPENSTREETMAP",
});
// Curated military vessels (NAVY SHIPS) — a static reference set, not live AIS.
export const fetchNavyShips = async () => ({
  items: (await import("./navalAssets")).NAVAL_ASSETS,
  source: "CURATED · USN",
});
// Read the events the scheduled GitHub Action publishes (relayed same-origin by
// /api/events). We do NOT fetch GDELT from the browser — its CORS on the JSON
// endpoint is unreliable and per-IP rate limits bite visitors.
export const fetchEvents = () =>
  getJSON<{ items: WorldEvent[]; source?: string }>("/api/events");
