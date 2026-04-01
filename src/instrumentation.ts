export async function register(): Promise<void> {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { initCronJobs } = await import("@/lib/cron");
    const { getSettingsService } = await import("@/lib/api/services");
    const { setUserTimezone } = await import("@/lib/date-ranges");

    const tz = getSettingsService().getTimezone();
    if (tz) setUserTimezone(tz);

    initCronJobs();
  }
}
