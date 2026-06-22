// Shared types for WORLDVIEW data feeds.

export type LayerId =
  | "flights"
  | "satellites"
  | "earthquakes"
  | "ships"
  | "bases"
  | "fires"
  | "events"
  | "photoreal";

/** A user-imported GIS layer (drag-dropped GeoJSON / Shapefile / KML / GeoTIFF). */
export interface UserLayer {
  id: string;
  name: string;
  kind: "vector" | "raster";
  format: "geojson" | "shapefile" | "kml" | "geotiff";
  visible: boolean;
  opacity: number; // 0..1
  color: string; // css hex (vector styling)
  featureCount?: number; // vector
  note?: string; // e.g. dimensions for raster
}

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

/** One news article in a world-event cluster (parsed from the GDELT DOC feed). */
export interface EventHeadline {
  title: string;
  url: string;
  domain: string;
  time: number; // epoch ms (parsed from GDELT seendate)
  language?: string;
}

/**
 * A cluster of "world event" news coverage, aggregated by the source country of
 * the reporting outlets (GDELT classifies each article's media origin). Plotted
 * as a single node at the country centroid, sized by how many articles cite it.
 */
export interface WorldEvent {
  id: string; // country slug, e.g. "united-states" (stable key)
  name: string; // country name, e.g. "Ukraine"
  lon: number; // country centroid
  lat: number;
  count: number; // number of matching articles from this origin
  latest: number; // most recent epoch ms across this country's articles
  headlines: EventHeadline[]; // top headlines, most recent first
}

/** A military installation (real, sourced from OpenStreetMap `military=*`). */
export interface MilitaryBase {
  id: string;
  name: string;
  lon: number;
  lat: number;
  branch: "BASE" | "NAVAL" | "AIR"; // ground base / naval base / air base
  country?: string; // country the base sits in (absent if offshore/disputed)
  operator?: string; // operating force, when OSM records it
}

/** An active-fire / thermal-anomaly detection (real, from NASA FIRMS · VIIRS). */
export interface Fire {
  id: string;
  lon: number;
  lat: number;
  brightness: number; // brightness temperature (Kelvin), VIIRS channel I-4
  frp: number; // fire radiative power (MW) — proxy for fire intensity
  confidence: string; // VIIRS: "low" | "nominal" | "high"
  satellite: string; // e.g. "N" (Suomi-NPP) / "1" (NOAA-20)
  daynight: string; // "D" | "N"
  acq: number; // epoch ms of the detection (acq_date + acq_time)
}

export type FeedEntity =
  | ({ kind: "flights" } & Flight)
  | ({ kind: "satellites" } & Satellite)
  | ({ kind: "earthquakes" } & Earthquake)
  | ({ kind: "ships" } & Ship)
  | ({ kind: "bases" } & MilitaryBase)
  | ({ kind: "fires" } & Fire)
  | ({ kind: "events" } & WorldEvent);
