import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // `ws` relies on Node-specific buffer helpers. Bundling it into a serverless
  // chunk can break frame masking at runtime (`mask is not a function`).
  serverExternalPackages: ["ws"],
  experimental: {
    // The managed runner cannot capture detached CLI output used by Next's
    // default TypeScript check. The compiler API performs the same validation.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
