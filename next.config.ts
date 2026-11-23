import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Every page depends on the signed-in user, so pages render per request (no Cache Components / prerendering).
const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Pin the project root. Otherwise a stray lockfile in a parent folder can make Next watch that whole
  // folder, including the dev database, and reload the page on every write.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};

export default nextConfig;
