import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The managed runner cannot capture detached CLI output used by Next's
    // default TypeScript check. The compiler API performs the same validation.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
