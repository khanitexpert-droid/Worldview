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
  fetchFlights,
  fetchShips,
  fetchSatellites,
  fetchTraffic,
} from "@/lib/feeds";
import type { FeedEntity, LayerId } from "@/lib/types";

import TopBar from "./hud/TopBar";
import DataLayersPanel from "./hud/DataLayersPanel";
import Controls from "./hud/Controls";
import StatusBar from "./hud/StatusBar";
import IntelFeed from "./hud/IntelFeed";
import EntityDetail from "./hud/EntityDetail";

// ---- palette ----
const C = {
  magenta: Cesium.Color.fromCssColorString("#ff2d95"),
  cyan: Cesium.Color.fromCssColorString("#00e5ff"),
  violet: Cesium.Color.fromCssColorString("#b14bff"),
  amber: Cesium.Color.fromCssColorString("#ffb347"),
  red: Cesium.Color.fromCssColorString("#ff414e"),
  green: Cesium.Color.fromCssColorString("#5dff9e"),
  muted: Cesium.Color.fromCssColorString("#6c5b8c"),
};

const POLL_MS: Record<LayerId, number> = {
  flights: 15000,
  ships: 12000,
  satellites: 10000,
  earthquakes: 60000,
  cctv: 60000,
  traffic: 15000,
};

const FETCHERS: Record<LayerId, () => Promise<{ items: unknown[] }>> = {
  flights: fetchFlights,
  ships: fetchShips,
  satellites: fetchSatellites,
  earthquakes: fetchEarthquakes,
  cctv: fetchCctv,
  traffic: fetchTraffic,
};

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

type SelMap = Map<string, FeedEntity>;

function renderLayer(
  ds: Cesium.CustomDataSource,
  id: LayerId,
  items: unknown[],
  sel: SelMap
) {
  ds.entities.removeAll();

  if (id === "flights") {
    for (const f of items as import("@/lib/types").Flight[]) {
      const eid = `flights:${f.id}`;
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(
          f.lon,
          f.lat,
          Math.max(f.altitude, 2000)
        ),
        point: {
          pixelSize: 5,
          color: C.magenta,
          outlineColor: Cesium.Color.fromCssColorString("#3a0a24"),
          outlineWidth: 1,
        },
      });
      sel.set(eid, { kind: "flights", ...f });
    }
    return;
  }

  if (id === "ships") {
    for (const s of items as import("@/lib/types").Ship[]) {
      const eid = `ships:${s.id}`;
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, 0),
        point: {
          pixelSize: 5,
          color: C.cyan,
          outlineColor: Cesium.Color.fromCssColorString("#06303a"),
          outlineWidth: 1,
        },
      });
      sel.set(eid, { kind: "ships", ...s });
    }
    return;
  }

  if (id === "satellites") {
    for (const s of items as import("@/lib/types").Satellite[]) {
      const eid = `satellites:${s.id}`;
      ds.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, s.altKm * 1000),
        point: {
          pixelSize: 4,
          color: C.violet,
          outlineColor: C.cyan,
          outlineWidth: 1,
        },
      });
      sel.set(eid, { kind: "satellites", ...s });
    }
    return;
  }

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

  const [ready, setReady] = useState(false);
  const [data, setData] = useState<Record<LayerId, unknown[]>>({
    flights: [],
    ships: [],
    satellites: [],
    earthquakes: [],
    cctv: [],
    traffic: [],
  });

  const layers = useWorldView((s) => s.layers);
  const setSelected = useWorldView((s) => s.setSelected);
  const setCount = useWorldView((s) => s.setCount);
  const pushIntel = useWorldView((s) => s.pushIntel);
  const setCursor = useWorldView((s) => s.setCursor);

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

    // interaction
    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const picked = scene.pick(click.position);
      const pid = picked?.id?.id as string | undefined;
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

    return () => {
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- polling: only enabled layers ----
  useEffect(() => {
    if (!ready) return;
    const timers: ReturnType<typeof setInterval>[] = [];

    (Object.keys(FETCHERS) as LayerId[]).forEach((id) => {
      if (!layers[id]) {
        // clear disabled layer data
        setData((d) => (d[id].length ? { ...d, [id]: [] } : d));
        return;
      }
      const run = async () => {
        try {
          const { items } = await FETCHERS[id]();
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

  // ---- render entities when data/layers change ----
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !ready) return;
    selMapRef.current.clear();

    (Object.keys(FETCHERS) as LayerId[]).forEach((id) => {
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
    const e = selected as unknown as { lon: number; lat: number; altKm?: number };
    const height =
      selected.kind === "satellites" ? (selected.altKm ?? 0) * 1000 : 0;
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(e.lon, e.lat, height),
      point: {
        pixelSize: 24,
        color: Cesium.Color.TRANSPARENT,
        outlineColor: C.cyan,
        outlineWidth: 2,
      },
    });
  }, [selected]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      <TopBar />
      <DataLayersPanel />
      <Controls onReset={resetView} onLocate={locateMe} />
      <StatusBar />
      <IntelFeed onFocus={flyTo} />
      <EntityDetail onFlyTo={flyTo} />
    </div>
  );
}
