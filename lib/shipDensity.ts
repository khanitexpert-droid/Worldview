import * as Cesium from "cesium";
import * as Lerc from "lerc";

// SHIPPING ROUTES — global AIS traffic density (World Bank / IMF, 2015–2021),
// hosted as an ArcGIS tiled Image Service in LERC format. There's no rendered
// (PNG) tile and exportImage is disabled, so we fetch the raw LERC raster tiles,
// decode them client-side, and paint a density colormap ourselves. No hosting
// needed — the World Bank tiles are public + CORS-enabled.
const TILE =
  "https://tiledimageservices.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Global_Ship_Density_Global/ImageServer/tile";

let lercReady: Promise<unknown> | null = null;
// the lerc wasm is served from /public so the bundler doesn't have to resolve it
const ensureLerc = () =>
  (lercReady ??= Lerc.load({ locateFile: () => "/lerc-wasm.wasm" }));

// density ramp: vivid even for light traffic — cyan → green → yellow → orange
const STOPS: [number, [number, number, number]][] = [
  [0.0, [0, 200, 255]],
  [0.4, [40, 255, 150]],
  [0.7, [200, 255, 60]],
  [1.0, [255, 170, 40]],
];
function ramp(t: number): [number, number, number] {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      const f = (t - t0) / (t1 - t0 || 1);
      return [
        c0[0] + (c1[0] - c0[0]) * f,
        c0[1] + (c1[1] - c0[1]) * f,
        c0[2] + (c1[2] - c0[2]) * f,
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

const blankTile = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  return c;
};

/**
 * A Cesium ImageryProvider that renders the World Bank/IMF global ship-density
 * LERC tiles with a density colormap. Geographic (WGS84) tiling to match the
 * service cache.
 */
export function createShipDensityProvider(): Cesium.ImageryProvider {
  const tilingScheme = new Cesium.GeographicTilingScheme();
  const provider = {
    tileWidth: 256,
    tileHeight: 256,
    maximumLevel: 6,
    minimumLevel: 0,
    tilingScheme,
    rectangle: tilingScheme.rectangle,
    tileDiscardPolicy: undefined,
    errorEvent: new Cesium.Event(),
    credit: new Cesium.Credit("Ship density © World Bank / IMF"),
    hasAlphaChannel: true,
    proxy: undefined,
    getTileCredits: () => [],
    pickFeatures: () => undefined,
    requestImage: async (x: number, y: number, level: number) => {
      try {
        await ensureLerc();
        const res = await fetch(`${TILE}/${level}/${y}/${x}`);
        if (!res.ok) return blankTile(); // empty/uncached cell → transparent
        const dec = Lerc.decode(await res.arrayBuffer()) as {
          width: number;
          height: number;
          pixels: ArrayLike<number>[];
          mask?: Uint8Array;
        };
        const { width: w, height: h } = dec;
        const px = dec.pixels[0];
        const mask = dec.mask;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return blankTile();
        const img = ctx.createImageData(w, h);
        for (let i = 0; i < w * h; i++) {
          const v = !mask || mask[i] ? (px[i] as number) : 0;
          if (v > 0) {
            const t = Math.min(Math.log10(v + 1) / 4.0, 1); // log scale
            const [r, g, b] = ramp(t);
            const o = i * 4;
            img.data[o] = r;
            img.data[o + 1] = g;
            img.data[o + 2] = b;
            // high opacity floor so even light traffic is clearly visible
            img.data[o + 3] = Math.round(Math.min(0.5 + t * 0.5, 1) * 255);
          }
        }
        ctx.putImageData(img, 0, 0);
        return canvas;
      } catch {
        return blankTile();
      }
    },
  };
  return provider as unknown as Cesium.ImageryProvider;
}
