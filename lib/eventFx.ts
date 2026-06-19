import * as Cesium from "cesium";

// White ring, tinted per-ping via billboard.color — a radar "ping". Animated by
// growing the billboard scale while fading its alpha (cheap: no geometry re-tess).
const RING_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
  "<circle cx='50' cy='50' r='46' fill='none' stroke='#ffffff' stroke-width='4'/>" +
  "</svg>";
const RING_IMAGE = `data:image/svg+xml,${encodeURIComponent(RING_SVG)}`;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

type LL = { lon: number; lat: number };

interface Ping {
  entity: Cesium.Entity;
  start: number;
  duration: number;
}

interface PingOpts {
  color?: Cesium.Color;
  big?: boolean;
  rings?: number;
}

/**
 * Visual flourish layer for the WORLD EVENTS feed:
 *  - ping(): expanding radar rings where news is breaking
 *  - setWeb(): glowing geodesic arcs arcing off the globe between the day's
 *    biggest hotspots (a "situation map" web)
 * Owns its own datasources; call update() every frame and destroy() on teardown.
 */
export class EventFx {
  private viewer: Cesium.Viewer;
  private pingDs: Cesium.CustomDataSource;
  private webDs: Cesium.CustomDataSource;
  private pings: Ping[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private destroyed = false;
  private gold = Cesium.Color.fromCssColorString("#ffe14d");

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    // web sits under the pings
    this.webDs = new Cesium.CustomDataSource("event-web");
    this.pingDs = new Cesium.CustomDataSource("event-pings");
    viewer.dataSources.add(this.webDs);
    viewer.dataSources.add(this.pingDs);
  }

  /** Fire one or more concentric radar rings at a location. */
  ping(lon: number, lat: number, opts: PingOpts = {}) {
    if (this.destroyed) return;
    const rings = opts.rings ?? 1;
    const color = opts.color ?? this.gold;
    const duration = opts.big ? 2800 : 2100;
    const maxScale = opts.big ? 3.6 : 2.4;
    for (let i = 0; i < rings; i++) {
      const t = setTimeout(() => {
        this.spawnRing(lon, lat, color, duration, maxScale);
        this.timers = this.timers.filter((x) => x !== t);
      }, i * 280);
      this.timers.push(t);
    }
  }

  private spawnRing(
    lon: number,
    lat: number,
    color: Cesium.Color,
    duration: number,
    maxScale: number
  ) {
    if (this.destroyed) return;
    // reap here too (not just in update()), so pings can't pile up while the
    // tab is backgrounded and the render loop / onTick is paused.
    this.reap();
    if (this.pings.length > 120) {
      const oldest = this.pings.shift();
      if (oldest) this.pingDs.entities.remove(oldest.entity);
    }
    const start = performance.now();
    const ent = this.pingDs.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
      billboard: {
        image: RING_IMAGE,
        width: 36,
        height: 36,
        scale: new Cesium.CallbackProperty(() => {
          const t = Math.min((performance.now() - start) / duration, 1);
          return 0.25 + easeOut(t) * maxScale;
        }, false),
        color: new Cesium.CallbackProperty(() => {
          const t = Math.min((performance.now() - start) / duration, 1);
          return color.withAlpha((1 - t) * 0.9);
        }, false),
      },
    });
    this.pings.push({ entity: ent, start, duration });
  }

  /** Rebuild the situation web linking the supplied hotspots (biggest first). */
  setWeb(hotspots: LL[], color?: Cesium.Color) {
    if (this.destroyed) return;
    this.webDs.entities.removeAll();
    const col = color ?? this.gold;
    const pts = hotspots.slice(0, 8);
    if (pts.length < 2) return;
    const hub = pts[0];
    // hub -> each, plus a chain between the rest, for a web (not a fan)
    for (let i = 1; i < pts.length; i++) this.addArc(hub, pts[i], col);
    for (let i = 1; i < pts.length - 1; i++) this.addArc(pts[i], pts[i + 1], col);
  }

  private addArc(a: LL, b: LL, color: Cesium.Color) {
    this.webDs.entities.add({
      polyline: {
        positions: arcPositions(a, b),
        width: 1.6,
        arcType: Cesium.ArcType.NONE, // positions already carry arched heights
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.22,
          color: new Cesium.CallbackProperty(() => {
            const a2 = 0.22 + 0.18 * (0.5 + 0.5 * Math.sin(performance.now() / 850));
            return color.withAlpha(a2);
          }, false),
        }),
      },
    });
  }

  /** Reap expired pings. Call once per frame. */
  update() {
    this.reap();
  }

  private reap() {
    if (this.destroyed) return;
    const now = performance.now();
    for (let i = this.pings.length - 1; i >= 0; i--) {
      if (now - this.pings[i].start >= this.pings[i].duration) {
        this.pingDs.entities.remove(this.pings[i].entity);
        this.pings.splice(i, 1);
      }
    }
  }

  setVisible(v: boolean) {
    if (this.destroyed) return;
    this.pingDs.show = v;
    this.webDs.show = v;
    if (!v) {
      this.pingDs.entities.removeAll();
      this.webDs.entities.removeAll();
      this.pings = [];
    }
  }

  destroy() {
    this.destroyed = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    try {
      this.viewer.dataSources.remove(this.pingDs, true);
      this.viewer.dataSources.remove(this.webDs, true);
    } catch {
      /* viewer already torn down */
    }
    this.pings = [];
  }
}

// Great-circle points between a and b, raised into a sine arc so the line bows
// up off the globe (taller for longer hops, capped so it stays graceful).
function arcPositions(a: LL, b: LL): Cesium.Cartesian3[] {
  const start = Cesium.Cartographic.fromDegrees(a.lon, a.lat);
  const end = Cesium.Cartographic.fromDegrees(b.lon, b.lat);
  const geo = new Cesium.EllipsoidGeodesic(start, end);
  const peak = Math.min(geo.surfaceDistance * 0.18, 1_500_000);
  const n = 64;
  const out: Cesium.Cartesian3[] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const c = geo.interpolateUsingFraction(f);
    const h = Math.sin(Math.PI * f) * peak;
    out.push(Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, h));
  }
  return out;
}
