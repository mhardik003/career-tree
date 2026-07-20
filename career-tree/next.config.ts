import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cap static-generation workers (default: one per core). Each worker loads the
    // full graph dataset, so an uncapped build peaks at multiple GB of aggregate RSS.
    cpus: 4,
  },
  // Per-node facts are read from disk at render time (lib/v2/facts.ts), not
  // imported, so Vercel's output file tracing cannot discover them. Every
  // route that calls getFacts must list the facts directory here; without it
  // the routes work locally but 500 on Vercel the moment they render on
  // demand (both pages are fully prerendered today, but this becomes
  // load-bearing when they move to ISR). Top-level key — not experimental —
  // since Next 15.
  outputFileTracingIncludes: {
    "/careers/[type]/[slug]": ["./data/v2/facts/**"],
    "/explore/[type]/[slug]": ["./data/v2/facts/**"],
  },
};

export default nextConfig;
