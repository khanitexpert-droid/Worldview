import type {
  Camera,
  Earthquake,
  Flight,
  RoadTraffic,
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
export const fetchCctv = () => getJSON<{ items: Camera[] }>("/api/cctv");
export const fetchTraffic = () =>
  getJSON<{ items: RoadTraffic[] }>("/api/traffic");
// Read the events the scheduled GitHub Action publishes (relayed same-origin by
// /api/events). We do NOT fetch GDELT from the browser — its CORS on the JSON
// endpoint is unreliable and per-IP rate limits bite visitors.
export const fetchEvents = () =>
  getJSON<{ items: WorldEvent[]; source?: string }>("/api/events");
