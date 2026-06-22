"use client";

import "@/lib/cesiumBase";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorldView } from "@/lib/store";
import { LAYERS } from "@/lib/layers";
import {
  fetchBases,
  fetchEarthquakes,
  fetchEvents,
  fetchFires,
  fetchFlights,
  fetchShips,
  fetchSatellites,
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
import { MeasureTool, HighlightTool } from "@/lib/globeTools";
import { loadBorders } from "@/lib/borders";
import { ingestFile, applyVectorStyle, formatFromName } from "@/lib/userData";

import TopBar from "./hud/TopBar";
import Controls from "./hud/Controls";
import StatusBar from "./hud/StatusBar";
import RightRail from "./hud/RightRail";
import SearchBar from "./hud/SearchBar";

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

// military-base markers: a colored disc "badge" per branch with a dark glyph
// (star = army/ground, anchor = naval, plane = air) and a faint glow ring. Much
// more map-like than a plain dot. Built as baked-color SVGs so no billboard tint
// is needed; the globe occludes far-side badges (no disableDepthTestDistance).
function baseBadge(disc: string, ring: string, glyphDark: string, glyph: string) {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
        `<circle cx='12' cy='12' r='10' fill='${disc}'/>` +
        `<circle cx='12' cy='12' r='10.6' fill='none' stroke='${ring}' stroke-width='1' opacity='0.55'/>` +
        glyph.replace("__C__", glyphDark) +
        "</svg>"
    )
  );
}
const STAR_GLYPH =
  "<g transform='translate(12 12) scale(0.6) translate(-12 -12)'>" +
  "<path d='M12 2.4l2.75 6.05 6.6.62-4.97 4.38 1.5 6.5L12 16.9 6.12 20l1.5-6.5L2.65 9.07l6.6-.62z' fill='__C__'/></g>";
const ANCHOR_GLYPH =
  "<g transform='translate(12 12) scale(0.58) translate(-12 -12)'>" +
  "<path fill-rule='evenodd' d='M12 2C10.34 2 9 3.34 9 5c0 1.3.84 2.4 2 2.82V9H8v2h3v7.93C7.61 18.45 5 15.53 5 12H7l-3-4-3 4h2c0 4.97 4.03 9 9 9s9-4.03 9-9h2l-3-4-3 4h2c0 3.53-2.61 6.45-6 6.93V11h3V9h-3V7.82C14.16 7.4 15 6.3 15 5c0-1.66-1.34-3-3-3zm0 2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z' fill='__C__'/></g>";
const PLANE_GLYPH =
  "<g transform='translate(12 12) scale(0.62) translate(-12 -12)'>" +
  "<path d='M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' fill='__C__'/></g>";
const BASE_ARMY_IMAGE = baseBadge("#ff5a4d", "#ffd9d3", "#2a0805", STAR_GLYPH);
const BASE_NAVAL_IMAGE = baseBadge("#00e5ff", "#ccf8ff", "#02303a", ANCHOR_GLYPH);
const BASE_AIR_IMAGE = baseBadge("#b14bff", "#e7ccff", "#1a0830", PLANE_GLYPH);
function branchImage(branch: string): string {
  if (branch === "NAVAL") return BASE_NAVAL_IMAGE;
  if (branch === "AIR") return BASE_AIR_IMAGE;
  return BASE_ARMY_IMAGE;
}

// active-fire flame glyph (white fill → tinted per fire by FRP severity; thin
// dark outline so it reads against bright terrain). Sized per fire as well.
const FLAME_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
  "<path d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z' " +
  "fill='#ffffff' stroke='#3a0a00' stroke-width='0.6' stroke-linejoin='round'/></svg>";
const FLAME_IMAGE = `data:image/svg+xml,${encodeURIComponent(FLAME_SVG)}`;

// satellites are propagated client-side every frame by SatelliteField, and
// photoreal is a scene-level toggle (Google 3D tiles), not a polled feed — both
// opt out of the generic poll/render pipeline entirely.
type PollLayerId = Exclude<LayerId, "satellites" | "photoreal">;

// colors cycled through for each imported user layer (MY DATA)
const USER_LAYER_COLORS = [
  "#00e5ff",
  "#ff2d95",
  "#5dff9e",
  "#ffb347",
  "#b14bff",
  "#ffe14d",
];

const POLL_MS: Record<PollLayerId, number> = {
  flights: 15000,
  // ships refresh slowly upstream (VesselAPI free-tier quota) and the client
  // dead-reckons between snapshots, so polling often just re-fetches the cache.
  ships: 60000,
  earthquakes: 60000,
  // bases are a bundled static snapshot (don't move) — effectively load-once.
  bases: 86_400_000,
  // FIRMS refreshes a few times/day; poll every 15 min (well under the key's
  // 5,000 transactions / 10-min limit, and the route is CDN-cached for 30 min).
  fires: 900_000,
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
  bases: fetchBases,
  fires: fetchFires,
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

// active-fire severity by fire radiative power (MW). Tuned to the displayed
// (top-FRP) feed's distribution so the tiers actually spread: low ≲32, moderate,
// high, and a hot "extreme" red for the standout blazes (top few %).
function fireColor(frp: number): Cesium.Color {
  if (frp >= 120) return Cesium.Color.fromCssColorString("#ff2740"); // extreme
  if (frp >= 60) return C.red; // high (#ff414e)
  if (frp >= 32) return Cesium.Color.fromCssColorString("#ff7a3c"); // moderate
  return Cesium.Color.fromCssColorString("#ffc24d"); // low (amber)
}

// flame size (px) scales with severity too — bigger blaze for higher FRP.
function fireSize(frp: number): number {
  const s = 11 + Math.sqrt(frp) * 1.5;
  return s < 14 ? 14 : s > 34 ? 34 : s;
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

  if (id === "bases") {
    // Branch-badge billboards (colored disc + glyph). Baked-color SVGs, sized in
    // pixels and shrunk at distance so dense clusters stay legible.
    for (const b of items as import("@/lib/types").MilitaryBase[]) {
      const eid = `bases:${b.id}`;
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(b.lon, b.lat, 0),
        billboard: {
          image: branchImage(b.branch),
          width: 22,
          height: 22,
          scaleByDistance: new Cesium.NearFarScalar(2.0e5, 1.0, 2.6e7, 0.4),
          // no disableDepthTestDistance: let the globe occlude far-side badges.
        },
      });
      sel.set(eid, { kind: "bases", ...b });
    }
    return;
  }

  if (id === "fires") {
    for (const f of items as import("@/lib/types").Fire[]) {
      const eid = `fires:${f.id}`;
      const size = fireSize(f.frp);
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, 0),
        billboard: {
          image: FLAME_IMAGE,
          color: fireColor(f.frp), // tinted white glyph → severity color
          width: size,
          height: size,
          scaleByDistance: new Cesium.NearFarScalar(2.0e5, 1.0, 2.6e7, 0.45),
          // no disableDepthTestDistance: let the globe occlude far-side fires.
        },
      });
      sel.set(eid, { kind: "fires", ...f });
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

}

export default function WorldView({ onReady }: { onReady?: () => void }) {
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
  // ---- world-events headline ticker (streams new headlines into intel) ----
  const seenEventUrlsRef = useRef<Set<string>>(new Set());
  const eventsPrimedRef = useRef(false);
  // ---- breaking-news radar FX (pings + situation web) ----
  const eventFxRef = useRef<EventFx | null>(null);
  // ---- place-name labels (countries / cities / oceans) ----
  const mapLabelsRef = useRef<MapLabels | null>(null);
  // ---- on-globe TOOLS (measure / highlight) ----
  const measureToolRef = useRef<MeasureTool | null>(null);
  const highlightToolRef = useRef<HighlightTool | null>(null);
  // ---- world country borders (GeoJSON) ----
  const bordersDsRef = useRef<Cesium.CustomDataSource | null>(null);
  // ---- Google Photorealistic 3D Tiles (lazy-created scene primitive) ----
  const tilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);
  const photorealLoadingRef = useRef(false);
  // ---- user-imported GIS layers (drag-dropped): id → live Cesium objects ----
  const userLayerObjsRef = useRef<
    Map<
      string,
      {
        dataSource?: Cesium.DataSource;
        imageryLayer?: Cesium.ImageryLayer;
        rectangle?: Cesium.Rectangle;
        appliedColor?: string; // last style pushed to the entities…
        appliedOpacity?: number; // …so we only re-style when it changes
      }
    >
  >(new Map());
  const userColorIdxRef = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Record<LayerId, unknown[]>>({
    flights: [],
    ships: [],
    satellites: [],
    earthquakes: [],
    bases: [],
    fires: [],
    events: [],
    photoreal: [], // scene toggle, never carries feed data
  });

  const layers = useWorldView((s) => s.layers);
  const photoreal = useWorldView((s) => s.layers.photoreal);
  const userLayers = useWorldView((s) => s.userLayers);
  const addUserLayer = useWorldView((s) => s.addUserLayer);
  const setSelected = useWorldView((s) => s.setSelected);
  const updateSelected = useWorldView((s) => s.updateSelected);
  const setCount = useWorldView((s) => s.setCount);
  const pushIntel = useWorldView((s) => s.pushIntel);
  const setCursor = useWorldView((s) => s.setCursor);
  const satOrbits = useWorldView((s) => s.satOrbits);
  const satCounts = useWorldView((s) => s.satCounts);
  const setSatCounts = useWorldView((s) => s.setSatCounts);
  const setSatMeta = useWorldView((s) => s.setSatMeta);
  const activeTool = useWorldView((s) => s.activeTool);
  const measureMode = useWorldView((s) => s.measureMode);
  const measureUnit = useWorldView((s) => s.measureUnit);

  // fly to an imported layer's extent (vector → its data; raster → its rectangle)
  const zoomToUserLayer = useCallback((id: string) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const obj = userLayerObjsRef.current.get(id);
    if (!obj) return;
    if (obj.dataSource) viewer.flyTo(obj.dataSource, { duration: 1.5 });
    else if (obj.rectangle)
      viewer.camera.flyTo({ destination: obj.rectangle, duration: 1.5 });
  }, []);

  // ingest dropped/browsed GIS files → add to the viewer + the MY DATA store
  const addFiles = useCallback(
    async (files: File[]) => {
      const viewer = viewerRef.current;
      if (!viewer) return;
      for (const file of files) {
        if (!formatFromName(file.name)) {
          pushIntel(`UNSUPPORTED FILE · ${file.name}`, "alert");
          continue;
        }
        const id = `user-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        const color =
          USER_LAYER_COLORS[
            userColorIdxRef.current++ % USER_LAYER_COLORS.length
          ];
        pushIntel(`IMPORTING · ${file.name}…`, "info");
        try {
          const res = await ingestFile(file, viewer, color);
          if (res.dataSource) {
            res.dataSource.show = true;
            await viewer.dataSources.add(res.dataSource);
          }
          if (res.imageryLayer) viewer.imageryLayers.add(res.imageryLayer);
          userLayerObjsRef.current.set(id, {
            dataSource: res.dataSource,
            imageryLayer: res.imageryLayer,
            rectangle: res.rectangle,
            // the loader already styled the entities with `color` at full
            // opacity, so the reconcile below won't re-iterate them on import
            appliedColor: color,
            appliedOpacity: 1,
          });
          addUserLayer({
            id,
            name: res.name,
            kind: res.kind,
            format: res.format,
            visible: true,
            opacity: 1,
            color,
            featureCount: res.featureCount,
            note: res.note,
          });
          pushIntel(
            `LAYER ADDED · ${res.name}${
              res.featureCount != null ? ` · ${res.featureCount} features` : ""
            }`,
            "ok"
          );
          useWorldView.getState().setRightPanel("userdata");
          setTimeout(() => zoomToUserLayer(id), 200);
        } catch (err) {
          // handled + surfaced in the intel feed below; warn (not error) so the
          // Next dev overlay doesn't pop for an expected bad-file case
          console.warn("[worldview] import failed", err);
          pushIntel(
            `IMPORT FAILED · ${file.name} — ${
              err instanceof Error ? err.message : String(err)
            }`,
            "alert"
          );
        }
      }
    },
    [pushIntel, addUserLayer, zoomToUserLayer]
  );

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
        // no default Ion/Bing base — we set our own imagery below (and Bing via
        // Ion was returning opaque BLACK tiles when throttled = the black-hole bug)
        baseLayer: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        selectionIndicator: false,
        infoBox: false,
        creditContainer: document.createElement("div"),
        // keep the drawing buffer so the SCREENSHOT tool can read the canvas
        // back as a PNG (canvas.toDataURL) at any time.
        contextOptions: { webgl: { preserveDrawingBuffer: true } },
      });
    } catch (err) {
      console.error("[worldview] cesium init failed", err);
      pushIntel(`RENDER ENGINE FAULT: ${String(err)}`, "alert");
      return;
    }
    viewerRef.current = viewer;
    // Render at the display's native resolution (capped at 2×) so text/labels and
    // the globe are crisp — Cesium defaults to 1× CSS pixels, which looks soft on
    // high-DPI screens.
    viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);

    const scene = viewer.scene;
    scene.backgroundColor = Cesium.Color.fromCssColorString("#05030a");
    // Deep ocean-blue (not violet) for the split-second before tiles stream in,
    // so the globe reads as a real planet from the very first frame.
    scene.globe.baseColor = Cesium.Color.fromCssColorString("#02060f");
    // Full-bright, no day/night terminator — show the whole Earth like the NASA
    // "Blue Marble" reference instead of leaving half the globe in shadow.
    scene.globe.enableLighting = false;
    // REAL-EARTH LOOK: a soft natural atmospheric limb (no hue/saturation shift)
    // around the NASA Blue Marble texture set just below. The old magenta-ward
    // ground-atmosphere shift was dyeing the whole globe green/yellow.
    scene.globe.showGroundAtmosphere = true;
    scene.globe.atmosphereHueShift = 0.0;
    scene.globe.atmosphereSaturationShift = 0.0;
    scene.globe.atmosphereBrightnessShift = 0.0;
    if (scene.skyAtmosphere) {
      // natural blue atmospheric glow on the limb (was shifted to magenta)
      scene.skyAtmosphere.hueShift = 0.0;
      scene.skyAtmosphere.saturationShift = 0.0;
      scene.skyAtmosphere.brightnessShift = 0.0;
    }
    scene.fog.enabled = true;

    // ---- realistic Earth that STAYS SHARP when you zoom in ----
    // CLEAN, NEVER-BLACK BASEMAP:
    // - NASA Blue Marble (single bundled texture) is the BOTTOM layer, FULLY
    //   OPAQUE at all times, so the globe is always covered — no black holes.
    // - Esri World Imagery (free tiled satellite, no token) sits ABOVE it and
    //   FADES IN as the camera drops toward the surface, for sharp real ground
    //   detail up close. Esri returns TRANSPARENT for any missing tile, so gaps
    //   reveal the Blue Marble — unlike Bing-via-Ion, which rendered opaque BLACK
    //   tiles when throttled and produced the black-hole globe.
    // - The cloud sheet sits on top and fades out as you zoom in.
    let blueMarbleLayer: Cesium.ImageryLayer | null = null;
    let satLayer: Cesium.ImageryLayer | null = null;
    let cloudLayer: Cesium.ImageryLayer | null = null;
    Cesium.SingleTileImageryProvider.fromUrl("/textures/earth_daymap.jpg")
      .then((dayProvider) => {
        if (viewer.isDestroyed()) return undefined;
        blueMarbleLayer = viewer.imageryLayers.addImageryProvider(dayProvider);
        satLayer = viewer.imageryLayers.addImageryProvider(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            maximumLevel: 19,
            credit: "Imagery © Esri, Maxar, Earthstar Geographics",
          })
        );
        return Cesium.SingleTileImageryProvider.fromUrl(
          "/textures/earth_clouds.jpg"
        );
      })
      .then((cloudProvider) => {
        if (!cloudProvider || viewer.isDestroyed()) return;
        cloudLayer = viewer.imageryLayers.addImageryProvider(cloudProvider); // top
        cloudLayer.colorToAlpha = Cesium.Color.BLACK; // black sky → transparent
        cloudLayer.colorToAlphaThreshold = 0.18; // keep only the bright cloud
      })
      .catch((err) => console.error("[worldview] imagery failed", err));

    // Blend by camera altitude (metres). t = 1 far (orbit) → 0 near (surface).
    const BM_FAR = 2.5e6; // ≥ ~2,500 km up: pure Blue Marble look
    const BM_NEAR = 4.0e5; // ≤ ~400 km up: sharp satellite fully faded in
    const blendBasemap = () => {
      const h = scene.camera.positionCartographic?.height ?? BM_FAR;
      let t = (h - BM_NEAR) / (BM_FAR - BM_NEAR);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      if (satLayer) satLayer.alpha = 1 - t; // satellite fades IN as you zoom in
      if (blueMarbleLayer) blueMarbleLayer.alpha = 1; // base stays fully opaque
      if (cloudLayer) cloudLayer.alpha = 0.78 * t; // clouds fade out as you zoom in
    };
    scene.preRender.addEventListener(blendBasemap);

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

    // on-globe TOOLS: measure (writes its live readout into the store) + highlight
    measureToolRef.current = new MeasureTool(viewer, (t) =>
      useWorldView.getState().setMeasureReadout(t)
    );
    highlightToolRef.current = new HighlightTool(viewer);

    // world country borders (async GeoJSON load)
    loadBorders(viewer).then((ds) => {
      bordersDsRef.current = ds;
    });

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
      // a TOOL is armed → clicks measure / highlight on the globe instead of
      // selecting contacts. Read the live state (handler is created once).
      const tool = useWorldView.getState().activeTool;
      if (tool === "measure" || tool === "highlight") {
        const cart = scene.camera.pickEllipsoid(click.position);
        if (cart) {
          if (tool === "measure") measureToolRef.current?.add(cart);
          else highlightToolRef.current?.add(cart);
        }
        return;
      }

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
      // live rubber-band while measuring
      if (useWorldView.getState().activeTool === "measure") {
        measureToolRef.current?.move(cart ?? null);
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    setReady(true);
    onReady?.(); // tell the loading splash the globe is up

    // dev-only handle for debugging/verification (stripped from prod bundles)
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __wvViewer?: Cesium.Viewer }).__wvViewer = viewer;
      (window as unknown as { __wvFx?: EventFx }).__wvFx =
        eventFxRef.current ?? undefined;
      (
        window as unknown as {
          __wvTools?: { measure: MeasureTool | null; highlight: HighlightTool | null };
        }
      ).__wvTools = {
        measure: measureToolRef.current,
        highlight: highlightToolRef.current,
      };
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
      measureToolRef.current?.destroy();
      measureToolRef.current = null;
      highlightToolRef.current?.destroy();
      highlightToolRef.current = null;
      bordersDsRef.current = null;
      // viewer.destroy() disposes its primitives (incl. the tileset); just drop refs
      tilesetRef.current = null;
      photorealLoadingRef.current = false;
      userLayerObjsRef.current.clear();
      viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- TOOLS: push measure mode/unit to the tool + crosshair cursor when armed ----
  useEffect(() => {
    if (ready) measureToolRef.current?.setMode(measureMode);
  }, [measureMode, ready]);
  useEffect(() => {
    if (ready) measureToolRef.current?.setUnit(measureUnit);
  }, [measureUnit, ready]);
  useEffect(() => {
    const v = viewerRef.current;
    if (v && ready) v.scene.canvas.style.cursor = activeTool ? "crosshair" : "";
  }, [activeTool, ready]);

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

  // ---- photorealistic 3D tiles (Google, streamed via Cesium ion) ----
  // A scene-level toggle, not a data feed: when ON we lazily create Google's
  // Photorealistic 3D Tileset, hide the synthwave globe (its imagery + the
  // sea-level borders that would clip through buildings) and let the photoreal
  // mesh be the world; when OFF we hide the tileset and restore the synthwave
  // globe. The tileset is created once and cached. Uses a direct Google Maps key
  // if NEXT_PUBLIC_GOOGLE_MAPS_KEY is set, otherwise the ion token configured
  // above (which needs the "Google Photorealistic 3D Tiles" asset on the account).
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    const scene = viewer.scene;

    // push the current on/off state to the globe + an already-loaded tileset
    const apply = (on: boolean) => {
      if (tilesetRef.current) tilesetRef.current.show = on;
      scene.globe.show = !on;
      if (bordersDsRef.current) bordersDsRef.current.show = !on;
    };

    if (photoreal && !tilesetRef.current && !photorealLoadingRef.current) {
      photorealLoadingRef.current = true;
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
      // onlyUsingWithGoogleGeocoder attests these tiles won't be paired with a
      // non-Google geocoder (our viewer has geocoder: false) — this silences
      // Cesium's repeated TOS warning. Inlined so TS keeps the literal `true`.
      const tilesetPromise = key
        ? Cesium.createGooglePhotorealistic3DTileset({
            key,
            onlyUsingWithGoogleGeocoder: true,
          })
        : Cesium.createGooglePhotorealistic3DTileset({
            onlyUsingWithGoogleGeocoder: true,
          });
      tilesetPromise
        .then((tileset) => {
          photorealLoadingRef.current = false;
          if (viewer.isDestroyed()) {
            tileset.destroy();
            return;
          }
          // Tilted/oblique city views span all the way to the horizon. Without
          // this, the tile budget is spent on distant geometry and the NEAR
          // buildings never refine — so the city flattens the moment you tilt
          // off straight-down. dynamicScreenSpaceError coarsens faraway tiles so
          // the foreground resolves to full 3D (the standard street-level fix).
          tileset.dynamicScreenSpaceError = true;
          tileset.dynamicScreenSpaceErrorDensity = 2.0e-4;
          tileset.dynamicScreenSpaceErrorFactor = 24.0;
          scene.primitives.add(tileset);
          tilesetRef.current = tileset;
          pushIntel("PHOTOREAL 3D · GOOGLE TILES ONLINE", "ok");
          // honor the live toggle in case it flipped while the tiles loaded
          apply(useWorldView.getState().layers.photoreal);
        })
        .catch((err) => {
          photorealLoadingRef.current = false;
          console.error("[worldview] photoreal 3D tiles failed", err);
          pushIntel(
            "PHOTOREAL 3D UNAVAILABLE — ADD THE GOOGLE TILES ASSET TO YOUR ION ACCOUNT",
            "alert"
          );
          // flip the toggle back off so the panel matches reality
          useWorldView.getState().toggleLayer("photoreal");
        });
    } else {
      apply(photoreal);
    }
  }, [photoreal, ready, pushIntel]);

  // ---- user layers: reconcile Cesium objects with the store ----
  // (visibility / opacity / color edits, and removal when a layer is deleted)
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    const objs = userLayerObjsRef.current;
    const ids = new Set(userLayers.map((l) => l.id));
    for (const [id, obj] of [...objs]) {
      if (!ids.has(id)) {
        if (obj.dataSource) viewer.dataSources.remove(obj.dataSource, true);
        if (obj.imageryLayer) viewer.imageryLayers.remove(obj.imageryLayer, true);
        objs.delete(id);
      }
    }
    for (const l of userLayers) {
      const obj = objs.get(l.id);
      if (!obj) continue;
      if (obj.dataSource) {
        obj.dataSource.show = l.visible;
        // only re-iterate the (potentially huge) entity set when the user
        // actually changed color/opacity — not on every unrelated store change
        if (obj.appliedColor !== l.color || obj.appliedOpacity !== l.opacity) {
          applyVectorStyle(obj.dataSource, l.color, l.opacity);
          obj.appliedColor = l.color;
          obj.appliedOpacity = l.opacity;
        }
      }
      if (obj.imageryLayer) {
        obj.imageryLayer.show = l.visible;
        obj.imageryLayer.alpha = l.opacity;
      }
    }
  }, [userLayers, ready]);

  // ---- drag-and-drop GIS files anywhere onto the app ----
  useEffect(() => {
    if (!ready) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragActive(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      depth = 0;
      setDragActive(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) addFiles(files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [ready, addFiles]);

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
      // `layers[id]` is undefined for any layer that's been removed from the
      // registry but is still wired into FETCHERS (e.g. the dormant "bases").
      // Cesium's `show` setter rejects undefined ("value is required"), so coerce.
      ds.show = !!layers[id];
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

  // fly to a place's bounding box — Cesium picks the altitude that frames it, so
  // a country fills the view and a city zooms in appropriately (used by search).
  const flyToRect = useCallback(
    (west: number, south: number, east: number, north: number) => {
      viewerRef.current?.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
        duration: 1.8,
      });
    },
    []
  );

  const resetView = useCallback(() => {
    viewerRef.current?.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(10, 25, 22_000_000),
      duration: 1.6,
    });
    pushIntel("VIEW RESET — GLOBAL", "info");
  }, [pushIntel]);

  // ---- TOOLS actions (wired into the TOOLS panel via RightRail) ----
  const clearMeasure = useCallback(() => measureToolRef.current?.clear(), []);
  const clearHighlight = useCallback(
    () => highlightToolRef.current?.clear(),
    []
  );
  const takeScreenshot = useCallback(() => {
    const v = viewerRef.current;
    if (!v) return;
    v.render(); // ensure the latest frame is in the (preserved) buffer
    const url = v.scene.canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `worldview-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.png`;
    a.click();
    pushIntel("SCREENSHOT SAVED · PNG", "ok");
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
      <SearchBar onFlyTo={flyTo} onFlyToRect={flyToRect} />
      <Controls onReset={resetView} onLocate={locateMe} />
      <StatusBar />
      <RightRail
        onFlyTo={flyTo}
        onAddFiles={addFiles}
        onZoomLayer={zoomToUserLayer}
        onScreenshot={takeScreenshot}
        onClearMeasure={clearMeasure}
        onClearHighlight={clearHighlight}
      />
      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-wv-black/40 backdrop-blur-[1px]">
          <div className="hud-panel corner-ticks box-glow-cyan border-2 border-dashed border-wv-cyan px-10 py-7 text-center">
            <div className="text-3xl text-wv-cyan">⤓</div>
            <div className="mt-2 text-[12px] font-bold tracking-[0.2em] text-wv-text">
              DROP TO IMPORT LAYER
            </div>
            <div className="mt-1 text-[10px] text-wv-muted">
              GeoJSON · Shapefile .zip · KML/KMZ · GeoTIFF
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
