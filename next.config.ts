import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.E2E_BUILD === "true" ? ".next-e2e" : ".next",
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
