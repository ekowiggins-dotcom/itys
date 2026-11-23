import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Every page depends on the signed-in user, so pages render per request (no Cache Components / prerendering).
const nextConfig: NextConfig = {
  // Browser tests run their own dev server next to yours, in a separate build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@electric-sql/pglite"],
  // Pin the project root. Otherwise a stray lockfile in a parent folder can make Next watch that whole
  // folder, including the dev database, and reload the page on every write.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // Apple fetches this exact path to learn which links open the iOS app.
  async rewrites() {
    return [{ source: "/.well-known/apple-app-site-association", destination: "/api/aasa" }];
  },
};

export default nextConfig;
