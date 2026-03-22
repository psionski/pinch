import { redirect } from "next/navigation";
import { getSettingsService } from "@/lib/api/services";

/** Redirects to /settings if timezone is not configured. Returns the timezone. */
export function requireTimezone(): string {
  const tz = getSettingsService().getTimezone();
  if (tz === null) redirect("/settings");
  return tz;
}
