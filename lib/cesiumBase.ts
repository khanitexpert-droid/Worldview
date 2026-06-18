// Must run BEFORE the `cesium` package is evaluated so it can find its
// workers/assets, which we copied into /public/cesium.
declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

if (typeof window !== "undefined") {
  window.CESIUM_BASE_URL = "/cesium";
}

export {};
