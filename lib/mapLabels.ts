import * as Cesium from "cesium";
import { COUNTRY_CENTROIDS } from "./countryCentroids";
import { CITIES } from "./cities";

// Clean sans for a proper basemap look (the HUD stays mono). System stack is
// always available, so labels render crisply on the Cesium canvas.
const SANS =
  "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const HALO = Cesium.Color.fromCssColorString("#05030a"); // soft dark outline
const CHIP = Cesium.Color.fromCssColorString("#0b0612").withAlpha(0.6); // city pill

// Big oceans — shown when zoomed OUT, placed in deep open water.
const OCEANS: [string, number, number][] = [
  ["North Pacific Ocean", -155, 25],
  ["South Pacific Ocean", -128, -30],
  ["North Atlantic Ocean", -38, 33],
  ["South Atlantic Ocean", -18, -28],
  ["Indian Ocean", 80, -28],
  ["Arctic Ocean", -45, 84],
  ["Southern Ocean", 60, -62],
];

// Smaller seas — only shown at MEDIUM zoom, when there's room for the label to
// sit over the water instead of spilling onto land. Positions are open-water.
const SEAS: [string, number, number][] = [
  ["Mediterranean Sea", 17, 34.6],
  ["Caribbean Sea", -75, 14.5],
  ["Gulf of Mexico", -90, 25],
  ["Bay of Bengal", 88, 13],
  ["Arabian Sea", 63, 14],
  ["South China Sea", 115, 13],
  ["Black Sea", 34, 43],
  ["Red Sea", 38.5, 19.5],
  ["Caspian Sea", 50.5, 41.5],
  ["North Sea", 3, 56],
  ["Baltic Sea", 19.5, 58],
  ["Persian Gulf", 51.5, 27],
  ["Coral Sea", 153, -16],
  ["Tasman Sea", 161, -38],
  ["Sea of Japan", 134.5, 40],
  ["Gulf of Guinea", 2, 1.5],
];

// thin-space letter-spacing for that cartographic "atlas" feel (oceans only)
const spaced = (s: string) => s.toUpperCase().split("").join(" ");
const ll = (lon: number, lat: number) => Cesium.Cartesian3.fromDegrees(lon, lat);
const DDC = (n: number, f: number) => new Cesium.DistanceDisplayCondition(n, f);
const NFS = (n: number, ns: number, f: number, fs: number) =>
  new Cesium.NearFarScalar(n, ns, f, fs);

/**
 * Place-name labels for the globe, in distance-keyed tiers so the map never
 * gets cluttered: big oceans (zoomed out) → countries (default + in) + small
 * seas (medium) → cities with dots (zoomed in). Styled to sit cleanly under the
 * OSINT data without looking busy.
 */
export class MapLabels {
  private scene: Cesium.Scene;
  private labels: Cesium.LabelCollection;
  private dots: Cesium.PointPrimitiveCollection;

  constructor(viewer: Cesium.Viewer) {
    this.scene = viewer.scene;
    this.labels = new Cesium.LabelCollection({ scene: viewer.scene });
    this.dots = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(this.labels);
    viewer.scene.primitives.add(this.dots);
    this.build();
  }

  private build() {
    // ---- big oceans: italic, letter-spaced, faint blue — zoomed out ----
    for (const [name, lon, lat] of OCEANS) {
      this.labels.add({
        position: ll(lon, lat),
        text: spaced(name),
        font: `italic 600 16px ${SANS}`,
        fillColor: Cesium.Color.fromCssColorString("#8ecbff").withAlpha(0.58),
        outlineColor: HALO.withAlpha(0.45),
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        distanceDisplayCondition: DDC(2.4e6, 6e8),
        scaleByDistance: NFS(3e6, 1.0, 6e7, 0.7),
        translucencyByDistance: NFS(3e6, 0.85, 6e7, 0.35),
      });
    }

    // ---- smaller seas: italic, only at medium zoom (room over water) ----
    for (const [name, lon, lat] of SEAS) {
      this.labels.add({
        position: ll(lon, lat),
        text: name,
        font: `italic 600 13px ${SANS}`,
        fillColor: Cesium.Color.fromCssColorString("#8ecbff").withAlpha(0.72),
        outlineColor: HALO.withAlpha(0.5),
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        distanceDisplayCondition: DDC(2.5e5, 9e6),
        scaleByDistance: NFS(5e5, 1.0, 9e6, 0.72),
      });
    }

    // ---- countries: bold BLACK with a white halo so they read on the imagery ----
    for (const [name, [lon, lat]] of Object.entries(COUNTRY_CENTROIDS)) {
      this.labels.add({
        position: ll(lon, lat),
        text: name.toUpperCase(),
        font: `700 15px ${SANS}`,
        fillColor: Cesium.Color.BLACK,
        outlineColor: Cesium.Color.WHITE.withAlpha(0.85),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        // Only appear once you've zoomed into a region (not a whole-continent
        // sweep): hidden beyond ~5,000 km, fading in from ~4,500 km. Keeps the
        // globe and continental views clean — names reveal as you zoom in.
        distanceDisplayCondition: DDC(0, 5e6),
        translucencyByDistance: NFS(3e6, 1.0, 5e6, 0.0),
        // never scale ABOVE 1.0 (upscaling blurs the rasterised text)
        scaleByDistance: NFS(1.2e6, 1.0, 5e6, 0.75),
      });
    }

    // ---- cities: a dot + a crisp label chip, only when zoomed in ----
    const cityDDC = DDC(0, 2.6e6);
    for (const [name, lon, lat] of CITIES) {
      const position = ll(lon, lat);
      this.dots.add({
        position,
        pixelSize: 5,
        color: Cesium.Color.fromCssColorString("#00e5ff").withAlpha(0.95),
        outlineColor: HALO.withAlpha(0.9),
        outlineWidth: 1,
        distanceDisplayCondition: cityDDC,
        scaleByDistance: NFS(2e5, 1.2, 2.6e6, 0.6),
      });
      this.labels.add({
        position,
        text: name,
        font: `600 14px ${SANS}`,
        fillColor: Cesium.Color.fromCssColorString("#eafdff"),
        showBackground: true,
        backgroundColor: CHIP,
        backgroundPadding: new Cesium.Cartesian2(7, 4),
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(9, 0),
        distanceDisplayCondition: cityDDC,
        scaleByDistance: NFS(2e5, 1.0, 2.6e6, 0.78),
      });
    }
  }

  setVisible(v: boolean) {
    if (!this.labels.isDestroyed()) this.labels.show = v;
    if (!this.dots.isDestroyed()) this.dots.show = v;
  }

  destroy() {
    if (!this.labels.isDestroyed()) this.scene.primitives.remove(this.labels);
    if (!this.dots.isDestroyed()) this.scene.primitives.remove(this.dots);
  }
}
