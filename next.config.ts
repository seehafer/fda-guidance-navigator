import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external PDF URLs
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.fda.gov",
      },
    ],
  },
  // Empty turbopack config to silence the warning
  turbopack: {},
  // Webpack configuration for PDF.js (used in webpack mode)
  webpack: (config) => {
    // Handle canvas module (not needed in browser)
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
