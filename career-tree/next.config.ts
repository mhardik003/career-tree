import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cap static-generation workers (default: one per core). Each worker loads the
    // full graph dataset, so an uncapped build peaks at multiple GB of aggregate RSS.
    cpus: 4,
  },
};

export default nextConfig;
