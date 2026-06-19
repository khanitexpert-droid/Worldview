import * as Cesium from "cesium";
import { COUNTRY_CENTROIDS } from "./countryCentroids";
import { CITIES } from "./cities";

// Ocean / sea labels (zoomed-out tier): [name, lon, lat] at a representative
// open-water point.
const OCEANS: [string, number, number][] = [
  ["North Pacific Ocean", -160, 28],
  ["South Pacific Ocean", -125, -30],
  ["North Atlantic Ocean", -40, 33],
  ["South Atlantic Ocean", -15, -28],
  ["Indian Ocean", 78, -28],
  ["Arctic Ocean", 0, 86],
  ["Southern Ocean", 40, -62],
  ["Mediterranean Sea", 17, 35],
  ["Caribbean Sea", -75, 15],
  ["Gulf of Mexico", -90, 25],
  ["Bay of Bengal", 88, 13],
  ["Arabian Sea", 63, 14],
  ["South China Sea", 114, 13],
  ["Black Sea", 34, 43],
  ["Red Sea", 38, 20],
  ["Caspian Sea", 50, 41],
  ["North Sea", 3, 56],
  ["Coral Sea", 155, -18],
  ["Sea of Japan", 135, 40],
];

const DARK = Cesium.Color.fromCssColorString("#0b0612");
const FONT = "'Geist Mono', ui-monospace, 'Courier New', monospace";

/**
 * Place-name labels for the globe — three tiers that fade in/out by camera
 * distance: oceans (zoomed out), countries (default + in), cities (zoomed in).
 * Styled to match the synthwave HUD. Owns a single LabelCollection.
 */
export class MapLabels {
  private scene: Cesium.Scene;
  private labels: Cesium.LabelCollection;

  constructor(viewer: Cesium.Viewer) {
    this.scene = viewer.scene;
    // passing `scene` lets labels be correctly occluded by the globe
    this.labels = new Cesium.LabelCollection({ scene: viewer.scene });
    viewer.scene.primitives.add(this.labels);
    this.build();
  }

  private build() {
    // ---- oceans / seas: italic blue, visible when zoomed out ----
    for (const [name, lon, lat] of OCEANS) {
      this.labels.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        text: name.toUpperCase(),
        font: `italic 600 15px ${FONT}`,
        fillColor: Cesium.Color.fromCssColorString("#7fc8ff").withAlpha(0.6),
        outlineColor: DARK.withAlpha(0.7),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(1.6e6, 6e8),
        scaleByDistance: new Cesium.NearFarScalar(2e6, 1.15, 5e7, 0.6),
        translucencyByDistance: new Cesium.NearFarScalar(2e6, 0.85, 6e7, 0.35),
      });
    }

    // ---- countries: light lavender, visible from default zoom inward ----
    for (const [name, [lon, lat]] of Object.entries(COUNTRY_CENTROIDS)) {
      this.labels.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        text: name.toUpperCase(),
        font: `600 13px ${FONT}`,
        fillColor: Cesium.Color.fromCssColorString("#e8d9ff").withAlpha(0.92),
        outlineColor: DARK.withAlpha(0.85),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3.4e7),
        scaleByDistance: new Cesium.NearFarScalar(1.2e6, 1.0, 2.2e7, 0.48),
        translucencyByDistance: new Cesium.NearFarScalar(1.2e6, 1.0, 3.0e7, 0.4),
      });
    }

    // ---- cities: cyan with a dot, only when zoomed in close ----
    const cityDDC = new Cesium.DistanceDisplayCondition(0, 2.2e6);
    for (const [name, lon, lat] of CITIES) {
      const position = Cesium.Cartesian3.fromDegrees(lon, lat);
      this.labels.add({
        position,
        text: `◦ ${name}`,
        font: `500 12px ${FONT}`,
        fillColor: Cesium.Color.fromCssColorString("#a9ecff").withAlpha(0.95),
        outlineColor: DARK.withAlpha(0.85),
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(2, 0),
        distanceDisplayCondition: cityDDC,
        scaleByDistance: new Cesium.NearFarScalar(2e5, 1.0, 2.2e6, 0.5),
      });
    }
  }

  setVisible(v: boolean) {
    if (!this.labels.isDestroyed()) this.labels.show = v;
  }

  destroy() {
    // primitives.remove() also destroys the collection
    if (!this.labels.isDestroyed()) this.scene.primitives.remove(this.labels);
  }
}
