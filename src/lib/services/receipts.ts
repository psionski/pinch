import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, extname } from "path";
import { eq, notExists } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { receipts, transactions } from "@/lib/db/schema";
import type {
  ReceiptResponse,
  CreateReceiptInput,
  ListUnprocessedReceiptsInput,
} from "@/lib/validators/receipts";
import type { PaginatedResponse } from "@/lib/validators/common";
import { sql } from "drizzle-orm";

type Db = BetterSQLite3Database<typeof schema>;

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
};

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");

function toResponse(row: schema.Receipt): ReceiptResponse {
  return {
    id: row.id,
    merchant: row.merchant,
    date: row.date,
    total: row.total,
    imageUrl: row.imagePath ? `${BASE_URL}/api/receipts/${row.id}/image` : null,
    rawText: row.rawText,
    createdAt: row.createdAt,
  };
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export class ReceiptService {
  constructor(private db: Db) {}

  /**
   * Saves image to data/receipts/YYYY-MM/receipt-{id}.{ext},
   * creates a receipts DB row, and returns the receipt.
   */
  upload(file: Buffer, ext: string, meta: CreateReceiptInput): ReceiptResponse {
    const date = meta.date ?? todayIso();

    // Insert placeholder row first to get the auto-incremented ID
    const [row] = this.db
      .insert(receipts)
      .values({
        merchant: meta.merchant,
        date,
        total: meta.total,
        rawText: meta.rawText,
        imagePath: null, // filled in after we know the ID
      })
      .returning()
      .all();

    // Build deterministic path: data/receipts/YYYY-MM/receipt-{id}.{ext}
    const month = date.slice(0, 7); // "YYYY-MM"
    const normalizedExt = ext.startsWith(".") ? ext : `.${ext}`;
    const dir = join("data", "receipts", month);
    const filename = `receipt-${row.id}${normalizedExt}`;
    const imagePath = join(dir, filename);

    mkdirSync(dir, { recursive: true });
    writeFileSync(imagePath, file);

    // Update row with the actual path
    const [updated] = this.db
      .update(receipts)
      .set({ imagePath })
      .where(eq(receipts.id, row.id))
      .returning()
      .all();

    return toResponse(updated);
  }

  /** Upload a receipt without an image (metadata only). */
  createMetadataOnly(meta: CreateReceiptInput): ReceiptResponse {
    const date = meta.date ?? todayIso();
    const [row] = this.db
      .insert(receipts)
      .values({
        merchant: meta.merchant,
        date,
        total: meta.total,
        rawText: meta.rawText,
        imagePath: null,
      })
      .returning()
      .all();
    return toResponse(row);
  }

  getById(id: number): ReceiptResponse | null {
    const [row] = this.db.select().from(receipts).where(eq(receipts.id, id)).all();
    return row ? toResponse(row) : null;
  }

  /**
   * Returns the raw image buffer and content type for serving.
   * Returns null if the receipt has no image or the file is missing.
   */
  getImage(id: number): { buffer: Buffer; contentType: string } | null {
    const [row] = this.db.select().from(receipts).where(eq(receipts.id, id)).all();
    if (!row?.imagePath) return null;
    if (!existsSync(row.imagePath)) return null;
    const ext = extname(row.imagePath).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";
    return { buffer: readFileSync(row.imagePath), contentType };
  }

  /**
   * Returns receipts that have no linked transactions — useful for the AI
   * to proactively find and categorize newly uploaded receipts.
   */
  listUnprocessed(input: ListUnprocessedReceiptsInput): PaginatedResponse<ReceiptResponse> {
    const where = notExists(
      this.db
        .select({ one: sql`1` })
        .from(transactions)
        .where(eq(transactions.receiptId, receipts.id))
    );

    const [{ total }] = this.db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(receipts)
      .where(where)
      .all();

    const data = this.db
      .select()
      .from(receipts)
      .where(where)
      .orderBy(receipts.createdAt)
      .limit(input.limit)
      .offset(input.offset)
      .all()
      .map(toResponse);

    return {
      data,
      total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + data.length < total,
    };
  }
}
