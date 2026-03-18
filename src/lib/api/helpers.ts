import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { ErrorCode, ErrorResponse } from "@/lib/validators/common";

/** Return a structured JSON error response. */
export function errorResponse(
  message: string,
  code: ErrorCode,
  status: number,
  details?: unknown
): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: message, code, details }, { status });
}

/** Parse and validate a JSON request body against a Zod schema. */
export async function parseBody<T>(
  req: Request,
  schema: ZodType<T>
): Promise<T | NextResponse<ErrorResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", "VALIDATION_ERROR", 400);
  }
  return parseWith(body, schema);
}

/** Parse query/search params into a plain object with number coercion, then validate. */
export function parseSearchParams<T>(
  url: string,
  schema: ZodType<T>
): T | NextResponse<ErrorResponse> {
  const { searchParams } = new URL(url);
  const raw: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    // Support array params: ?tags=a&tags=b
    if (raw[key] !== undefined) {
      if (Array.isArray(raw[key])) {
        (raw[key] as unknown[]).push(coerce(value));
      } else {
        raw[key] = [raw[key], coerce(value)];
      }
    } else {
      raw[key] = coerce(value);
    }
  }
  return parseWith(raw, schema);
}

/** Validate data against a Zod schema and return the parsed result or an error response. */
function parseWith<T>(data: unknown, schema: ZodType<T>): T | NextResponse<ErrorResponse> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return errorResponse(
      "Validation failed",
      "VALIDATION_ERROR",
      400,
      formatZodError(result.error)
    );
  }
  return result.data;
}

/** Coerce a string value to a number or boolean when it looks like one. */
function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") return num;
  return value;
}

function formatZodError(error: ZodError): { issues: Array<{ path: string; message: string }> } {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/** Check if a value is a NextResponse (error). Type guard for parse helpers. */
export function isErrorResponse(value: unknown): value is NextResponse<ErrorResponse> {
  return value instanceof NextResponse;
}

/** Parse a route param as a positive integer ID. */
export function parseId(
  params: Record<string, string>,
  key = "id"
): number | NextResponse<ErrorResponse> {
  const raw = params[key];
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    return errorResponse(`Invalid ${key}: must be a positive integer`, "VALIDATION_ERROR", 400);
  }
  return id;
}
