import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/api/services";
import { parseBody, isErrorResponse, handleServiceError } from "@/lib/api/helpers";
import { SetTimezoneSchema } from "@/lib/validators/settings";
import { setUserTimezone } from "@/lib/date-ranges";

export function GET(): NextResponse {
  const timezone = getSettingsService().getTimezone();
  return NextResponse.json({ timezone });
}

export async function PUT(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, SetTimezoneSchema);
  if (isErrorResponse(input)) return input;

  try {
    getSettingsService().setTimezone(input.timezone);
    setUserTimezone(input.timezone);
    return NextResponse.json({ timezone: input.timezone });
  } catch (err) {
    return handleServiceError(err);
  }
}
