import type { NextConfig } from "next";

// Pin the workspace root explicitly. Without this, Next.js walks up from this
// directory looking for lockfiles and can latch onto an unrelated one outside
// the repo (e.g. a stray package-lock.json in a parent directory), which then
// throws off Turbopack's resolution and output file tracing for serverless
// bundles at deploy time.
const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
