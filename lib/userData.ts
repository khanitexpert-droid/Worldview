// Ingest drag-dropped GIS files into Cesium layers.
// Vector  → GeoJsonDataSource / KmlDataSource (GeoJSON, Shapefile-zip, KML/KMZ)
// Raster  → SingleTileImageryProvider over the file's bounding box (GeoTIFF)
// All client-side; no backend.

import * as Cesium from "cesium";
import shp from "shpjs";
import { fromArrayBuffer } from "geotiff";
import type { UserLayer } from "./types";

// Raster (GeoTIFF) import is built but not yet verified end-to-end, so it's
// gated behind an env flag — the live build ships only the tested vector
// formats. Set NEXT_PUBLIC_RASTER_IMPORT=1 to re-enable raster.
const RASTER_ENABLED = process.env.NEXT_PUBLIC_RASTER_IMPORT === "1";

export interface IngestResult {
  kind: UserLayer["kind"];
  format: UserLayer["format"];
  name: string;
  featureCount?: number;
  note?: string;
  dataSource?: Cesium.DataSource; // vector
  imageryLayer?: Cesium.ImageryLayer; // raster
  rectangle?: Cesium.Rectangle; // for zoom-to
}

export function formatFromName(name: string): UserLayer["format"] | null {
  const n = name.toLowerCase();
  if (n.endsWith(".geojson") || n.endsWith(".json")) return "geojson";
  if (n.endsWith(".zip") || n.endsWith(".shp")) return "shapefile";
  if (n.endsWith(".kml") || n.endsWith(".kmz")) return "kml";
  if (n.endsWith(".tif") || n.endsWith(".tiff")) return "geotiff";
  return null;
}

/** Re-style every entity in a vector data source to a color + opacity. */
export function applyVectorStyle(
  ds: Cesium.DataSource,
  colorCss: string,
  opacity: number
) {
  const c = Cesium.Color.fromCssColorString(colorCss);
  for (const e of ds.entities.values) {
    if (e.polygon) {
      e.polygon.material = new Cesium.ColorMaterialProperty(
        c.withAlpha(0.35 * opacity)
      );
      e.polygon.outline = new Cesium.ConstantProperty(true);
      e.polygon.outlineColor = new Cesium.ConstantProperty(c.withAlpha(opacity));
    }
    if (e.polyline) {
      e.polyline.material = new Cesium.ColorMaterialProperty(
        c.withAlpha(opacity)
      );
    }
    if (e.point) {
      e.point.color = new Cesium.ConstantProperty(c.withAlpha(opacity));
      e.point.outlineColor = new Cesium.ConstantProperty(c.withAlpha(opacity));
    }
    if (e.billboard) {
      // GeoJSON points default to pin billboards — tint + fade them
      e.billboard.color = new Cesium.ConstantProperty(c.withAlpha(opacity));
    }
  }
}

function countFeatures(ds: Cesium.DataSource): number {
  return ds.entities.values.length;
}

async function loadGeoJson(
  json: unknown,
  colorCss: string
): Promise<Cesium.GeoJsonDataSource> {
  const c = Cesium.Color.fromCssColorString(colorCss);
  // NOTE: no clampToGround — draping vector geometry onto the globe is very
  // expensive for large datasets. Flat at height 0 looks the same on the
  // (terrain-less) globe and loads far faster.
  return Cesium.GeoJsonDataSource.load(json, {
    stroke: c,
    fill: c.withAlpha(0.35),
    strokeWidth: 2,
    markerColor: c,
  });
}

export async function ingestFile(
  file: File,
  viewer: Cesium.Viewer,
  colorCss: string
): Promise<IngestResult> {
  const format = formatFromName(file.name);
  if (!format) {
    throw new Error(
      `Unsupported file: ${file.name} (use GeoJSON, Shapefile .zip, KML/KMZ, or GeoTIFF)`
    );
  }

  // ---------- VECTOR ----------
  if (format === "geojson") {
    const json = JSON.parse(await file.text());
    const ds = await loadGeoJson(json, colorCss);
    return {
      kind: "vector",
      format,
      name: file.name,
      featureCount: countFeatures(ds),
      dataSource: ds,
    };
  }

  if (format === "shapefile") {
    if (file.name.toLowerCase().endsWith(".shp")) {
      throw new Error(
        "A .shp on its own can't be read — zip the .shp together with its .dbf/.shx/.prj and drop the .zip."
      );
    }
    // shpjs reads a zipped shapefile (.shp/.dbf/.prj/.shx) → GeoJSON in WGS84.
    const buf = await file.arrayBuffer();
    let parsed: unknown;
    try {
      parsed = await shp(buf);
    } catch {
      throw new Error(
        "Couldn't read this shapefile zip — make sure it's a valid .zip containing .shp + .dbf + .shx (+ .prj)."
      );
    }
    // a zip may contain several shapefiles → merge them into one collection
    const geojson = Array.isArray(parsed)
      ? {
          type: "FeatureCollection",
          features: (parsed as Array<{ features?: unknown[] }>).flatMap(
            (g) => g.features ?? []
          ),
        }
      : parsed;
    const ds = await loadGeoJson(geojson, colorCss);
    return {
      kind: "vector",
      format,
      name: file.name,
      featureCount: countFeatures(ds),
      dataSource: ds,
    };
  }

  if (format === "kml") {
    const ds = await Cesium.KmlDataSource.load(file, {
      camera: viewer.scene.camera,
      canvas: viewer.scene.canvas,
      clampToGround: true,
    });
    return {
      kind: "vector",
      format,
      name: file.name,
      featureCount: countFeatures(ds),
      dataSource: ds,
    };
  }

  // ---------- RASTER (GeoTIFF) ----------
  if (!RASTER_ENABLED) {
    throw new Error(
      "Raster (GeoTIFF) import is coming soon — for now drop GeoJSON, Shapefile .zip, or KML."
    );
  }
  return ingestGeoTiff(file);
}

const MAX_TEX = 2048; // cap the rendered texture's long edge (perf + canvas limits)

async function ingestGeoTiff(file: File): Promise<IngestResult> {
  const buf = await file.arrayBuffer();
  const tiff = await fromArrayBuffer(buf);
  const image = await tiff.getImage();

  // Geo metadata + projection check (client-side can only place WGS84 cleanly).
  const keys = (image.getGeoKeys?.() ?? {}) as Record<string, number>;
  const projected = keys.ProjectedCSTypeGeoKey;
  const [west, south, east, north] = image.getBoundingBox();
  const looksLikeDegrees =
    Math.abs(west) <= 180 &&
    Math.abs(east) <= 180 &&
    Math.abs(south) <= 90 &&
    Math.abs(north) <= 90;
  if (projected && projected !== 4326 && !looksLikeDegrees) {
    throw new Error(
      `GeoTIFF is in a projected CRS (EPSG:${projected}); client-side load needs EPSG:4326 (WGS84). Reproject it, or we add a tiling backend.`
    );
  }

  const w = image.getWidth();
  const h = image.getHeight();
  const scale = Math.min(1, MAX_TEX / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const spp = image.getSamplesPerPixel();
  const nodata = image.getGDALNoData?.();
  const data = (await image.readRasters({
    interleave: true,
    width: outW,
    height: outH,
  })) as unknown as ArrayLike<number> & { constructor: { name: string } };

  const isU8 =
    data.constructor.name === "Uint8Array" ||
    data.constructor.name === "Uint8ClampedArray";

  // For non-8-bit data (DEMs, 16-bit imagery), normalize each band to 0..255.
  const bandMin: number[] = new Array(spp).fill(Infinity);
  const bandMax: number[] = new Array(spp).fill(-Infinity);
  if (!isU8) {
    for (let p = 0; p < outW * outH; p++) {
      for (let b = 0; b < spp; b++) {
        const v = data[p * spp + b];
        if (nodata != null && v === nodata) continue;
        if (!Number.isFinite(v)) continue;
        if (v < bandMin[b]) bandMin[b] = v;
        if (v > bandMax[b]) bandMax[b] = v;
      }
    }
  }
  const norm = (v: number, b: number) => {
    if (isU8) return v;
    const lo = bandMin[b];
    const hi = bandMax[b];
    if (!Number.isFinite(lo) || hi === lo) return 0;
    return ((v - lo) / (hi - lo)) * 255;
  };

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2D canvas for GeoTIFF");
  const img = ctx.createImageData(outW, outH);

  for (let p = 0; p < outW * outH; p++) {
    const o = p * 4;
    let alpha = 255;
    const first = data[p * spp];
    if (nodata != null && first === nodata) alpha = 0;
    if (spp >= 3) {
      img.data[o] = norm(data[p * spp], 0);
      img.data[o + 1] = norm(data[p * spp + 1], 1);
      img.data[o + 2] = norm(data[p * spp + 2], 2);
      img.data[o + 3] = spp >= 4 ? data[p * spp + 3] : alpha;
    } else {
      const v = norm(first, 0);
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);

  const rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);
  const provider = await Cesium.SingleTileImageryProvider.fromUrl(
    canvas.toDataURL("image/png"),
    { rectangle }
  );
  const imageryLayer = new Cesium.ImageryLayer(provider);

  return {
    kind: "raster",
    format: "geotiff",
    name: file.name,
    note: `${w}×${h}px${spp >= 3 ? " RGB" : " single-band"}`,
    imageryLayer,
    rectangle,
  };
}
