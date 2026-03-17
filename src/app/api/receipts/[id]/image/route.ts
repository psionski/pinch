import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { extname } from "path";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { receipts } from "@/lib/db/schema";
import { errorResponse, parseId, isErrorResponse } from "@/lib/api/helpers";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse | Response> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const [receipt] = getDb().select().from(receipts).where(eq(receipts.id, id)).all();
  if (!receipt) return errorResponse("Receipt not found", "NOT_FOUND", 404);
  if (!receipt.imagePath) return errorResponse("Receipt has no image", "NOT_FOUND", 404);

  if (!existsSync(receipt.imagePath)) {
    return errorResponse("Receipt image file not found", "NOT_FOUND", 404);
  }

  const ext = extname(receipt.imagePath).toLowerCase();
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";
  const buffer = readFileSync(receipt.imagePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
