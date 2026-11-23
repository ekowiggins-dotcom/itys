/**
 * In development (and in production only when RUN_JOBS_IN_PROCESS=1), run the job runner inside the web server
 * every 30 seconds. Production normally uses the cron endpoint or `npm run worker` instead, so background
 * work never competes with serving pages. Running more than one runner is safe: due calls are claimed
 * with SKIP LOCKED.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
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
