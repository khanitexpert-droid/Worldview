import * as Cesium from "cesium";
import {
  twoline2satrec,
  propagate,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
  type SatRec,
} from "satellite.js";
import type { SatelliteTle, SatOrbit } from "./types";

// ---- palette (kept in sync with WorldView's HUD colors) ----
const LEO_COLOR = Cesium.Color.fromCssColorString("#b14bff"); // violet
const LEO_OUTLINE = Cesium.Color.fromCssColorString("#00e5ff").withAlpha(0.55);
const GEO_COLOR = Cesium.Color.fromCssColorString("#ffb347"); // amber
const GEO_OUTLINE = Cesium.Color.WHITE.withAlpha(0.6);

// We re-run SGP4 for each satellite every STEP_MS and linearly interpolate the
// (Earth-fixed) position in between. At STEP_MS = 4 s a LEO target moves ~30 km;
// the straight-line error vs. the true arc is sub-kilometre — invisible on the
// globe — while the per-frame cost collapses to a cheap vector lerp.
const STEP_MS = 4000;

const scratch = new Cesium.Cartesian3();

interface SatItem {
  norad: string;
  name: string;
  orbit: SatOrbit;
  altKm: number;
  satrec: SatRec;
  pp: Cesium.PointPrimitive;
  // two SGP4 samples that bracket "now" (ECEF metres) + their timestamps
  t0: number;
  t1: number;
  p0: Cesium.Cartesian3;
  p1: Cesium.Cartesian3;
  alive: boolean;
}

function sampleEcef(satrec: SatRec, date: Date): Cesium.Cartesian3 | null {
  const pv = propagate(satrec, date);
  if (!pv) return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  const lat = degreesLat(geo.latitude);
  const lon = degreesLong(geo.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(geo.height))
    return null;
  // match the rest of the app: geodetic -> Cesium Earth-fixed metres
  return Cesium.Cartesian3.fromDegrees(lon, lat, geo.height * 1000);
}

/**
 * Renders a swarm of satellites as a single PointPrimitiveCollection and
 * animates each one along its real SGP4 orbit, smoothly, every frame.
 */
export class SatelliteField {
  private scene: Cesium.Scene;
  private collection: Cesium.PointPrimitiveCollection;
  private items: SatItem[] = [];
  private byId = new Map<string, SatItem>();
  private removeTick: Cesium.Event.RemoveCallback;
  private layerOn = true;
  private orbits: Record<SatOrbit, boolean> = { LEO: true, GEO: true };
  private cursor = 0; // round-robin position for amortized updates

  constructor(scene: Cesium.Scene) {
    this.scene = scene;
    this.collection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
    // preRender fires once per frame, right before Cesium draws — the natural
    // place to refresh positions so motion is locked to the render loop.
    this.removeTick = scene.preRender.addEventListener(() => this.update());
  }

  /** (Re)build the swarm from a fresh TLE catalogue. */
  load(tles: SatelliteTle[]) {
    this.clear();
    const now = Date.now();
    const n = Math.max(tles.length, 1);

    tles.forEach((t, i) => {
      let satrec: SatRec;
      try {
        satrec = twoline2satrec(t.l1, t.l2);
      } catch {
        return;
      }
      if (!satrec || satrec.error) return;

      const p0 = sampleEcef(satrec, new Date(now));
      // Stagger each satellite's first refresh across one STEP window so the
      // SGP4 work is spread evenly over frames instead of spiking every 4 s.
      const t1 = now + STEP_MS * (1 + i / n);
      const p1 = sampleEcef(satrec, new Date(t1));
      if (!p0 || !p1) return;

      const isGeo = t.orbit === "GEO";
      const pp = this.collection.add({
        position: p0,
        pixelSize: isGeo ? 5 : 3.5,
        color: isGeo ? GEO_COLOR : LEO_COLOR,
        outlineColor: isGeo ? GEO_OUTLINE : LEO_OUTLINE,
        outlineWidth: 1,
        id: `satellites:${t.id}`,
      });

      const item: SatItem = {
        norad: t.id,
        name: t.name,
        orbit: t.orbit,
        altKm: t.altKm,
        satrec,
        pp,
        t0: now,
        t1,
        p0,
        p1,
        alive: true,
      };
      this.items.push(item);
      this.byId.set(t.id, item);
    });

    this.applyVisibility();
  }

  /**
   * Per-frame: advance the bracketing samples and lerp the displayed points.
   * Writing 12k point positions (and re-uploading the vertex buffer) every frame
   * is the dominant cost, so we amortize it: each frame refreshes a round-robin
   * slice of at most ~3k points. Every point still updates ~12×/second, which is
   * far more than enough for smooth motion at globe scale (a LEO target moves
   * well under a pixel between updates) while keeping the frame budget bounded.
   */
  private update() {
    if (!this.layerOn) return;
    const n = this.items.length;
    if (n === 0) return;
    const now = Date.now();

    const divisor = Math.ceil(n / 3000); // 1 for ≤3k, grows for big swarms
    const budget = Math.ceil(n / divisor);
    let i = this.cursor;

    for (let k = 0; k < budget; k++, i = i + 1 >= n ? 0 : i + 1) {
      const s = this.items[i];
      if (!s.alive || !s.pp.show) continue;

      if (now >= s.t1) {
        if (now - s.t1 > STEP_MS) {
          // big time jump (tab was backgrounded) — resync around "now"
          const a = sampleEcef(s.satrec, new Date(now));
          const b = sampleEcef(s.satrec, new Date(now + STEP_MS));
          if (!a || !b) {
            s.alive = false;
            s.pp.show = false;
            continue;
          }
          s.t0 = now;
          s.p0 = a;
          s.t1 = now + STEP_MS;
          s.p1 = b;
        } else {
          // normal roll-forward by one step
          s.t0 = s.t1;
          s.p0 = s.p1;
          s.t1 = s.t0 + STEP_MS;
          const b = sampleEcef(s.satrec, new Date(s.t1));
          if (!b) {
            s.alive = false;
            s.pp.show = false;
            continue;
          }
          s.p1 = b;
        }
      }

      let f = (now - s.t0) / (s.t1 - s.t0);
      if (f < 0) f = 0;
      else if (f > 1) f = 1;
      Cesium.Cartesian3.lerp(s.p0, s.p1, f, scratch);
      s.pp.position = scratch;
    }

    this.cursor = i;
  }

  /** Toggle the whole layer and/or individual orbit classes. */
  setVisibility(layerOn: boolean, orbits: Record<SatOrbit, boolean>) {
    this.layerOn = layerOn;
    this.orbits = orbits;
    this.collection.show = layerOn;
    this.applyVisibility();
  }

  private applyVisibility() {
    for (const s of this.items) {
      s.pp.show = this.layerOn && this.orbits[s.orbit];
    }
  }

  /** Live interpolated Earth-fixed position (for the selection marker). */
  liveCartesian(norad: string): Cesium.Cartesian3 | undefined {
    const s = this.byId.get(norad);
    return s ? Cesium.Cartesian3.clone(s.pp.position) : undefined;
  }

  /** Exact sub-satellite point right now (for the detail readout). */
  geodeticNow(norad: string): { lon: number; lat: number; altKm: number } | null {
    const s = this.byId.get(norad);
    if (!s) return null;
    const d = new Date();
    const pv = propagate(s.satrec, d);
    if (!pv) return null;
    const geo = eciToGeodetic(pv.position, gstime(d));
    const lat = degreesLat(geo.latitude);
    const lon = degreesLong(geo.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lon, lat, altKm: Math.round(geo.height) };
  }

  recordFor(norad: string): { name: string; orbit: SatOrbit } | null {
    const s = this.byId.get(norad);
    return s ? { name: s.name, orbit: s.orbit } : null;
  }

  clear() {
    this.collection.removeAll();
    this.items = [];
    this.byId.clear();
  }

  destroy() {
    this.removeTick();
    this.scene.primitives.remove(this.collection); // also destroys it
    this.items = [];
    this.byId.clear();
  }
}
