// Starts the app for browser tests: a fresh embedded database in a temp folder, the demo seed, then `next dev`.
// Used by playwright.config.ts (webServer). Never touches your normal dev database.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = {
  ...process.env,
  PGLITE_DIR: mkdtempSync(join(tmpdir(), "wholl-e2e-")),
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};
delete env.DATABASE_URL;
const seed = spawnSync("npx", ["tsx", "scripts/seed-dev.mts"], { env, stdio: "inherit" });
if (seed.status !== 0) process.exit(seed.status ?? 1);
const port = process.env.E2E_PORT ?? "3100";
const server = spawn("npx", ["next", "dev", "-p", port], { env, stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.kill(sig));
// Remove the throwaway database when the server stops.
server.on("exit", (code) => {
  rmSync(env.PGLITE_DIR, { recursive: true, force: true });
  process.exit(code ?? 0);
});
