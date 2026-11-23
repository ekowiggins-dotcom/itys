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
  // Security headers on every response.
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
    }
    return [{ source: "/:path*", headers }];
  },
  // Apple fetches this exact path to learn which links open the iOS app.
  async rewrites() {
    return [{ source: "/.well-known/apple-app-site-association", destination: "/api/aasa" }];
  },
};

export default nextConfig;
