"use client";

import { setUserTimezone } from "@/lib/date-ranges";

/**
 * Receives the app timezone from the server layout and sets it
 * in the client-side date module before any other component renders.
 */
export function TimezoneInit({ timezone }: { timezone: string }): null {
  setUserTimezone(timezone);
  return null;
}
