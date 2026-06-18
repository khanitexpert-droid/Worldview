import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cesium is ESM-only and needs to be transpiled for webpack (production builds)
  transpilePackages: ["cesium"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        url: false,
      };
    }
    return config;
  },
};

export default nextConfig;
