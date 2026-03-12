/**
 * Next.js Instrumentation Hook
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * This runs once when the server starts, making it the right place
 * to kick off the cron scheduler.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startScheduler } = await import("./src/lib/scheduler");
        try {
            await startScheduler();
            console.log("[instrumentation] Scheduler started ✓");
        } catch (e) {
            console.error("[instrumentation] Scheduler failed to start:", e);
        }
    }
}
