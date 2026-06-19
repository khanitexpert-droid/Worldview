import type {
  Camera,
  Earthquake,
  Flight,
  RoadTraffic,
  Ship,
  SatelliteTle,
  WorldEvent,
} from "./types";
import { fetchGdeltEventsDirect } from "./gdelt";

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
export const fetchCctv = () => getJSON<{ items: Camera[] }>("/api/cctv");
export const fetchTraffic = () =>
  getJSON<{ items: RoadTraffic[] }>("/api/traffic");
// Prefer a direct browser fetch — the visitor's residential IP isn't throttled
// by GDELT the way Vercel's shared datacenter IP is. Fall back to the (CDN-cached)
// server route if the browser request is blocked or throttled.
export const fetchEvents = async (): Promise<{
  items: WorldEvent[];
  source?: string;
}> => {
  try {
    return await fetchGdeltEventsDirect();
  } catch {
    return getJSON<{ items: WorldEvent[]; source?: string }>("/api/events");
  }
};
