import { z } from "zod";

/** Validates an IANA timezone identifier (e.g. "Europe/Amsterdam", "UTC"). */
export const TimezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid IANA timezone identifier" }
);

export const SetTimezoneSchema = z.object({
  timezone: TimezoneSchema,
});

export type SetTimezoneInput = z.infer<typeof SetTimezoneSchema>;
