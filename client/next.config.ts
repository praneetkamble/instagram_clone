import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  env: {
    BACKEND_URL: process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
    IMGBB_API_KEY: process.env.IMGBB_API_KEY,
  },
  images: { unoptimized: true },
};
export default nextConfig;
