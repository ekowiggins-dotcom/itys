import type { NextConfig } from "next";

// Every page depends on the signed-in user, so pages render per request (no Cache Components / prerendering).
const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
