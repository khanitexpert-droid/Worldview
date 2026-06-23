// Ingest drag-dropped GIS files into Cesium layers.
// Vector  → GeoJsonDataSource / KmlDataSource (GeoJSON, Shapefile-zip, KML/KMZ)
// Raster  → TIFFImageryProvider (GeoTIFF/COG): streams the file's own internal
//           tiles + overview pyramid and shows the right level for the current
//           zoom, so it stays sharp and reads only the visible tiles (handles
//           multi-GB COGs). Replaces the old "downsample to one 2048px texture".
// All client-side; no backend.

import * as Cesium from "cesium";
import shp from "shpjs";
import { fromBlob, fromUrl } from "geotiff";
import { TIFFImageryProvider } from "tiff-imagery-provider";
import proj4 from "proj4";
import type { UserLayer } from "./types";

/**
 * Reproject a COG's CRS to WGS84 for the tiled provider. EPSG:4326 / 3857 are
 * handled natively (return undefined). proj4 only ships 4326/3857 defs, so we
 * derive UTM strings from the EPSG code, covering the CRSs almost all real
 * imagery uses: 326## = WGS84/UTM ## N, 327## = WGS84/UTM ## S (Sentinel-2,
 * Landsat, drone), and 269## = NAD83/UTM ## N (US NAIP etc.). Unknown CRSs
 * return undefined and the provider raises a clear error (reproject it first
 * with `gdalwarp -t_srs EPSG:4326`).
 */
function cogProjFunc(code: number) {
  if (code === 4326 || code === 3857) return undefined;
  let def: string | null = null;
  if (code >= 32601 && code <= 32660)
    def = `+proj=utm +zone=${code - 32600} +datum=WGS84 +units=m +no_defs +type=crs`;
  else if (code >= 32701 && code <= 32760)
    def = `+proj=utm +zone=${code - 32700} +south +datum=WGS84 +units=m +no_defs +type=crs`;
  else if (code >= 26901 && code <= 26923)
    def = `+proj=utm +zone=${code - 26900} +datum=NAD83 +units=m +no_defs +type=crs`;
  if (!def) return undefined;
  const conv = proj4(def, "WGS84");
  return {
    project: (pos: number[]) => conv.inverse(pos), // [lon,lat] → [x,y]
    unproject: (pos: number[]) => conv.forward(pos), // [x,y] → [lon,lat]
  };
}

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
  return ingestGeoTiff(file);
}

async function ingestGeoTiff(file: File): Promise<IngestResult> {
  // 1) Read ONLY the header/metadata via partial (range) reads — never pull the
  //    whole file into memory, so multi-GB COGs are fine. getImageCount() is the
  //    number of IFDs = the full-resolution image + its overview levels (= the
  //    pyramid). >1 means the file has overviews and will stay sharp + fast.
  let w = 0;
  let h = 0;
  let levels = 1;
  try {
    const tiff = await fromBlob(file);
    const image = await tiff.getImage();
    w = image.getWidth();
    h = image.getHeight();
    levels = await tiff.getImageCount();
  } catch {
    // non-fatal — the tiled provider below re-reads the file itself
  }

  // 2) Tiled provider: streams the COG's internal tiles + overviews and shows
  //    the right level for the current zoom (the fix for the blurry single
  //    2048px texture). Reads only the visible tiles, and reprojects common
  //    CRSs (Web Mercator / UTM) onto the globe on the fly.
  let provider: TIFFImageryProvider;
  try {
    provider = await TIFFImageryProvider.fromUrl(file, {
      projFunc: cogProjFunc,
      // the provider defaults to nearest-neighbour resampling (hard blocky
      // pixels when scaled); bilinear + larger tiles match QGIS's smooth look.
      tileSize: 512,
      renderOptions: { resampleMethod: "bilinear" },
    });
  } catch (err) {
    throw new Error(
      `Couldn't tile this GeoTIFF — ${
        err instanceof Error ? err.message : String(err)
      }. Tip: convert it to a Cloud-Optimized GeoTIFF first ` +
        `(gdal_translate in.tif out_cog.tif -of COG).`
    );
  }

  // The provider's bundled typings union ImageData into requestImage()'s return,
  // which Cesium's ImageryProvider type doesn't list — a types-only mismatch
  // (runtime is a valid Cesium imagery provider), so cast across it.
  const cesiumProvider = provider as unknown as Cesium.ImageryProvider;
  const imageryLayer = new Cesium.ImageryLayer(cesiumProvider);
  const rectangle = cesiumProvider.rectangle
    ? Cesium.Rectangle.clone(cesiumProvider.rectangle)
    : undefined;

  const sizeStr = w ? `${w.toLocaleString()}×${h.toLocaleString()}px · ` : "";
  const pyramidStr =
    levels > 1
      ? `${levels} levels · tiled COG`
      : "no overviews — add a pyramid (gdaladdo) for best zoom";

  return {
    kind: "raster",
    format: "geotiff",
    name: file.name,
    note: `${sizeStr}${pyramidStr}`,
    imageryLayer,
    rectangle,
  };
}

/**
 * Load a Cloud-Optimized GeoTIFF straight from a URL — the provider issues HTTP
 * range requests and pulls only the tiles it needs, so a 4 GB COG never has to
 * be downloaded in full. Great for trying public COGs. The host MUST allow CORS.
 */
export async function ingestCogUrl(url: string): Promise<IngestResult> {
  // read the header (IFD count = full-res image + overview levels) so the panel
  // can show whether this is a real COG (has overviews) or a plain TIFF.
  let levels = 0;
  try {
    const tiff = await fromUrl(url);
    levels = await tiff.getImageCount();
  } catch {
    // non-fatal — provider below re-reads the file
  }
  let provider: TIFFImageryProvider;
  try {
    provider = await TIFFImageryProvider.fromUrl(url, {
      projFunc: cogProjFunc,
      // smooth (bilinear) resampling + larger tiles to match QGIS quality;
      // the provider otherwise defaults to blocky nearest-neighbour.
      tileSize: 512,
      renderOptions: { resampleMethod: "bilinear" },
    });
  } catch (err) {
    throw new Error(
      `Couldn't load COG from URL — ${
        err instanceof Error ? err.message : String(err)
      }. The host must allow CORS and the file should be a Cloud-Optimized GeoTIFF.`
    );
  }
  // The provider's bundled typings union ImageData into requestImage()'s return,
  // which Cesium's ImageryProvider type doesn't list — a types-only mismatch
  // (runtime is a valid Cesium imagery provider), so cast across it.
  const cesiumProvider = provider as unknown as Cesium.ImageryProvider;
  const imageryLayer = new Cesium.ImageryLayer(cesiumProvider);
  const rectangle = cesiumProvider.rectangle
    ? Cesium.Rectangle.clone(cesiumProvider.rectangle)
    : undefined;
  let name = "remote COG";
  try {
    name = decodeURIComponent(url.split("?")[0].split("/").pop() || name);
  } catch {
    /* keep default */
  }
  const note =
    levels > 1
      ? `${levels} levels · tiled COG ✓`
      : levels === 1
        ? "plain TIFF · NO overviews ✗"
        : "streamed · range requests";
  return {
    kind: "raster",
    format: "geotiff",
    name,
    note,
    imageryLayer,
    rectangle,
  };
}
