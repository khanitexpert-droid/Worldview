// Shared types for WORLDVIEW data feeds.

export type LayerId =
  | "flights"
  | "satellites"
  | "earthquakes"
  | "ships"
  | "bases"
  | "fires"
  | "events"
  | "photoreal"
  | "bathymetry"
  | "navyShips"
  | "shippingRoutes"
  | "strikes"
  // ---- ENVIRO group ----
  | "waterstress"
  | "majorrivers"
  | "landcover"
  // ---- INFRA group (deltasweep parity) ----
  | InfraPointKind
  | InfraLineKind
  | "gdp";

/**
 * INFRA point layers — every one is a fixed geolocated site, so they all share
 * the generic `InfraSite` shape (below) and only differ by category color/icon.
 * ENERGY: lng / nuclear / oilgas / refineries. CIVILIAN: airports / minerals /
 * datacenters / desal / ports.
 */
export type InfraPointKind =
  | "lng"
  | "nuclear"
  | "oilgas"
  | "refineries"
  | "airports"
  | "minerals"
  | "datacenters"
  | "desal"
  | "ports";

/** INFRA line layers — drawn as polylines (routes), not points. */
export type InfraLineKind = "pipelines" | "cables";

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

/**
 * A single tradable instrument for the MARKETS panel (deltasweep-style ticker
 * board, cleaner layout). Quoted via Yahoo Finance's public chart endpoint — no
 * API key. HUD-only (not plotted on the globe), so intentionally NOT part of
 * LayerId / FeedEntity.
 */
export interface MarketQuote {
  symbol: string; // Yahoo symbol, e.g. "CL=F"
  label: string; // display name, e.g. "Crude Oil · WTI"
  group: string; // section header, e.g. "ENERGY"
  price: number;
  changePct: number; // % vs previous close
  spark: number[]; // downsampled intraday closes for the sparkline
}

/**
 * A prediction-market line for the NEWS tab. Real-money odds via Kalshi's public
 * events API (no key). For a multi-outcome event we surface the leading outcome.
 */
export interface PredictionMarket {
  id: string; // Kalshi event ticker (stable key)
  title: string; // the event question
  outcome?: string; // leading outcome label (multi-outcome events only)
  prob: number; // 0..1 YES probability of the shown market
  volume: number; // traded contract volume (activity proxy)
  category: string; // Kalshi category, e.g. "Politics"
}

/**
 * A missile in the MISSILES reference catalog. Curated open-source specs (not a
 * live feed) — operator arsenals with class, range, payload, status. The globe
 * draws a range ring per missile, centered on its operator's origin.
 */
export interface MissileSpec {
  id: string;
  name: string;
  operator: string; // "Iran" | "Israel" (extensible)
  category: string; // "Cruise" | "SRBM" | "IRBM" | "ICBM" | "Loitering" …
  rangeKm: number;
  payloadKg?: number;
  status: "OPERATIONAL" | "RETIRED" | "REPORTED" | "DEVELOPMENT";
  note?: string;
}

/** ACTIVITY conflict categories (deltasweep parity). */
export type ActivityCategory =
  | "STRIKE"
  | "AIR"
  | "NAVAL"
  | "GROUND"
  | "EXPLOSION"
  | "DIPLOMATIC";

/**
 * One OSINT conflict/incident for the ACTIVITY feed. Derived from GDELT conflict
 * coverage (theme:ARMEDCONFLICT/TERROR), classified into a category + a
 * keyword-heuristic severity. HUD-only (not a globe layer).
 */
export interface ActivityEvent {
  id: string; // article url (stable de-dupe key)
  category: ActivityCategory;
  severity: "LOW" | "MEDIUM" | "HIGH"; // keyword heuristic (not curated)
  title: string;
  url: string;
  domain: string; // reporting outlet
  time: number; // epoch ms (GDELT seendate)
  lat?: number; // detected location (country / city / area level)
  lon?: number;
  place?: string; // detected location name
  image?: string; // thumbnail from the RSS item, if present
}

/**
 * A geopolitical report card for the CASPIAN feed — aggregated from free
 * world/geopolitics RSS (Al Jazeera, France 24, DW, The Guardian). Richer than a
 * bare headline: carries a short summary, like deltasweep's report feed.
 */
export interface CaspianReport {
  id: string;
  title: string;
  url: string;
  source: string; // outlet, e.g. "Al Jazeera"
  time: number; // epoch ms (parsed from pubDate / dc:date)
  summary: string; // short plain-text summary (HTML-stripped RSS description)
}

/** A financial headline for the MARKETS tab's FIN NEWS feed (free CNBC RSS). */
export interface FinHeadline {
  id: string; // RSS guid (stable de-dupe key)
  title: string;
  url: string;
  source: string; // CNBC desk: "MARKETS" | "FINANCE" | "BUSINESS"
  time: number; // epoch ms (parsed from pubDate)
}

/**
 * A curated military vessel for the NAVY SHIPS layer (SEA). Public class/role data
 * (USN / Naval Vessel Register) + an approximate last-reported position — NOT live
 * AIS (navies don't broadcast). Mirrors deltasweep's "curated military vessel".
 */
export interface NavyShip {
  id: string;
  name: string; // "USS Michael Murphy (DDG-112)"
  hull: string; // "DDG-112"
  shipClass: string; // "Arleigh Burke-class destroyer"
  fleetGroup: string; // "Escort" | "Carrier Strike Group" | "Amphibious Ready Group"…
  role: string;
  crew?: string;
  displacement?: string;
  embarked?: string[];
  operator: string; // "USN"
  lon: number;
  lat: number;
  asOf?: string; // last-reported date
  wiki?: string; // Wikipedia page title (used to pull a photo in the detail card)
}

/**
 * A fixed infrastructure site — the shared shape for all 9 INFRA *point* layers
 * (LNG, nuclear, oil & gas, refineries, airports, minerals, data centers,
 * desalination, ports). Only a name + position are required; the rest are
 * optional descriptive fields the detail card prints when present, so one shape
 * covers every category. Real/curated open data (OSM, OurAirports, NGA, OSINT).
 */
export interface InfraSite {
  id: string;
  name: string;
  lon: number;
  lat: number;
  country?: string;
  status?: string; // "Operating" | "Existing" | "Construction" | "Planned" …
  operator?: string;
  stype?: string; // sub-type label, e.g. "Import Terminal" / "fuel cycle" / "Major Hub"
  capacity?: string; // free-form, e.g. "75 MW" / "1.2 Mtpa" / "320k bpd"
  code?: string; // identifier, e.g. IATA/ICAO / UN-LOCODE / commodity
  note?: string; // one-line description shown in the card footer
}

/** A routed infrastructure line — pipelines and submarine cables (polylines). */
export interface InfraLine {
  id: string;
  name: string;
  lon: number; // representative midpoint (for the detail card / fly-to)
  lat: number;
  paths: number[][][]; // MultiLineString: array of [ [lon,lat], … ] segments
  status?: string;
  operator?: string;
  length?: string; // free-form, e.g. "1,200 km"
  code?: string;
  note?: string;
  country?: string;
}

/**
 * A military strike / kinetic event (GROUND layer, deltasweep-style). Curated
 * real OSINT — notable strikes across the Iran/Israel/US/Gulf theatre — plotted
 * at the impact location with a source link. Not a live feed (events are
 * historical/verified), so it's a bundled snapshot.
 */
export interface StrikeEvent {
  id: string;
  name: string; // headline
  lon: number;
  lat: number;
  time: number; // epoch ms (event date)
  stype: string; // strike type, e.g. "Ballistic Missile Strike" / "Airstrike"
  actor: string; // attacking force, e.g. "Israel" / "Iran" / "United States"
  target: string; // e.g. "nuclear facility" / "military base" / "shipping"
  fatalities?: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  source: string; // outlet
  url: string; // VIEW SOURCE link
  country?: string; // location country
  note?: string; // short description
}

/**
 * A water-risk basin for the Water Stress choropleth (ENVIRO). WRI Aqueduct 4.0
 * baseline water risk aggregated to a HydroSHEDS L6 basin — drawn as filled
 * polygons shaded by score, with a "// WATER RISK" detail card.
 */
export interface WaterRisk {
  id: string;
  name: string; // basin / nearest place label
  lon: number; // centroid (fly-to / detail)
  lat: number;
  polygons: number[][][]; // array of rings, each [ [lon,lat], … ]
  score: number; // 0..5 aggregated baseline water risk
  label: string; // band, e.g. "Extremely High (4-5)"
  country?: string;
}

/** One country's GDP-per-capita value for the choropleth layer. */
export interface GdpDatum {
  id: string; // ISO-A3
  name: string; // country name
  lon: number; // country centroid (for fly-to / detail)
  lat: number;
  value: number; // GDP per capita, current US$
  year?: number;
}

export type FeedEntity =
  | ({ kind: "flights" } & Flight)
  | ({ kind: "satellites" } & Satellite)
  | ({ kind: "earthquakes" } & Earthquake)
  | ({ kind: "ships" } & Ship)
  | ({ kind: "bases" } & MilitaryBase)
  | ({ kind: "navyShips" } & NavyShip)
  | ({ kind: "fires" } & Fire)
  | ({ kind: "events" } & WorldEvent)
  | ({ kind: "strikes" } & StrikeEvent)
  // ---- ENVIRO ----
  | ({ kind: "waterstress" } & WaterRisk)
  | ({ kind: "majorrivers" } & InfraLine)
  // ---- INFRA ----
  | ({ kind: InfraPointKind } & InfraSite)
  | ({ kind: InfraLineKind } & InfraLine)
  | ({ kind: "gdp" } & GdpDatum);
