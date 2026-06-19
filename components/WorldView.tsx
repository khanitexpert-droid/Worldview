"use client";

import "@/lib/cesiumBase";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorldView } from "@/lib/store";
import { LAYERS } from "@/lib/layers";
import {
  fetchCctv,
  fetchEarthquakes,
  fetchEvents,
  fetchFlights,
  fetchShips,
  fetchSatellites,
  fetchTraffic,
} from "@/lib/feeds";
import type {
  Flight,
  Ship,
  FeedEntity,
  LayerId,
  WorldEvent,
} from "@/lib/types";
import { SatelliteField } from "@/lib/satField";
import { EventFx } from "@/lib/eventFx";
import { MapLabels } from "@/lib/mapLabels";

import TopBar from "./hud/TopBar";
import Controls from "./hud/Controls";
import StatusBar from "./hud/StatusBar";
import RightRail from "./hud/RightRail";

// ---- palette ----
const C = {
  magenta: Cesium.Color.fromCssColorString("#ff2d95"),
  cyan: Cesium.Color.fromCssColorString("#00e5ff"),
  violet: Cesium.Color.fromCssColorString("#b14bff"),
  amber: Cesium.Color.fromCssColorString("#ffb347"),
  red: Cesium.Color.fromCssColorString("#ff414e"),
  green: Cesium.Color.fromCssColorString("#5dff9e"),
  gold: Cesium.Color.fromCssColorString("#ffe14d"),
  muted: Cesium.Color.fromCssColorString("#6c5b8c"),
};
// magenta airplane glyph (drawn pointing "up"/north; each plane's billboard
// is rotated to its heading). Baked colors + thin dark outline for contrast
// against bright parts of the globe.
const PLANE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
  "<path d='M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' " +
  "fill='#ff2d95' stroke='#2a0418' stroke-width='0.7' stroke-linejoin='round'/></svg>";
const PLANE_IMAGE = `data:image/svg+xml,${encodeURIComponent(PLANE_SVG)}`;

// vessel hull pointing "up" (north); each ship's billboard is rotated to its
// course over ground. Filled white + dark outline so it can be tinted per
// vessel type via the billboard's `color` (white × tint = tint).
const SHIP_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
  "<path d='M12 2 L17 9 L16 21 L8 21 L7 9 Z' " +
  "fill='#ffffff' stroke='#06303a' stroke-width='1.2' stroke-linejoin='round'/></svg>";
const SHIP_IMAGE = `data:image/svg+xml,${encodeURIComponent(SHIP_SVG)}`;
// non-directional marker for stationary (moored/anchored) vessels — a course
// arrow would be meaningless at zero speed, so show a simple dot instead.
const SHIP_DOT_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
  "<circle cx='12' cy='12' r='6' fill='#ffffff' stroke='#06303a' stroke-width='1.4'/></svg>";
const SHIP_DOT_IMAGE = `data:image/svg+xml,${encodeURIComponent(SHIP_DOT_SVG)}`;
// below this ground speed (m/s ≈ 0.6 kn) a vessel is treated as stationary
const SHIP_MOVING_MS = 0.3;

// satellites are propagated client-side every frame by SatelliteField, so they
// opt out of the generic poll/render pipeline entirely.
type PollLayerId = Exclude<LayerId, "satellites">;

const POLL_MS: Record<PollLayerId, number> = {
  flights: 15000,
  // ships refresh slowly upstream (VesselAPI free-tier quota) and the client
  // dead-reckons between snapshots, so polling often just re-fetches the cache.
  ships: 60000,
  earthquakes: 60000,
  cctv: 60000,
  traffic: 15000,
  // GDELT only refreshes upstream every ~15 min; poll at 3 min to catch each
  // new slice promptly. The client fetch is multi-query (~16s) so this is well
  // clear of overlapping itself.
  events: 180000,
};

const FETCHERS: Record<
  PollLayerId,
  () => Promise<{ items: unknown[]; source?: string }>
> = {
  flights: fetchFlights,
  ships: fetchShips,
  earthquakes: fetchEarthquakes,
  cctv: fetchCctv,
  traffic: fetchTraffic,
  events: fetchEvents,
};

// layers handled by the generic (snap-on-poll) renderer — flights and ships are
// special (interpolated every frame), so they're excluded here.
const STATIC_LAYERS = (Object.keys(FETCHERS) as PollLayerId[]).filter(
  (id) => id !== "flights" && id !== "ships"
);

function quakeColor(mag: number): Cesium.Color {
  if (mag >= 6) return C.red;
  if (mag >= 4.5) return Cesium.Color.fromCssColorString("#ff7a3c");
  if (mag >= 3) return C.amber;
  return C.cyan;
}

function trafficColor(level: string): Cesium.Color {
  switch (level) {
    case "JAM":
      return C.red;
    case "HEAVY":
      return Cesium.Color.fromCssColorString("#ff7a3c");
    case "MODERATE":
      return C.amber;
    default:
      return C.green;
  }
}

// tint per AIS vessel category (white glyph × this color)
function vesselColor(type: string): Cesium.Color {
  switch (type) {
    case "CARGO":
      return C.green;
    case "TANKER":
      return C.amber;
    case "PASSENGER":
      return C.magenta;
    case "HIGH-SPEED":
      return C.cyan;
    case "TUG":
    case "SPECIAL CRAFT":
      return C.violet;
    case "FISHING":
      return Cesium.Color.fromCssColorString("#5dffd0");
    case "SAILING":
    case "PLEASURE CRAFT":
      return Cesium.Color.fromCssColorString("#9be7ff");
    default:
      return C.cyan; // VESSEL / unknown
  }
}

type SelMap = Map<string, FeedEntity>;

// live state for one aircraft. We keep a "truth" target (tLon/tLat/tAlt) that
// is corrected on each poll and dead-reckoned forward every frame, and a
// "displayed" position (lon/lat/alt) that eases toward the truth — so position
// corrections glide in smoothly instead of teleporting/snapping.
interface FlightState {
  lon: number; // displayed (rendered)
  lat: number;
  alt: number;
  tLon: number; // truth target
  tLat: number;
  tAlt: number;
  heading: number; // deg
  velocity: number; // m/s
  onGround: boolean;
}

const M_PER_DEG_LAT = 111_320;
const KN_TO_MS = 0.514444;
// time constant for easing the displayed position toward the truth (seconds).
// ~0.8s feels smooth without lagging noticeably behind the real position.
const EASE_TAU = 0.8;

// live state for one vessel — same dead-reckon + ease model as aircraft, but
// ships move along their course over ground (no altitude / on-ground concept).
interface ShipState {
  lon: number; // displayed (rendered)
  lat: number;
  tLon: number; // truth target
  tLat: number;
  heading: number; // deg (course over ground)
  velocity: number; // m/s
  color: Cesium.Color; // tint by vessel type
}

function renderLayer(
  ds: Cesium.CustomDataSource,
  id: LayerId,
  items: unknown[],
  sel: SelMap
) {
  ds.entities.removeAll();

  if (id === "earthquakes") {
    for (const q of items as import("@/lib/types").Earthquake[]) {
      const eid = `earthquakes:${q.id}`;
      const size = Math.min(Math.max(4 + q.mag * 3, 5), 34);
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(q.lon, q.lat, 0),
        point: {
          pixelSize: size,
          color: quakeColor(q.mag).withAlpha(0.55),
          outlineColor: quakeColor(q.mag),
          outlineWidth: 1,
        },
      });
      sel.set(eid, { kind: "earthquakes", ...q });
    }
    return;
  }

  if (id === "cctv") {
    for (const c of items as import("@/lib/types").Camera[]) {
      const eid = `cctv:${c.id}`;
      const online = c.status === "ONLINE";
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 0),
        point: {
          pixelSize: 7,
          color: (online ? C.red : C.muted).withAlpha(0.9),
          outlineColor: online ? C.amber : C.muted,
          outlineWidth: 1,
        },
      });
      sel.set(eid, { kind: "cctv", ...c });
    }
    return;
  }

  if (id === "events") {
    let idx = 0;
    for (const ev of items as WorldEvent[]) {
      const eid = `events:${ev.id}`;
      // size by article volume (sqrt so a 40-article hotspot isn't a blob)
      const base = Math.min(8 + Math.sqrt(ev.count) * 3.2, 30);
      const phase = (idx++ * 1.7) % (Math.PI * 2);
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(ev.lon, ev.lat, 0),
        point: {
          // gentle "breathing" so the hotspots feel alive between pings
          pixelSize: new Cesium.CallbackProperty(
            () => base + Math.sin(performance.now() / 600 + phase) * 1.4,
            false
          ),
          color: new Cesium.CallbackProperty(
            () =>
              C.gold.withAlpha(
                0.4 +
                  0.18 * (0.5 + 0.5 * Math.sin(performance.now() / 600 + phase))
              ),
            false
          ),
          outlineColor: C.gold,
          outlineWidth: 1.5,
        },
      });
      sel.set(eid, { kind: "events", ...ev });
    }
    return;
  }

  if (id === "traffic") {
    for (const r of items as import("@/lib/types").RoadTraffic[]) {
      const eid = `traffic:${r.id}`;
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(r.lon, r.lat, 0),
        point: {
          pixelSize: 5,
          color: trafficColor(r.level),
          outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
          outlineWidth: 1,
        },
      });
      sel.set(eid, { kind: "traffic", ...r });
    }
  }
}

export default function WorldView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const dsMapRef = useRef<Map<LayerId, Cesium.CustomDataSource>>(new Map());
  const selMapRef = useRef<SelMap>(new Map());
  const selDsRef = useRef<Cesium.CustomDataSource | null>(null);
  const loadedRef = useRef<Set<LayerId>>(new Set());
  const cursorThrottle = useRef(0);

  // ---- flight interpolation state ----
  const flightDsRef = useRef<Cesium.CustomDataSource | null>(null);
  const flightStateRef = useRef<Map<string, FlightState>>(new Map());
  // ---- ship interpolation state ----
  const shipDsRef = useRef<Cesium.CustomDataSource | null>(null);
  const shipStateRef = useRef<Map<string, ShipState>>(new Map());
  // ---- satellite swarm (own primitive collection + per-frame SGP4) ----
  const satFieldRef = useRef<SatelliteField | null>(null);
  const satLoadedRef = useRef(false);
  const satRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTickRef = useRef(0);
  // once we've seen a real feed, ignore synthetic-fallback polls so the map
  // doesn't flip-flop between thousands of real planes and 240 placeholders.
  const haveRealFlightsRef = useRef(false);
  // ---- world-events headline ticker (streams new headlines into intel) ----
  const seenEventUrlsRef = useRef<Set<string>>(new Set());
  const eventsPrimedRef = useRef(false);
  // ---- breaking-news radar FX (pings + situation web) ----
  const eventFxRef = useRef<EventFx | null>(null);
  // ---- place-name labels (countries / cities / oceans) ----
  const mapLabelsRef = useRef<MapLabels | null>(null);

  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Record<LayerId, unknown[]>>({
    flights: [],
    ships: [],
    satellites: [],
    earthquakes: [],
    cctv: [],
    traffic: [],
    events: [],
  });

  const layers = useWorldView((s) => s.layers);
  const setSelected = useWorldView((s) => s.setSelected);
  const updateSelected = useWorldView((s) => s.updateSelected);
  const setCount = useWorldView((s) => s.setCount);
  const pushIntel = useWorldView((s) => s.pushIntel);
  const setCursor = useWorldView((s) => s.setCursor);
  const satOrbits = useWorldView((s) => s.satOrbits);
  const satCounts = useWorldView((s) => s.satCounts);
  const setSatCounts = useWorldView((s) => s.setSatCounts);
  const setSatMeta = useWorldView((s) => s.setSatMeta);

  // ---- init viewer once ----
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    Cesium.Ion.defaultAccessToken =
      process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? "";

    let viewer: Cesium.Viewer;
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        selectionIndicator: false,
        infoBox: false,
        creditContainer: document.createElement("div"),
      });
    } catch (err) {
      console.error("[worldview] cesium init failed", err);
      pushIntel(`RENDER ENGINE FAULT: ${String(err)}`, "alert");
      return;
    }
    viewerRef.current = viewer;

    const scene = viewer.scene;
    scene.backgroundColor = Cesium.Color.fromCssColorString("#05030a");
    scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b0612");
    scene.globe.enableLighting = false;
    // push the atmosphere toward magenta/violet
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.hueShift = 0.58;
      scene.skyAtmosphere.saturationShift = 0.35;
      scene.skyAtmosphere.brightnessShift = -0.05;
    }
    scene.globe.atmosphereHueShift = 0.58;
    scene.globe.atmosphereSaturationShift = 0.25;
    scene.fog.enabled = true;

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(10, 25, 22_000_000),
    });

    // selection marker datasource
    const selDs = new Cesium.CustomDataSource("selection");
    viewer.dataSources.add(selDs);
    selDsRef.current = selDs;

    // dedicated datasource for interpolated flights
    const flightDs = new Cesium.CustomDataSource("flights-live");
    viewer.dataSources.add(flightDs);
    flightDsRef.current = flightDs;

    // dedicated datasource for interpolated ships
    const shipDs = new Cesium.CustomDataSource("ships-live");
    viewer.dataSources.add(shipDs);
    shipDsRef.current = shipDs;

    // satellite swarm — manages its own PointPrimitiveCollection + preRender loop
    satFieldRef.current = new SatelliteField(scene);

    // breaking-news radar FX (pings + situation web) for the WORLD EVENTS layer
    eventFxRef.current = new EventFx(viewer);

    // place-name labels — countries, cities (on zoom-in), oceans
    mapLabelsRef.current = new MapLabels(viewer);

    // ---- per-frame: dead-reckon the truth target, ease the display to it ----
    lastTickRef.current = performance.now();
    const onTick = () => {
      const now = performance.now();
      let dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      if (dt <= 0) return;
      if (dt > 2) dt = 2; // clamp after the tab was backgrounded

      const k = 1 - Math.exp(-dt / EASE_TAU); // fraction to close this frame

      flightStateRef.current.forEach((st) => {
        // 1) advance the truth target along its heading (skip parked planes)
        if (st.velocity && !st.onGround) {
          const dist = st.velocity * dt;
          const th = Cesium.Math.toRadians(st.heading);
          const cosLat = Math.cos(Cesium.Math.toRadians(st.tLat)) || 1e-6;
          st.tLat += (dist * Math.cos(th)) / M_PER_DEG_LAT;
          st.tLon += (dist * Math.sin(th)) / (M_PER_DEG_LAT * cosLat);
          if (st.tLat > 89) st.tLat = 89;
          if (st.tLat < -89) st.tLat = -89;
          if (st.tLon > 180) st.tLon -= 360;
          if (st.tLon < -180) st.tLon += 360;
        }

        // 2) ease the displayed position toward the truth (no hard snapping).
        //    Handle the antimeridian so planes never wrap "the long way".
        let dLon = st.tLon - st.lon;
        if (dLon > 180) dLon -= 360;
        else if (dLon < -180) dLon += 360;
        st.lon += dLon * k;
        if (st.lon > 180) st.lon -= 360;
        else if (st.lon < -180) st.lon += 360;
        st.lat += (st.tLat - st.lat) * k;
        st.alt += (st.tAlt - st.alt) * k;
      });

      // same model for ships (no altitude)
      shipStateRef.current.forEach((st) => {
        if (st.velocity) {
          const dist = st.velocity * dt;
          const th = Cesium.Math.toRadians(st.heading);
          const cosLat = Math.cos(Cesium.Math.toRadians(st.tLat)) || 1e-6;
          st.tLat += (dist * Math.cos(th)) / M_PER_DEG_LAT;
          st.tLon += (dist * Math.sin(th)) / (M_PER_DEG_LAT * cosLat);
          if (st.tLat > 89) st.tLat = 89;
          if (st.tLat < -89) st.tLat = -89;
          if (st.tLon > 180) st.tLon -= 360;
          if (st.tLon < -180) st.tLon += 360;
        }
        let dLon = st.tLon - st.lon;
        if (dLon > 180) dLon -= 360;
        else if (dLon < -180) dLon += 360;
        st.lon += dLon * k;
        if (st.lon > 180) st.lon -= 360;
        else if (st.lon < -180) st.lon += 360;
        st.lat += (st.tLat - st.lat) * k;
      });

      // advance/expire breaking-news radar pings
      eventFxRef.current?.update();
    };
    viewer.clock.onTick.addEventListener(onTick);

    // interaction
    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const picked = scene.pick(click.position);
      // entities expose an Entity (with .id); point primitives expose the raw
      // string id we attached. Normalize both to a string key.
      const obj = picked?.id;
      const pid =
        typeof obj === "string" ? obj : (obj?.id as string | undefined);

      // satellites live in a primitive collection, not selMap — build their
      // FeedEntity on the fly from the live propagator.
      if (pid && pid.startsWith("satellites:")) {
        const norad = pid.slice("satellites:".length);
        const field = satFieldRef.current;
        const g = field?.geodeticNow(norad);
        const rec = field?.recordFor(norad);
        if (g && rec) {
          setSelected({
            kind: "satellites",
            id: norad,
            name: rec.name,
            orbit: rec.orbit,
            lon: g.lon,
            lat: g.lat,
            altKm: g.altKm,
          });
        } else {
          setSelected(null);
        }
        return;
      }

      if (pid && selMapRef.current.has(pid)) {
        setSelected(selMapRef.current.get(pid)!);
      } else {
        setSelected(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((m: { endPosition: Cesium.Cartesian2 }) => {
      const now = performance.now();
      if (now - cursorThrottle.current < 80) return;
      cursorThrottle.current = now;
      const cart = scene.camera.pickEllipsoid(m.endPosition);
      if (cart) {
        const c = Cesium.Cartographic.fromCartesian(cart);
        setCursor({
          lon: Cesium.Math.toDegrees(c.longitude),
          lat: Cesium.Math.toDegrees(c.latitude),
        });
      } else {
        setCursor(null);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    setReady(true);

    // dev-only handle for debugging/verification (stripped from prod bundles)
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __wvViewer?: Cesium.Viewer }).__wvViewer = viewer;
      (window as unknown as { __wvFx?: EventFx }).__wvFx =
        eventFxRef.current ?? undefined;
    }

    return () => {
      viewer.clock.onTick.removeEventListener(onTick);
      handler.destroy();
      satFieldRef.current?.destroy();
      satFieldRef.current = null;
      eventFxRef.current?.destroy();
      eventFxRef.current = null;
      mapLabelsRef.current?.destroy();
      mapLabelsRef.current = null;
      viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- polling: only enabled layers ----
  useEffect(() => {
    if (!ready) return;
    const timers: ReturnType<typeof setInterval>[] = [];

    (Object.keys(FETCHERS) as PollLayerId[]).forEach((id) => {
      if (!layers[id]) {
        // clear disabled layer data
        setData((d) => (d[id].length ? { ...d, [id]: [] } : d));
        return;
      }
      const run = async () => {
        try {
          const res = await FETCHERS[id]();
          const items = res.items;
          // flights: once we have a real feed, drop synthetic-fallback polls
          // so thousands of real planes don't get replaced by 240 placeholders.
          if (id === "flights") {
            const isReal = res.source
              ? res.source.startsWith("opensky")
              : true;
            if (!isReal && haveRealFlightsRef.current) return;
            if (isReal) haveRealFlightsRef.current = true;
          }
          setData((d) => ({ ...d, [id]: items }));
          setCount(id, items.length);
          if (!loadedRef.current.has(id)) {
            loadedRef.current.add(id);
            const meta = LAYERS.find((l) => l.id === id)!;
            pushIntel(
              `${meta.source} · ${items.length} contacts acquired`,
              meta.id === "earthquakes" ? "warn" : "info"
            );
          }
        } catch (err) {
          pushIntel(`${id.toUpperCase()} FEED ERROR`, "alert");
          console.error(`[worldview] ${id} fetch failed`, err);
        }
      };
      run();
      timers.push(setInterval(run, POLL_MS[id]));
    });

    return () => timers.forEach(clearInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, layers]);

  // ---- flights: reconcile interpolation state on each poll (no full rebuild) ----
  useEffect(() => {
    const ds = flightDsRef.current;
    if (!ds || !ready) return;
    ds.show = layers.flights;

    if (!layers.flights) {
      ds.entities.removeAll();
      flightStateRef.current.clear();
      for (const k of [...selMapRef.current.keys()]) {
        if (k.startsWith("flights:")) selMapRef.current.delete(k);
      }
      return;
    }

    const items = data.flights as Flight[];
    const seen = new Set<string>();
    const nowMs = Date.now();

    for (const f of items) {
      seen.add(f.id);
      const alt = Math.max(f.altitude, f.onGround ? 0 : 1500);

      // propagate the reported fix to "now" using its own timestamp, so a
      // plane last seen 30s ago starts from where it actually is, not stale.
      let pLon = f.lon;
      let pLat = f.lat;
      const ageSec = Math.min(Math.max((nowMs - f.timePosition) / 1000, 0), 120);
      if (f.velocity && !f.onGround && ageSec > 0) {
        const dist = f.velocity * ageSec;
        const th = Cesium.Math.toRadians(f.heading);
        const cosLat = Math.cos(Cesium.Math.toRadians(f.lat)) || 1e-6;
        pLat = f.lat + (dist * Math.cos(th)) / M_PER_DEG_LAT;
        pLon = f.lon + (dist * Math.sin(th)) / (M_PER_DEG_LAT * cosLat);
        if (pLon > 180) pLon -= 360;
        else if (pLon < -180) pLon += 360;
      }

      const st = flightStateRef.current.get(f.id);
      if (st) {
        // correct the truth target; the displayed position eases toward it
        st.tLon = pLon;
        st.tLat = pLat;
        st.tAlt = alt;
        st.heading = f.heading;
        st.velocity = f.velocity;
        st.onGround = f.onGround;
      } else {
        flightStateRef.current.set(f.id, {
          lon: pLon,
          lat: pLat,
          alt,
          tLon: pLon,
          tLat: pLat,
          tAlt: alt,
          heading: f.heading,
          velocity: f.velocity,
          onGround: f.onGround,
        });
        const id = f.id;
        ds.entities.add({
          id: `flights:${id}`,
          position: new Cesium.CallbackPositionProperty(() => {
            const s = flightStateRef.current.get(id);
            return s
              ? Cesium.Cartesian3.fromDegrees(s.lon, s.lat, s.alt)
              : Cesium.Cartesian3.ZERO;
          }, false),
          billboard: {
            image: PLANE_IMAGE,
            width: 20,
            height: 20,
            // billboard.rotation is counter-clockwise; heading is clockwise
            // from north, so negate. Screen-space (default alignedAxis).
            rotation: new Cesium.CallbackProperty(() => {
              const s = flightStateRef.current.get(id);
              return s ? -Cesium.Math.toRadians(s.heading) : 0;
            }, false),
            alignedAxis: Cesium.Cartesian3.ZERO,
          },
        });
      }
      selMapRef.current.set(`flights:${f.id}`, { kind: "flights", ...f });
    }

    // drop aircraft that fell out of the feed
    for (const id of [...flightStateRef.current.keys()]) {
      if (!seen.has(id)) {
        flightStateRef.current.delete(id);
        ds.entities.removeById(`flights:${id}`);
        selMapRef.current.delete(`flights:${id}`);
      }
    }
  }, [data.flights, layers.flights, ready]);

  // ---- ships: reconcile interpolation state on each poll (no full rebuild) ----
  useEffect(() => {
    const ds = shipDsRef.current;
    if (!ds || !ready) return;
    ds.show = layers.ships;

    if (!layers.ships) {
      ds.entities.removeAll();
      shipStateRef.current.clear();
      for (const k of [...selMapRef.current.keys()]) {
        if (k.startsWith("ships:")) selMapRef.current.delete(k);
      }
      return;
    }

    const items = data.ships as Ship[];
    const seen = new Set<string>();
    const nowMs = Date.now();

    for (const s of items) {
      seen.add(s.id);
      const vel = s.speed * KN_TO_MS;

      // propagate the reported fix to "now" using its own timestamp.
      let pLon = s.lon;
      let pLat = s.lat;
      const ageSec = Math.min(
        Math.max((nowMs - (s.timePosition ?? nowMs)) / 1000, 0),
        300
      );
      if (vel && ageSec > 0) {
        const dist = vel * ageSec;
        const th = Cesium.Math.toRadians(s.heading);
        const cosLat = Math.cos(Cesium.Math.toRadians(s.lat)) || 1e-6;
        pLat = s.lat + (dist * Math.cos(th)) / M_PER_DEG_LAT;
        pLon = s.lon + (dist * Math.sin(th)) / (M_PER_DEG_LAT * cosLat);
        if (pLon > 180) pLon -= 360;
        else if (pLon < -180) pLon += 360;
      }

      const st = shipStateRef.current.get(s.id);
      if (st) {
        st.tLon = pLon;
        st.tLat = pLat;
        st.heading = s.heading;
        st.velocity = vel;
        st.color = vesselColor(s.type);
      } else {
        shipStateRef.current.set(s.id, {
          lon: pLon,
          lat: pLat,
          tLon: pLon,
          tLat: pLat,
          heading: s.heading,
          velocity: vel,
          color: vesselColor(s.type),
        });
        const id = s.id;
        ds.entities.add({
          id: `ships:${id}`,
          position: new Cesium.CallbackPositionProperty(() => {
            const cur = shipStateRef.current.get(id);
            return cur
              ? Cesium.Cartesian3.fromDegrees(cur.lon, cur.lat, 0)
              : Cesium.Cartesian3.ZERO;
          }, false),
          billboard: {
            // hull glyph when under way, plain dot when stationary
            image: new Cesium.CallbackProperty(() => {
              const cur = shipStateRef.current.get(id);
              return cur && cur.velocity > SHIP_MOVING_MS
                ? SHIP_IMAGE
                : SHIP_DOT_IMAGE;
            }, false),
            width: 15,
            height: 15,
            // tint white glyph by vessel type
            color: new Cesium.CallbackProperty(
              () => shipStateRef.current.get(id)?.color ?? C.cyan,
              false
            ),
            // billboard.rotation is counter-clockwise; course is clockwise from
            // north, so negate. Stationary vessels stay upright (dot).
            rotation: new Cesium.CallbackProperty(() => {
              const cur = shipStateRef.current.get(id);
              return cur && cur.velocity > SHIP_MOVING_MS
                ? -Cesium.Math.toRadians(cur.heading)
                : 0;
            }, false),
            alignedAxis: Cesium.Cartesian3.ZERO,
          },
        });
      }
      selMapRef.current.set(`ships:${s.id}`, { kind: "ships", ...s });
    }

    // drop vessels that fell out of the feed
    for (const id of [...shipStateRef.current.keys()]) {
      if (!seen.has(id)) {
        shipStateRef.current.delete(id);
        ds.entities.removeById(`ships:${id}`);
        selMapRef.current.delete(`ships:${id}`);
      }
    }
  }, [data.ships, layers.ships, ready]);

  // ---- satellites: pull the TLE catalogue once; the field animates it ----
  useEffect(() => {
    if (!ready || !layers.satellites || satLoadedRef.current) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetchSatellites();
        if (cancelled || !satFieldRef.current) return;
        setSatMeta({
          source: res.source,
          fetchedAt: res.fetchedAt,
          total: res.counts.total,
          live: res.live,
        });
        // an empty payload means every upstream was unreachable — surface it and
        // retry shortly rather than locking in a permanent empty state.
        if (res.items.length === 0) {
          pushIntel("SATELLITE CATALOG UNAVAILABLE — RETRYING", "warn");
          satRetryRef.current = setTimeout(run, 15000);
          return;
        }
        satFieldRef.current.load(res.items);
        satLoadedRef.current = true;
        setSatCounts({ LEO: res.counts.LEO, GEO: res.counts.GEO });
        pushIntel(
          `CELESTRAK · ${res.counts.total.toLocaleString()} ORBITAL CONTACTS ` +
            `(LEO ${res.counts.LEO.toLocaleString()} · GEO ${res.counts.GEO})`,
          res.live ? "info" : "warn"
        );
      } catch (err) {
        pushIntel("SATELLITE TLE FEED ERROR — RETRYING", "alert");
        console.error("[worldview] satellites fetch failed", err);
        if (!cancelled) satRetryRef.current = setTimeout(run, 15000);
      }
    };
    run();
    return () => {
      cancelled = true;
      if (satRetryRef.current) clearTimeout(satRetryRef.current);
    };
  }, [ready, layers.satellites, setSatCounts, setSatMeta, pushIntel]);

  // ---- satellites: master + per-orbit visibility, and the contact count ----
  useEffect(() => {
    if (!ready) return;
    satFieldRef.current?.setVisibility(layers.satellites, satOrbits);
    const visible =
      (satOrbits.LEO ? satCounts.LEO : 0) + (satOrbits.GEO ? satCounts.GEO : 0);
    setCount("satellites", layers.satellites ? visible : 0);
  }, [ready, layers.satellites, satOrbits, satCounts, setCount]);

  // ---- render the snap-on-poll layers when data/layers change ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;

    // refresh selection entries for static layers only (flights + ships manage theirs)
    for (const k of [...selMapRef.current.keys()]) {
      if (!k.startsWith("flights:") && !k.startsWith("ships:")) {
        selMapRef.current.delete(k);
      }
    }

    STATIC_LAYERS.forEach((id) => {
      let ds = dsMapRef.current.get(id);
      if (!ds) {
        ds = new Cesium.CustomDataSource(id);
        viewer.dataSources.add(ds);
        dsMapRef.current.set(id, ds);
      }
      ds.show = layers[id];
      if (layers[id]) {
        renderLayer(ds, id, data[id], selMapRef.current);
      } else {
        ds.entities.removeAll();
      }
    });
  }, [data, layers, ready]);

  // ---- world events: keep the radar FX visibility in sync with the layer ----
  useEffect(() => {
    if (!ready) return;
    eventFxRef.current?.setVisible(layers.events);
  }, [ready, layers.events]);

  // ---- world events: stream headlines to intel + drive the breaking-news radar ----
  useEffect(() => {
    if (!ready || !layers.events) return;
    const events = data.events as WorldEvent[];
    if (!events.length) return;

    // wire the day's biggest hotspots into the glowing situation web
    eventFxRef.current?.setWeb(
      events.slice(0, 8).map((e) => ({ lon: e.lon, lat: e.lat }))
    );

    // flatten every country's headlines, newest first
    const lines: {
      country: string;
      title: string;
      url: string;
      time: number;
    }[] = [];
    for (const ev of events) {
      for (const h of ev.headlines) {
        lines.push({
          country: ev.name,
          title: h.title,
          url: h.url,
          time: h.time,
        });
      }
    }
    lines.sort((a, b) => b.time - a.time);

    const seen = seenEventUrlsRef.current;
    const isPrime = !eventsPrimedRef.current;
    const fmt = (l: { country: string; title: string }) => {
      const t = l.title.length > 96 ? l.title.slice(0, 95) + "…" : l.title;
      return `${l.country.toUpperCase()} · ${t}`;
    };

    // intel feed: first load surfaces a handful; later polls stream new ones.
    const cap = isPrime ? 5 : 6;
    const fresh = lines.filter((l) => !seen.has(l.url)).slice(0, cap);
    for (const l of fresh.reverse()) pushIntel(fmt(l), "warn");

    // radar pings
    if (isPrime) {
      // staggered sweep across the day's hotspots when the layer comes online
      events.slice(0, 12).forEach((e, i) => {
        const big = e.count >= 15;
        const { lon, lat } = e;
        setTimeout(
          () => eventFxRef.current?.ping(lon, lat, { big, rings: big ? 3 : 2 }),
          i * 170
        );
      });
    } else {
      // ping the countries that gained genuinely new headlines this poll
      const newCountries = new Set(
        lines.filter((l) => !seen.has(l.url)).map((l) => l.country)
      );
      let i = 0;
      for (const e of events) {
        if (!newCountries.has(e.name)) continue;
        const big = e.count >= 15;
        const { lon, lat } = e;
        setTimeout(
          () => eventFxRef.current?.ping(lon, lat, { big, rings: big ? 3 : 1 }),
          i++ * 220
        );
      }
    }

    for (const l of lines) seen.add(l.url);
    eventsPrimedRef.current = true;
    if (seen.size > 4000) {
      seenEventUrlsRef.current = new Set(lines.map((l) => l.url));
    }
  }, [data.events, layers.events, ready, pushIntel]);

  // ---- camera actions ----
  const flyTo = useCallback((lon: number, lat: number, height = 1_500_000) => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
      duration: 1.6,
    });
  }, []);

  const resetView = useCallback(() => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(10, 25, 22_000_000),
      duration: 1.6,
    });
    pushIntel("VIEW RESET — GLOBAL", "info");
  }, [pushIntel]);

  const locateMe = useCallback(() => {
    if (!navigator.geolocation) {
      pushIntel("GEOLOCATION UNAVAILABLE", "alert");
      return;
    }
    pushIntel("ACQUIRING POSITION...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyTo(pos.coords.longitude, pos.coords.latitude, 600_000);
        pushIntel(
          `POSITION LOCK ${pos.coords.latitude.toFixed(
            2
          )}, ${pos.coords.longitude.toFixed(2)}`,
          "ok"
        );
      },
      () => pushIntel("POSITION DENIED", "alert")
    );
  }, [flyTo, pushIntel]);

  // ---- selection marker ----
  const selected = useWorldView((s) => s.selected);
  useEffect(() => {
    const ds = selDsRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    if (!selected) return;
    // for a moving aircraft, track its live interpolated position
    if (selected.kind === "flights") {
      const id = selected.id;
      ds.entities.add({
        position: new Cesium.CallbackPositionProperty(() => {
          const s = flightStateRef.current.get(id);
          return s
            ? Cesium.Cartesian3.fromDegrees(s.lon, s.lat, s.alt)
            : Cesium.Cartesian3.ZERO;
        }, false),
        point: {
          pixelSize: 24,
          color: Cesium.Color.TRANSPARENT,
          outlineColor: C.cyan,
          outlineWidth: 2,
        },
      });
      return;
    }
    // for a moving vessel, track its live interpolated position
    if (selected.kind === "ships") {
      const id = selected.id;
      ds.entities.add({
        position: new Cesium.CallbackPositionProperty(() => {
          const s = shipStateRef.current.get(id);
          return s
            ? Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 0)
            : Cesium.Cartesian3.ZERO;
        }, false),
        point: {
          pixelSize: 24,
          color: Cesium.Color.TRANSPARENT,
          outlineColor: C.cyan,
          outlineWidth: 2,
        },
      });
      return;
    }
    // for an orbiting satellite, track its live interpolated position
    if (selected.kind === "satellites") {
      const norad = selected.id;
      ds.entities.add({
        position: new Cesium.CallbackPositionProperty(
          () => satFieldRef.current?.liveCartesian(norad) ?? Cesium.Cartesian3.ZERO,
          false
        ),
        point: {
          pixelSize: 22,
          color: Cesium.Color.TRANSPARENT,
          outlineColor: C.cyan,
          outlineWidth: 2,
        },
      });
      return;
    }
    const e = selected as unknown as { lon: number; lat: number };
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(e.lon, e.lat, 0),
      point: {
        pixelSize: 24,
        color: Cesium.Color.TRANSPARENT,
        outlineColor: C.cyan,
        outlineWidth: 2,
      },
    });
    // depend on identity (kind+id), not the object — a tracked satellite's
    // readout is refreshed in place every couple seconds and we don't want to
    // tear down / rebuild the marker each time.
  }, [selected?.kind, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the selected satellite's lat/lon/alt readout live as it moves
  useEffect(() => {
    if (selected?.kind !== "satellites") return;
    const norad = selected.id;
    const iv = setInterval(() => {
      const field = satFieldRef.current;
      const g = field?.geodeticNow(norad);
      const rec = field?.recordFor(norad);
      if (g && rec) {
        updateSelected({
          kind: "satellites",
          id: norad,
          name: rec.name,
          orbit: rec.orbit,
          lon: g.lon,
          lat: g.lat,
          altKm: g.altKm,
        });
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [selected?.kind, selected?.id, updateSelected]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      <TopBar />
      <Controls onReset={resetView} onLocate={locateMe} />
      <StatusBar />
      <RightRail onFlyTo={flyTo} />
    </div>
  );
}
