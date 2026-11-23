/**
 * In development (and in production only when RUN_JOBS_IN_PROCESS=1), run the job runner inside the web server
 * every 30 seconds. Production normally uses the cron endpoint or `npm run worker` instead, so background
 * work never competes with serving pages. Running more than one runner is safe: due calls are claimed
 * with SKIP LOCKED.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // App Review: make sure the review account's demo group exists (no-op unless REVIEW_EMAIL/REVIEW_CODE are set).
  if (process.env.REVIEW_EMAIL && process.env.REVIEW_CODE) {
    const [{ getDb }, { ensureReviewDemo }] = await Promise.all([import("./server/db"), import("./server/review")]);
    ensureReviewDemo(await getDb()).catch((e) => console.error("Review demo setup failed.", e));
  }
  const inProcess = process.env.NODE_ENV === "development" || process.env.RUN_JOBS_IN_PROCESS === "1";
  if (!inProcess) return;
  const g = globalThis as unknown as { whollJobs?: ReturnType<typeof setInterval> };
  if (g.whollJobs) return;
  const { runJobsOnce } = await import("./server/jobs");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runJobsOnce();
    } catch (e) {
      console.error("Job runner failed; it will retry on the next tick.", e);
    } finally {
      running = false;
    }
  };
  g.whollJobs = setInterval(tick, 30_000);
  g.whollJobs.unref?.();
}

/** Every server error: one JSON log line, plus an optional webhook alert (see src/server/error-report.ts). */
export async function onRequestError(
  err: unknown,
  request: { method: string; path: string },
  context: { routePath?: string; routeType?: string },
) {
  const { reportError, summarise } = await import("./server/error-report");
  await reportError(summarise(err, request, context));
}
