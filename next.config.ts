import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship browser source maps in production so stack traces (and Lighthouse's
  // `valid-source-maps` audit) resolve against the real three.js/R3F chunk.
  productionBrowserSourceMaps: true,
};

export default nextConfig;
