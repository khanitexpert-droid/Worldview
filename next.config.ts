import type { NextConfig } from "next";

// Cesium notes:
// - The SWC minifier (used by both Turbopack and Next's webpack) corrupts
//   Cesium's embedded worker strings — it emits invalid octal escapes inside
//   template strings, which crashes the page at runtime. The un-minified dev
//   build is fine, so the production build runs on webpack
//   (`next build --webpack`) with JS minification disabled.
// - `turbopack: {}` is present only to silence the "webpack config without
//   turbopack config" notice during `next dev` (which still uses Turbopack).
const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, { isServer, webpack }) => {
    config.optimization.minimize = false;
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
      };
    }
    // satellite.js v7 lazily `import()`s a WASM bulk-propagator runtime
    // (`#wasm-single-thread` / `#wasm-multi-thread`) that pulls in
    // node:worker_threads / node:module — not bundlable for the browser. We only
    // use its pure-JS SGP4 path, so stop webpack from trying to bundle those
    // WASM entry points (the dynamic import is never executed at runtime).
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^#wasm-(single|multi)-thread$/,
      })
    );
    return config;
  },
};

export default nextConfig;
