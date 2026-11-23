/**
 * Server error reporting without a third-party SDK: one JSON line in the host's logs for every server error,
 * and, if ERROR_WEBHOOK_URL is set (a Slack or Discord incoming webhook), a short alert there too.
 * Reports carry no personal data: no query parameters, cookies, headers or request bodies, and only the first
 * line of the error message (database errors list their parameters on later lines).
 */
export type ErrorReport = { message: string; digest?: string; method: string; path: string; route?: string; kind?: string };

export function summarise(err: unknown, request: { method: string; path: string }, context?: { routePath?: string; routeType?: string }): ErrorReport {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const firstLine = raw.split("\n")[0].replace(/params:.*$/i, "").slice(0, 300);
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  return {
    message: firstLine,
    digest,
    method: request.method,
    path: request.path.split("?")[0], // never query strings (tokens can live there)
    route: context?.routePath,
    kind: context?.routeType,
  };
}

export async function reportError(r: ErrorReport) {
  console.error(JSON.stringify({ level: "error", at: new Date().toISOString(), ...r }));
  const hook = process.env.ERROR_WEBHOOK_URL;
  if (!hook) return;
  const line = `Who’ll error on ${r.method} ${r.route ?? r.path}: ${r.message}${r.digest ? ` (digest ${r.digest})` : ""}`;
  try {
    // "text" for Slack, "content" for Discord.
    await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: line, content: line }) });
  } catch {
    // never let reporting break anything
  }
}
