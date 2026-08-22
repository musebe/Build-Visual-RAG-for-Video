import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  env: {
    // Analytics: Mark this project as created via create-cloudinary-next CLI
    CLOUDINARY_SOURCE: "cli",
  },
};

export default nextConfig;
