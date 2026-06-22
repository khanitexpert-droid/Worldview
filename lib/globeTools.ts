import * as Cesium from "cesium";

// On-globe measurement + highlight tools (TOOLS panel). Each manages its own
// CustomDataSource, mirroring the SatelliteField / MapLabels / EventFx pattern.

export type MeasureMode = "distance" | "radius";
export type MeasureUnit = "km" | "nm" | "mi";

const LIME = Cesium.Color.fromCssColorString("#aaff00"); // deltasweep-style measure
const WHITE = Cesium.Color.WHITE;
const GOLD = Cesium.Color.fromCssColorString("#ffe14d"); // highlight
const ALWAYS = Number.POSITIVE_INFINITY; // disableDepthTestDistance (keep visible)
const MONO = "bold 13px ui-monospace, SFMono-Regular, Menlo, monospace";

function fmt(meters: number, unit: MeasureUnit): string {
  if (unit === "nm") return `${(meters / 1852).toFixed(1)} nm`;
  if (unit === "mi") return `${(meters / 1609.344).toFixed(1)} mi`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// geodesic (great-circle) surface distance between two surface points, metres
function geoDist(a: Cesium.Cartesian3, b: Cesium.Cartesian3): number {
  const ca = Cesium.Cartographic.fromCartesian(a);
  const cb = Cesium.Cartographic.fromCartesian(b);
  return new Cesium.EllipsoidGeodesic(ca, cb).surfaceDistance;
}

export class MeasureTool {
  private viewer: Cesium.Viewer;
  private ds: Cesium.CustomDataSource;
  private mode: MeasureMode = "distance";
  private unit: MeasureUnit = "km";
  private points: Cesium.Cartesian3[] = [];
  private cursor: Cesium.Cartesian3 | null = null; // live rubber-band end
  private onReadout?: (text: string | null) => void;

  constructor(viewer: Cesium.Viewer, onReadout?: (t: string | null) => void) {
    this.viewer = viewer;
    this.onReadout = onReadout;
    this.ds = new Cesium.CustomDataSource("measure");
    viewer.dataSources.add(this.ds);
  }

  setMode(m: MeasureMode) {
    if (this.mode !== m) {
      this.mode = m;
      this.clear(); // distance / radius geometry differ — start fresh
    }
  }
  setUnit(u: MeasureUnit) {
    this.unit = u;
    this.redraw();
  }

  /** a clicked point on the globe */
  add(cart: Cesium.Cartesian3) {
    if (this.mode === "radius" && this.points.length >= 2) {
      this.points = []; // a completed circle — start a new one
      this.cursor = null;
    }
    this.points.push(cart.clone());
    this.redraw();
  }

  /**
   * Live cursor preview. Only RADIUS uses a rubber-band (drag centre → edge).
   * DISTANCE intentionally has NO rubber-band: each click commits a point, so a
   * finished line stops at the last point instead of trailing the cursor —
   * click again to extend it.
   */
  move(cart: Cesium.Cartesian3 | null) {
    if (this.mode !== "radius") return;
    if (this.points.length >= 2) return; // circle locked after centre + edge
    this.cursor = cart;
    if (this.points.length) this.redraw();
  }

  clear() {
    this.points = [];
    this.cursor = null;
    this.ds.entities.removeAll();
    this.onReadout?.(null);
  }

  private redraw() {
    this.ds.entities.removeAll();
    if (this.mode === "distance") this.drawDistance();
    else this.drawRadius();
  }

  private drawDistance() {
    this.points.forEach((p) => this.dot(p));
    const pts = [...this.points]; // committed points only — no cursor rubber-band
    if (pts.length < 2) {
      this.onReadout?.(this.points.length ? fmt(0, this.unit) : null);
      return;
    }
    this.ds.entities.add({
      polyline: {
        positions: pts,
        width: 2.5,
        material: LIME,
        arcType: Cesium.ArcType.GEODESIC,
      },
    });
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = geoDist(pts[i - 1], pts[i]);
      total += d;
      const mid = Cesium.Cartesian3.midpoint(
        pts[i - 1],
        pts[i],
        new Cesium.Cartesian3()
      );
      this.label(mid, fmt(d, this.unit));
    }
    this.label(pts[pts.length - 1], `Total: ${fmt(total, this.unit)}`, true);
    this.onReadout?.(fmt(total, this.unit));
  }

  private drawRadius() {
    if (!this.points.length) {
      this.onReadout?.(null);
      return;
    }
    const center = this.points[0];
    this.dot(center);
    const edge = this.points[1] ?? this.cursor;
    if (!edge) {
      this.onReadout?.(fmt(0, this.unit));
      return;
    }
    const r = geoDist(center, edge);
    this.ds.entities.add({
      position: center,
      ellipse: {
        semiMajorAxis: r,
        semiMinorAxis: r,
        material: LIME.withAlpha(0.1),
        outline: true,
        outlineColor: LIME,
        outlineWidth: 2,
        height: 0,
      },
    });
    this.ds.entities.add({
      polyline: {
        positions: [center, edge],
        width: 2,
        material: LIME,
        arcType: Cesium.ArcType.GEODESIC,
      },
    });
    this.dot(edge);
    this.label(edge, `R: ${fmt(r, this.unit)}`, true);
    this.onReadout?.(`R ${fmt(r, this.unit)}`);
  }

  private dot(p: Cesium.Cartesian3) {
    this.ds.entities.add({
      position: p,
      point: {
        pixelSize: 9,
        color: WHITE,
        outlineColor: LIME,
        outlineWidth: 2,
        disableDepthTestDistance: ALWAYS,
      },
    });
  }

  private label(p: Cesium.Cartesian3, text: string, big = false) {
    this.ds.entities.add({
      position: p,
      label: {
        text,
        font: MONO,
        fillColor: Cesium.Color.BLACK,
        showBackground: true,
        backgroundColor: LIME.withAlpha(big ? 0.95 : 0.88),
        backgroundPadding: new Cesium.Cartesian2(7, 4),
        style: Cesium.LabelStyle.FILL,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        disableDepthTestDistance: ALWAYS,
      },
    });
  }

  destroy() {
    this.viewer.dataSources.remove(this.ds, true);
  }
}

export class HighlightTool {
  private viewer: Cesium.Viewer;
  private ds: Cesium.CustomDataSource;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.ds = new Cesium.CustomDataSource("highlight");
    viewer.dataSources.add(this.ds);
  }

  /** drop a glowing highlight (translucent disc + ring + centre dot) */
  add(cart: Cesium.Cartesian3) {
    this.ds.entities.add({
      position: cart,
      ellipse: {
        semiMajorAxis: 50000,
        semiMinorAxis: 50000,
        material: GOLD.withAlpha(0.18),
        outline: true,
        outlineColor: GOLD,
        outlineWidth: 2,
        height: 0,
      },
    });
    this.ds.entities.add({
      position: cart,
      point: {
        pixelSize: 8,
        color: GOLD,
        outlineColor: Cesium.Color.fromCssColorString("#3a3000"),
        outlineWidth: 1,
        disableDepthTestDistance: ALWAYS,
      },
    });
  }

  clear() {
    this.ds.entities.removeAll();
  }

  destroy() {
    this.viewer.dataSources.remove(this.ds, true);
  }
}
