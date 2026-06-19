// Shared types for WORLDVIEW data feeds.

export type LayerId =
  | "flights"
  | "satellites"
  | "earthquakes"
  | "ships"
  | "cctv"
  | "traffic";

export interface Flight {
  id: string;
  callsign: string;
  lon: number;
  lat: number;
  altitude: number; // meters
  heading: number; // degrees (true track)
  velocity: number; // m/s (ground speed)
  verticalRate: number; // m/s (+climb / -descent)
  onGround: boolean;
  country: string; // origin country (may be "" for ADS-B sources)
  timePosition: number; // epoch ms of this position fix (for accurate propagation)
  aircraftType?: string; // e.g. "AIRBUS A-320neo" / "A20N"
  registration?: string; // e.g. "G-UZHK"
}

/** Orbit class we render. We deliberately track only LEO + GEO. */
export type SatOrbit = "LEO" | "GEO";

/** A satellite as it appears on the globe / in the detail panel. */
export interface Satellite {
  id: string; // NORAD catalog number
  name: string;
  lon: number;
  lat: number;
  altKm: number;
  orbit: SatOrbit;
}

/**
 * Raw orbital element set served by /api/satellites. The client builds a
 * propagator from the TLE lines and animates the satellite itself, so the
 * server never ships per-frame positions — only the (slowly changing) TLEs.
 */
export interface SatelliteTle {
  id: string; // NORAD catalog number
  name: string;
  l1: string; // TLE line 1
  l2: string; // TLE line 2
  orbit: SatOrbit;
  altKm: number; // mean altitude, for the detail panel / sorting
}

export interface Earthquake {
  id: string;
  place: string;
  mag: number;
  lon: number;
  lat: number;
  depth: number; // km
  time: number; // epoch ms
}

export interface Ship {
  id: string;
  name: string;
  lon: number;
  lat: number;
  heading: number; // course over ground (deg)
  type: string;
  speed: number; // knots (speed over ground)
  status?: string; // navigational status, e.g. "UNDER WAY"
  destination?: string;
  flag?: string; // country derived from MMSI MID
  timePosition?: number; // epoch ms of this fix (for accurate propagation)
  // ---- static-message particulars (only present when the vessel has recently
  // broadcast an AIS type-5 message during the snapshot window) ----
  imo?: number;
  callsign?: string;
  length?: number; // metres (bow-to-stern, from AIS dimensions)
  beam?: number; // metres (width)
  draught?: number; // metres
  eta?: string; // formatted estimated time of arrival
}

export interface Camera {
  id: string;
  name: string;
  lon: number;
  lat: number;
  status: "ONLINE" | "OFFLINE";
}

export interface RoadTraffic {
  id: string;
  lon: number;
  lat: number;
  level: "FREE" | "MODERATE" | "HEAVY" | "JAM";
  road: string;
}

export type FeedEntity =
  | ({ kind: "flights" } & Flight)
  | ({ kind: "satellites" } & Satellite)
  | ({ kind: "earthquakes" } & Earthquake)
  | ({ kind: "ships" } & Ship)
  | ({ kind: "cctv" } & Camera)
  | ({ kind: "traffic" } & RoadTraffic);
