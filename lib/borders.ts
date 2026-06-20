import * as Cesium from "cesium";

// Dark, prominent border colour that reads against the bright imagery.
const BORDER = Cesium.Color.fromCssColorString("#0a0a12").withAlpha(0.92);
// Lift the lines a hair off the ellipsoid so they don't z-fight the surface.
// 2 km is sub-pixel at globe scale (the globe has no 3D terrain).
const RAISE = 2000;
const WIDTH = 1.8;

/**
 * World country borders. Parses the bundled Natural Earth 50m countries GeoJSON
 * (public/countries.geojson) and draws every ring (incl. enclaves) as a dark
 * polyline so each country is outlined. Plain (non-clamped) polylines are far
 * cheaper than ground-clamped ones, which matters with thousands of outlines —
 * fine here because the globe is a smooth ellipsoid (no 3D terrain).
 */
export async function loadBorders(
  viewer: Cesium.Viewer
): Promise<Cesium.CustomDataSource | null> {
  try {
    const res = await fetch("/countries.geojson");
    if (!res.ok) throw new Error(`borders ${res.status}`);
    const geo = (await res.json()) as {
      features?: { geometry?: { type: string; coordinates: unknown } }[];
    };

    const ds = new Cesium.CustomDataSource("borders");
    const material = new Cesium.ColorMaterialProperty(BORDER);

    const addRing = (ring: [number, number][]) => {
      if (!ring || ring.length < 2) return;
      const positions = ring.map(([lon, lat]) =>
        Cesium.Cartesian3.fromDegrees(lon, lat, RAISE)
      );
      ds.entities.add({
        polyline: {
          positions,
          width: WIDTH,
          material,
          arcType: Cesium.ArcType.GEODESIC,
        },
      });
    };

    for (const f of geo.features ?? []) {
      const g = f.geometry;
      if (!g) continue;
      if (g.type === "Polygon") {
        (g.coordinates as [number, number][][]).forEach(addRing);
      } else if (g.type === "MultiPolygon") {
        (g.coordinates as [number, number][][][]).forEach((poly) =>
          poly.forEach(addRing)
        );
      }
    }

    if (viewer.isDestroyed()) return null;
    viewer.dataSources.add(ds);
    return ds;
  } catch (err) {
    console.error("[worldview] country borders failed to load", err);
    return null;
  }
}
