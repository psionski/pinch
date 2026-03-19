# Pinch — Personal Finance Tracker

*AI-powered personal finance app. Track spending, scan receipts, manage budgets — with an MCP interface for AI-driven data entry and analysis.*

## Overview

Web dashboard (Next.js) for viewing and analyzing spending. MCP server embedded in the app for AI interaction: receipt scanning, categorization, batch operations, ad-hoc SQL queries.

## Actors

| Actor | What it is | How it interacts with Pinch |
|-------|-----------|----------------------------|
| **User** | The human (app owner). | Browses the web UI from any device. Sends receipts/commands to the AI assistant via Telegram. |
| **AI** | An AI assistant (e.g. built on [OpenClaw](https://github.com/openclaw/openclaw)). May run on the same host or a different machine. | Connects to Pinch's MCP endpoint over HTTP. Uses MCP tools for structured operations (transactions, categories, reports, budgets). Uses companion REST endpoint for binary uploads (receipt images). Discovery: MCP server `instructions` field tells clients about the REST upload endpoint. |

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 16 (App Router) | Full-stack: React frontend + API routes + MCP endpoint |
| Language | TypeScript (strict) | End-to-end type safety |
| Styling | Tailwind CSS 4 | Utility-first, fast iteration |
| UI Components | shadcn/ui | Accessible, composable, Tailwind-native |
| Charts | Recharts (via shadcn/ui) | Chart primitives built on Recharts + Tailwind |
| Database | SQLite (via better-sqlite3) | Single file, zero infra, perfect for personal use |
| ORM | Drizzle ORM | Type-safe, SQL-like query builder, great SQLite support |
| Migrations | Drizzle Kit | Schema-driven, generates SQL migrations |
| Validation | Zod | Shared schemas for API, MCP tools, and forms |
| MCP | @modelcontextprotocol/sdk | Streamable HTTP transport, mounted inside Next.js (stateless mode) |
| Scheduling | node-cron | In-process cron via Next.js instrumentation hook |

## Architecture

```
┌──────────────────────────────────────────────┐
│                  Next.js App                  │
│                                               │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │  React UI   │  │    API Routes         │   │
│  │  (Recharts  │  │  /api/transactions    │   │
│  │   charts,   │  │  /api/categories      │   │
│  │   shadcn)   │  │  /api/reports         │   │
│  │             │  │  /api/receipts/upload  │   │
│  │             │  │  /api/receipts/[id]/…  │   │
│  └──────┬──────┘  └──────────┬───────────┘   │
│         │                    │                │
│         │         ┌──────────┴───────────┐   │
│         │         │    MCP Endpoint       │   │
│         │         │  /api/mcp             │   │
│         │         └──────────┬───────────┘   │
│         │                    │                │
│  ┌──────┴────────────────────┴───────────┐   │
│  │         Service Layer (shared)         │   │
│  │   TransactionService, CategoryService  │   │
│  │   ReportService, BudgetService         │   │
│  │   RecurringService                     │   │
│  └──────────────────┬────────────────────┘   │
│                     │                         │
│  ┌──────────────────┴────────────────────┐   │
│  │          Drizzle ORM + SQLite          │   │
│  │          (better-sqlite3)              │   │
│  └────────────────────────────────────────┘   │
└──────────────────────────────────────────────┘
```

Key: API routes and MCP tools call the **same service layer**. No logic duplication. The UI calls API routes; the AI assistant calls MCP tools. Both hit the same services → same DB.

## Access & Security

**Phase 1: Tailscale-only access.** No auth layer in the app initially.

- App binds to `0.0.0.0:<port>` but is only reachable via Tailscale network
- Works on all devices: desktop browser, iOS (Tailscale app), Android
- Optional safety net: middleware that verifies requests come from the Tailscale interface (`100.x.x.x` source IP)
- MCP endpoint is localhost-only — the AI assistant runs on the same host

**Why Tailscale-first:** Single user, personal VPS. Tailscale gives us mutual WireGuard authentication at the network level — good enough to start without building login flows.

**Future: app-level auth.** The architecture should not make auth hard to add later. Keep auth concerns isolated (middleware/route guards), so we can slot in session-based or token-based auth when needed (e.g., shared access, public exposure).

## Database Schema

### Tables

**Money amounts are stored as integers in cents** (e.g., €12.10 → `1210`). This avoids floating-point precision errors. Format to decimal only on display/output.

```sql
-- Categories (hierarchical — parent_id allows subcategories)
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  icon TEXT,                     -- emoji or icon name
  color TEXT,                    -- hex color for charts
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transactions
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,       -- cents (e.g. 1210 = €12.10); always positive
  type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'transfer')),
  description TEXT NOT NULL,
  merchant TEXT,                 -- store/vendor name
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  date TEXT NOT NULL,            -- ISO 8601 date (YYYY-MM-DD)
  receipt_id INTEGER REFERENCES receipts(id) ON DELETE SET NULL,
  recurring_id INTEGER REFERENCES recurring_transactions(id) ON DELETE SET NULL,
  notes TEXT,
  tags TEXT,                     -- JSON array of strings
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Receipts (groups transactions from a single purchase)
CREATE TABLE receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant TEXT,
  date TEXT NOT NULL,
  total INTEGER,                 -- cents; receipt total (for validation against sum of items)
  image_path TEXT,               -- path to stored receipt image
  raw_text TEXT,                 -- OCR/vision extracted text
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Budgets (per category per month)
CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL,           -- YYYY-MM format
  amount INTEGER NOT NULL,       -- cents
  UNIQUE(category_id, month)
);

-- Recurring Transactions (templates for auto-generated transactions)
CREATE TABLE recurring_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,       -- cents
  type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense', 'transfer')),
  description TEXT NOT NULL,
  merchant TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  day_of_month INTEGER,          -- for monthly: 1-31 (NULL = same as start_date day)
  day_of_week INTEGER,           -- for weekly: 0=Sun, 1=Mon, ..., 6=Sat
  start_date TEXT NOT NULL,      -- ISO 8601 date — first occurrence
  end_date TEXT,                 -- NULL = indefinite
  last_generated TEXT,           -- last date a transaction was auto-created
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  tags TEXT,                     -- JSON array of strings
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Full-text search for transaction descriptions and merchants
CREATE VIRTUAL TABLE transactions_fts USING fts5(
  description,
  merchant,
  notes,
  content='transactions',
  content_rowid='id'
);
```

**FTS5 sync:** The service layer keeps `transactions_fts` in sync with the `transactions` table on insert/update/delete. This powers text search in `list_transactions` and the MCP `list_transactions` tool.

**`updated_at` management:** SQLite has no auto-update trigger for timestamps. The service layer is responsible for setting `updated_at = datetime('now')` on every UPDATE call. No triggers needed — services are the single mutation path.

### Indices

```sql
-- Transaction query patterns
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_date_category ON transactions(date, category_id);
CREATE INDEX idx_transactions_merchant ON transactions(merchant);
CREATE INDEX idx_transactions_amount ON transactions(amount);
CREATE INDEX idx_transactions_type_date ON transactions(type, date);
CREATE INDEX idx_transactions_receipt ON transactions(receipt_id);
CREATE INDEX idx_transactions_recurring ON transactions(recurring_id);

-- Budget lookups
CREATE INDEX idx_budgets_month ON budgets(month);
CREATE INDEX idx_budgets_category_month ON budgets(category_id, month);

-- Recurring lookups
CREATE INDEX idx_recurring_active ON recurring_transactions(is_active);
CREATE INDEX idx_recurring_frequency ON recurring_transactions(frequency, is_active);

-- FTS5 sync triggers (keep full-text index in sync with transactions table)
CREATE TRIGGER transactions_ai AFTER INSERT ON transactions BEGIN
  INSERT INTO transactions_fts(rowid, description, merchant, notes)
  VALUES (new.id, new.description, new.merchant, new.notes);
END;
CREATE TRIGGER transactions_ad AFTER DELETE ON transactions BEGIN
  INSERT INTO transactions_fts(transactions_fts, rowid, description, merchant, notes)
  VALUES ('delete', old.id, old.description, old.merchant, old.notes);
END;
CREATE TRIGGER transactions_au AFTER UPDATE ON transactions BEGIN
  INSERT INTO transactions_fts(transactions_fts, rowid, description, merchant, notes)
  VALUES ('delete', old.id, old.description, old.merchant, old.notes);
  INSERT INTO transactions_fts(rowid, description, merchant, notes)
  VALUES (new.id, new.description, new.merchant, new.notes);
END;
```

### SQLite PRAGMAs (set on every connection)

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA cache_size = -64000;    -- 64MB cache
PRAGMA busy_timeout = 5000;
```

## MCP Tools

### Transactions
| Tool | Description |
|------|-------------|
| `add_transaction` | Add a single transaction (amount, description, category, date, merchant, notes, tags) |
| `add_transactions` | Batch add — array of transactions in one call. Optionally link to an uploaded receipt via `receipt_id`. |
| `update_transaction` | Update fields on an existing transaction by ID |
| `delete_transaction` | Delete by ID (or array of IDs for bulk delete) |
| `list_transactions` | List with filters: date range, category, amount range, merchant, text search, tags, type. Pagination via limit+offset. |

### Categories
| Tool | Description |
|------|-------------|
| `list_categories` | All categories with hierarchy, transaction counts, and total spend |
| `create_category` | New category (name, optional parent, icon, color) |
| `update_category` | Rename, reparent, change icon/color |
| `recategorize` | Batch: move transactions matching a filter (date range, merchant pattern, description pattern) to a new category |
| `merge_categories` | Combine source category into target — reassign all transactions, transfer budget, delete source |

### Reporting
| Tool | Description |
|------|-------------|
| `spending_summary` | Total spend for a period, grouped by: category / month / merchant. Supports comparison with a previous period (e.g. "this month vs last month"). |
| `category_breakdown` | Single period breakdown — amounts + percentages per category (pie/donut chart data) |
| `trends` | Month-over-month time series for a category or total spend. Configurable window (3/6/12 months). |
| `top_merchants` | Highest-spend merchants for a period, with transaction counts |

### Budgets
| Tool | Description |
|------|-------------|
| `set_budget` | Set/update budget for a category + month. Optionally apply to future months (recurring budget). |
| `get_budget_status` | Current spend vs budget for all categories in a given month. Returns amounts, percentages, over/under status. |

### Recurring Transactions
| Tool | Description |
|------|-------------|
| `create_recurring` | Create a recurring transaction template (amount, description, merchant, category, frequency, schedule) |
| `list_recurring` | List all recurring templates with status and next occurrence date |
| `update_recurring` | Modify a recurring template (amount, category, schedule, active/inactive) |
| `delete_recurring` | Delete a recurring template. Option: also delete future generated transactions. |
| `generate_recurring` | Manually trigger generation of pending recurring transactions up to a given date. (Also runs automatically on app startup and daily.) |

### Escape Hatch
| Tool | Description |
|------|-------------|
| `query` | Execute **read-only** SQL against the DB. Returns JSON results. For ad-hoc analysis: window functions, CTEs, date math, cross-table joins, custom aggregations — anything the pre-built tools don't cover. |

## Scheduled Tasks & Recurring Transaction Engine

### Scheduling approach: `instrumentation.ts` + `node-cron`

Next.js provides a stable `instrumentation.ts` hook whose `register()` function runs exactly once when the server starts. Since Pinch is self-hosted (long-lived Node.js process, not serverless), we use this to start in-process cron jobs via `node-cron`.

```typescript
// src/instrumentation.ts
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initCronJobs } = await import("@/lib/cron");
    initCronJobs();
  }
}
```

**Dev mode safety:** Use a `globalThis` singleton guard to prevent duplicate jobs from hot-reload re-execution:

```typescript
// src/lib/cron.ts
const globalForCron = globalThis as unknown as { cronInitialized?: boolean };

export function initCronJobs(): void {
  if (globalForCron.cronInitialized) return;
  globalForCron.cronInitialized = true;

  // Schedule recurring transaction generation — daily at 02:00
  cron.schedule("0 2 * * *", async () => {
    await recurringService.generatePending(new Date());
  });

  // Schedule SQLite backup — daily at 03:00
  cron.schedule("0 3 * * *", async () => {
    await backupDatabase();
  });
}
```

### Recurring transaction generation

1. Each recurring template defines: amount, description, category, frequency (daily/weekly/monthly/yearly), schedule details, start/end date
2. The engine tracks `last_generated` — the last date it created a transaction for this template
3. Runs daily at 02:00 via cron (see above) + on first request after startup via middleware. Also manually triggerable via `generate_recurring` MCP tool.
4. Generated transactions link back to their template via `recurring_id`
5. Generated transactions are normal transactions — editable, deletable, recategorizable independently
6. Deactivating a template stops future generation but doesn't touch already-generated transactions

**MCP management:** The AI assistant can create/modify/pause/resume recurring templates. Example: "I'm canceling my Netflix" → `update_recurring(id, is_active: false)`.

## MCP Integration Details

The MCP server runs inside Next.js as a **stateless** Streamable HTTP endpoint at `/api/mcp`. Each POST request creates a fresh `McpServer` + `NodeStreamableHTTPServerTransport` instance, registers tools, handles the request, and tears down. No session state between requests.

**Key decisions:**
- **Stateless mode:** `sessionIdGenerator: undefined` — no `Mcp-Session-Id` headers, no SSE resumption. This is the simplest model and fits Next.js route handlers perfectly. The AI assistant makes independent tool calls; there is no multi-turn MCP session state to preserve.
- **JSON responses:** `enableJsonResponse: true` — returns plain JSON instead of SSE. Simpler to debug, no streaming needed for our tool calls.
- **Request/Response compatibility:** Next.js App Router uses Web `Request`/`Response`, but the MCP SDK's `NodeStreamableHTTPServerTransport.handleRequest()` expects Node.js `IncomingMessage`/`ServerResponse`. Options: (a) use `mcp-handler` (Vercel's adapter library) which abstracts this, or (b) write a thin conversion layer. Evaluate both during Sprint 7; prefer fewer dependencies.
- **Tool registration:** Factor tool registration into a shared `registerTools(server)` function so the per-request server setup is minimal.
- **Server instructions:** The `McpServer` `instructions` field advertises the companion REST endpoint for receipt image uploads. This is how unknown AI clients discover that binary uploads go through REST, not MCP. Tool descriptions on `add_transactions` reference `receipt_id` and point to the instructions for the upload flow.

```typescript
// Simplified pattern for /api/mcp/route.ts
export async function POST(req: Request): Promise<Response> {
  const body = await req.json();
  const server = new McpServer({
    name: "pinch",
    version: "1.0.0",
    instructions: [
      "Personal finance tracker.",
      "Receipt images: upload via POST /api/receipts/upload",
      "(multipart/form-data, field: 'image', optional fields: 'merchant', 'date', 'total', 'raw_text')",
      "→ returns { receipt_id }.",
      "Then pass receipt_id to add_transactions to link line items to the receipt.",
      "All monetary amounts are integers in cents (e.g. 1210 = €12.10).",
    ].join(" "),
  });
  registerTools(server);
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  // ... handle request conversion and return response
}
```

## Web UI Pages

### Dashboard (`/`)
- **KPI cards:** Total spend this month, vs last month (delta + percentage), top category, budget utilization percentage
- **Spending trend:** Area chart, last 6 months
- **Category breakdown:** Donut chart, current month
- **Recent transactions:** Last 10-20 entries, quick list with category badges
- **Budget alerts:** Categories approaching (>80%) or over budget, sorted by severity
- **Upcoming recurring:** Next 5 recurring transactions due

### Transactions (`/transactions`)
- Full transaction list, sortable columns (date, amount, category, merchant)
- Filter bar: date range picker, category dropdown, amount range, text search, type toggle (income/expense/all)
- Inline edit (click to modify)
- Bulk select → recategorize / delete
- Add transaction form (manual entry)
- Receipt indicator badge (links to receipt details)
- Recurring indicator badge (links to template)

### Categories (`/categories`)
- Tree view showing hierarchy (parent → children)
- Per-category: total spend (current month), transaction count, budget status
- CRUD: create, rename, reparent, change icon/color
- Merge UI: select source → target, preview affected transactions, confirm
- Click-through to filtered transaction list

### Reports (`/reports`)
- **Date range picker** with presets (this month, last month, last 3/6/12 months, YTD, custom)
- **Spending by category:** Horizontal bar chart
- **Trends:** Multi-line chart (total + selected categories over time)
- **Merchant breakdown:** Table with merchant, total spend, transaction count, avg transaction
- **Budget vs actual:** Grouped bar chart (budget bar + actual bar per category)
- **Income vs expenses:** Summary card + trend chart

### Budgets (`/budgets`)
- Set monthly budgets per category (form with amount input)
- Visual progress bars: green (< 60%) → yellow (60-90%) → red (> 90%)
- Copy budgets from previous month (one-click)
- Historical budget adherence chart (how well did you stick to budgets over time)

### Recurring (`/recurring`)
- List all templates: description, amount, frequency, next occurrence, status (active/paused)
- Create/edit form: amount, description, merchant, category, frequency, schedule, start/end date
- Toggle active/inactive
- View generated transactions for a template

## Receipt Flow

### Image upload design

Receipt images are binary data. MCP tools accept JSON parameters — no native binary upload. Rather than bloating MCP payloads with base64-encoded images, receipt uploads go through a **companion REST endpoint**:

- `POST /api/receipts/upload` — multipart/form-data. Accepts `image` file field + optional metadata fields (`merchant`, `date`, `total`, `raw_text`). Saves image to `data/receipts/YYYY-MM/receipt-{id}.{ext}`, creates a `receipts` row, returns `{ receipt_id }`.
- MCP `add_transactions` then accepts `receipt_id` to link line items to the uploaded receipt.

**Discovery:** AI clients learn about this REST endpoint via the MCP server's `instructions` field (see MCP Integration Details). Any MCP-compatible agent that reads server instructions on connect will know the upload flow. Tool descriptions on `add_transactions` also reference `receipt_id`.

### From an AI client (e.g., via Telegram)

1. User sends receipt photo to the AI assistant via Telegram
2. AI uses vision model to extract: merchant name, date, line items (description + amount per item), total
3. AI uploads the image via `POST /api/receipts/upload` (multipart) → gets `{ receipt_id }`
4. AI calls MCP `add_transactions` with line items + `receipt_id`
5. Each transaction linked via `receipt_id` — a single receipt can span multiple categories (e.g. eggs → Groceries, cigarettes → Tobacco on the same Kaufland receipt)
6. AI confirms: "Added 7 items from Kaufland (€43.20) — 5× Groceries, 1× Tobacco, 1× Household"

### From the web UI

1. User clicks "Add Receipt" → file picker or drag-and-drop
2. Frontend uploads to `POST /api/receipts/upload` → gets `{ receipt_id }`
3. Manual entry form for line items, pre-filled with receipt metadata
4. Submit → `POST /api/transactions` with items + `receipt_id`

### Image serving

- Web UI renders `<img src="/api/receipts/{id}/image" />`
- `GET /api/receipts/[id]/image` reads `image_path` from DB, streams file with correct `Content-Type`
- Receipt icon on transactions → click to see full receipt, all items, original image

### Category assignment

The AI assistant uses item descriptions (per line item) and merchant name to assign categories. Each item on a receipt is categorized independently. If a merchant/item pattern has been seen before, reuse the previous category. If ambiguous, ask. Over time, category assignment gets smarter via accumulated history.

## Currency

Default currency is **EUR (€)**. Start single-currency for simplicity, but keep the door open for multi-currency later — avoid hardcoding EUR assumptions deep in business logic. When multi-currency is needed, add a `currency` field to transactions and an exchange rate table.

## API Conventions

### Error response contract

All API routes and MCP tool errors return a consistent shape:

```json
{
  "error": "Human-readable error message",
  "code": "VALIDATION_ERROR",
  "details": { }
}
```

Error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`. The `details` field is optional and carries structured info (e.g., Zod validation issues). MCP tools return errors via the MCP protocol's error mechanism but use the same `code` values for consistency.

### Pagination contract

All list endpoints use consistent pagination:

- **Request:** `limit` (default 50, max 200) + `offset` (default 0)
- **Response envelope:**
```json
{
  "data": [ ... ],
  "total": 1234,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

Shared Zod schema for pagination params in `src/lib/validators/common.ts`.

### Tags

Tags are stored as a JSON text array on transactions and recurring templates (e.g., `["groceries", "weekly-shop"]`). Query support:

- **Filter by tag:** `list_transactions` accepts a `tags` filter param — matches transactions containing any of the specified tags (OR logic). Implemented via `json_each()` in SQLite.
- **List all tags:** Dedicated service method that scans distinct tags across all transactions (for autocomplete in UI and MCP).
- No separate tags table — kept simple. If tagging gets complex (e.g., tag colors, descriptions), promote to a table later.

### Receipt image upload & serving

Receipt images are uploaded via a **companion REST endpoint** (not MCP — see Receipt Flow section for rationale):

- `POST /api/receipts/upload` — multipart/form-data. Accepts `image` file + optional `merchant`, `date`, `total`, `raw_text` fields. Saves to `data/receipts/YYYY-MM/receipt-{id}.{ext}`, creates a `receipts` DB row, returns `{ receipt_id }`. Used by both AI clients and the web UI.
- `GET /api/receipts/[id]/image` — looks up the receipt by ID, reads `image_path`, streams the file with appropriate `Content-Type`.
- Both protected by the same access controls as other API routes.
- AI clients discover the upload endpoint via MCP server `instructions` (see MCP Integration Details).

## Data Storage

- **Database:** `data/pinch.db` (SQLite, gitignored)
- **Receipt images:** `data/receipts/YYYY-MM/receipt-{id}.{ext}` (organized by month, gitignored)
- **Backups:** Daily automated backup via cron job (see Scheduled Tasks section). Uses SQLite `.backup` command to `data/backups/pinch-YYYY-MM-DD.db`. Keep last 7 daily backups (auto-rotate old ones).

## Project Structure

```
pinch/
├── plan.md                      # This file
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── drizzle.config.ts
├── .gitignore
├── src/
│   ├── instrumentation.ts       # Next.js instrumentation hook (starts cron jobs)
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout (sidebar nav, global styles)
│   │   ├── page.tsx             # Dashboard
│   │   ├── transactions/
│   │   │   └── page.tsx
│   │   ├── categories/
│   │   │   └── page.tsx
│   │   ├── reports/
│   │   │   └── page.tsx
│   │   ├── budgets/
│   │   │   └── page.tsx
│   │   ├── assets/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── portfolio/
│   │   │   └── page.tsx
│   │   ├── recurring/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── mcp/
│   │       │   └── route.ts     # MCP Streamable HTTP endpoint (stateless)
│   │       ├── transactions/
│   │       │   └── route.ts
│   │       ├── categories/
│   │       │   └── route.ts
│   │       ├── reports/
│   │       │   └── route.ts
│   │       ├── budgets/
│   │       │   └── route.ts
│   │       ├── recurring/
│   │       │   └── route.ts
│   │       ├── receipts/
│   │       │   ├── upload/
│   │       │   │   └── route.ts      # POST multipart receipt image upload → { receipt_id }
│   │       │   └── [id]/
│   │       │       └── image/
│   │       │           └── route.ts  # GET serve receipt image by ID
│   │       ├── assets/
│   │       │   ├── route.ts          # GET/POST
│   │       │   └── [id]/
│   │       │       ├── route.ts      # GET/PATCH/DELETE
│   │       │       ├── buy/route.ts
│   │       │       ├── sell/route.ts
│   │       │       ├── lots/route.ts
│   │       │       └── prices/route.ts
│   │       └── portfolio/
│   │           └── route.ts          # GET net worth + allocation
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── charts/              # Chart components (Recharts via shadcn/ui)
│   │   ├── transactions/        # Transaction list, form, filters
│   │   ├── categories/          # Category tree, merge dialog
│   │   ├── budgets/             # Budget progress bars, form
│   │   ├── assets/              # Asset cards, lot table, price chart, buy/sell modals
│   │   └── layout/              # Sidebar, header, breadcrumbs
│   ├── lib/
│   │   ├── cron.ts              # Cron job definitions (recurring gen, backup)
│   │   ├── db/
│   │   │   ├── index.ts         # DB connection singleton + PRAGMAs
│   │   │   ├── schema.ts        # Drizzle table definitions
│   │   │   └── seed.ts          # Default categories + sample data (dev)
│   │   ├── services/
│   │   │   ├── transactions.ts  # CRUD + batch + filtered queries + FTS sync
│   │   │   ├── categories.ts    # CRUD + merge + recategorize
│   │   │   ├── reports.ts       # Aggregations, trends, comparisons
│   │   │   ├── budgets.ts       # Set/get/compare
│   │   │   ├── recurring.ts     # Template CRUD + generation engine
│   │   │   ├── receipts.ts     # Upload, store, retrieve receipt images
│   │   │   ├── assets.ts        # Asset CRUD + holdings + P&L
│   │   │   ├── asset-lots.ts    # Buy/sell operations (atomic with transactions)
│   │   │   ├── asset-prices.ts  # Price snapshots + history
│   │   │   ├── portfolio.ts     # Net worth, allocation, aggregate P&L
│   │   │   └── backup.ts        # SQLite backup logic
│   │   ├── mcp/
│   │   │   ├── server.ts        # MCP server init + tool registration
│   │   │   └── tools/
│   │   │       ├── transactions.ts
│   │   │       ├── categories.ts
│   │   │       ├── reports.ts
│   │   │       ├── budgets.ts
│   │   │       ├── recurring.ts
│   │   │       ├── assets.ts    # Asset + lot + price + portfolio tools
│   │   │       └── query.ts     # Read-only SQL escape hatch
│   │   ├── validators/          # Zod schemas (shared by API + MCP + forms)
│   │   │   ├── common.ts        # Pagination, error envelope
│   │   │   ├── transactions.ts
│   │   │   ├── categories.ts
│   │   │   ├── budgets.ts
│   │   │   ├── recurring.ts
│   │   │   └── assets.ts
│   │   └── utils/
│   │       ├── dates.ts         # Date helpers (month ranges, formatting)
│   │       └── currency.ts      # Cents ↔ decimal formatting
├── data/                        # Runtime user data (gitignored)
│   ├── pinch.db                 # SQLite database
│   ├── backups/                 # Daily SQLite backups (auto-rotated)
│   └── receipts/                # Receipt images organized by YYYY-MM/
├── drizzle/                     # Generated migrations
└── public/
    └── favicon.ico
```

## Development Sprints

Each sprint is a self-contained chunk of work that results in something testable. Sprints are designed to be completable in a single AI agent session with human review between sprints.

Sprints are organized into two phases: **MVP** (usable via MCP + minimal web UI) and **Full App** (complete web experience + polish).

---

## Phase 1: MVP — Usable via MCP + Minimal Dashboard

*Goal: A working backend with MCP tools so the AI assistant can start entering and querying transactions. Plus a basic dashboard and transaction list so you can see your data in a browser. This is the "start using it daily" milestone.*

---

### Sprint 1: Project Scaffolding ✅
**Goal:** Bootable Next.js app with tooling configured. Nothing custom yet — just the skeleton.

- [x] Initialize Next.js 16 (App Router) with TypeScript strict mode
- [x] Install and configure Tailwind CSS 4
- [x] Initialize shadcn/ui, add a few base components (Button, Card, Input, Table)
- [x] Set up path alias (`@/` → `src/`)
- [x] Configure Vitest for testing
- [x] Verify: `npm run dev` starts, `npm run build` passes, `npm test` runs

**Done when:** App boots to a blank page, all tooling works, tests run green.

---

### Sprint 2: Database & Schema ✅
**Goal:** Drizzle ORM wired to SQLite, full schema defined, migrations running.

- [x] Install Drizzle ORM + better-sqlite3 + Drizzle Kit
- [x] Define all tables in `src/lib/db/schema.ts` (categories, transactions, receipts, budgets, recurring_transactions) — amounts as INTEGER (cents)
- [x] Define FTS5 virtual table and sync triggers for transaction text search
- [x] Configure `drizzle.config.ts`
- [x] DB connection singleton with PRAGMAs (`src/lib/db/index.ts`)
- [x] Generate and run initial migration
- [x] Seed script: default categories (Groceries, Rent, Utilities, Transport, Entertainment, Dining, Health, Shopping, Subscriptions, Income, Other)
- [x] Tests: DB connects, schema creates tables, seed runs, basic insert/select works, FTS search returns results

**Done when:** `npm run db:migrate` creates the database, `npm run db:seed` populates categories, tests verify round-trip CRUD and full-text search.

---

### Sprint 3: Validators & Shared Types ✅
**Goal:** Shared validation schemas that will be used by API routes, MCP tools, and forms.

- [x] `src/lib/validators/common.ts` — pagination params, error envelope schema
- [x] `src/lib/validators/transactions.ts` — create (amounts in cents), update, list filters (date range, category, amount range, merchant, text search, tags, pagination)
- [x] `src/lib/validators/categories.ts` — create, update, recategorize filters, merge params
- [x] `src/lib/validators/budgets.ts` — set budget, query params
- [x] `src/lib/validators/recurring.ts` — create, update, generation params
- [x] Export inferred TypeScript types from each schema
- [x] Tests: valid inputs pass, invalid inputs fail with expected errors

**Done when:** All validators defined with full type inference, test coverage on edge cases.

---

### Sprint 4: Service Layer — Transactions & Categories ✅
**Goal:** Core business logic for the two primary domains.

- [x] `TransactionService`: create, createBatch, getById, list (with all filters + FTS text search + pagination), update, delete, deleteBatch
- [x] FTS sync on insert/update/delete (service layer keeps `transactions_fts` in sync)
- [x] `updated_at` set explicitly on every update call
- [x] `CategoryService`: create, getAll (with hierarchy), getById, update, delete, recategorize (bulk move), merge
- [x] Tag listing: service method to get all distinct tags across transactions
- [x] All services use Drizzle queries, accept validated types, return typed results with pagination envelope
- [x] Tests: full CRUD, filter combinations, FTS search, tag filtering via `json_each()`, batch operations, category merge reassigns transactions, recategorize works

**Done when:** Services fully tested against real SQLite. No API routes yet — just the logic layer.

---

### Sprint 5: Service Layer — Reports, Budgets, Recurring ✅
**Goal:** Remaining services that build on top of transactions/categories.

- [x] `ReportService`: spendingSummary (grouped by category/month/merchant, with period comparison), categoryBreakdown, trends (time series), topMerchants
- [x] `BudgetService`: set, getForMonth (all categories with spend vs budget), copyFromPreviousMonth
- [x] `RecurringService`: create, list (with next occurrence), update, delete, generatePending (create missing transactions up to a date)
- [x] `BackupService`: run SQLite `.backup`, auto-rotate old backups (keep last 7)
- [x] Tests: report aggregations return correct numbers, budget status calculates correctly, recurring generation creates expected transactions

**Done when:** All five services complete and tested. The entire backend logic works without any HTTP layer.

---

### Sprint 6: API Routes ✅
**Goal:** REST API exposing all services via Next.js route handlers.

- [x] `POST/GET /api/transactions` — create + list (with pagination envelope)
- [x] `GET/PATCH/DELETE /api/transactions/[id]` — single transaction ops
- [x] `POST/GET /api/categories` — create + list
- [x] `PATCH/DELETE /api/categories/[id]` — single category ops
- [x] `POST /api/categories/recategorize` + `POST /api/categories/merge`
- [x] `GET /api/reports/summary` + `/breakdown` + `/trends` + `/top-merchants`
- [x] `POST/GET /api/budgets` — set + get status
- [x] `POST/GET/PATCH/DELETE /api/recurring` — full CRUD + `POST /api/recurring/generate`
- [x] `GET /api/receipts/[id]/image` — serve receipt images from `data/receipts/`
- [x] All routes: validate with Zod, call service, return JSON with consistent error shape (`{ error, code, details? }`)
- [x] Integration tests: hit route handlers, verify responses and error contract

**Done when:** Full API working, tested end-to-end through route handlers.

---

### Sprint 7: MCP Server ✅
**Goal:** MCP endpoint with all tools, calling the same service layer as API routes.

- [x] MCP server setup with @modelcontextprotocol/sdk (`src/lib/mcp/server.ts`)
- [x] Mount as stateless Streamable HTTP endpoint at `/api/mcp` (see MCP Integration Details section)
- [x] Server `instructions` field: advertise companion REST endpoint for receipt image uploads (see Receipt Flow section)
- [x] Resolve Request/Response compatibility — used `WebStandardStreamableHTTPServerTransport` (Web standard APIs, no Node.js shim needed)
- [x] Transaction tools: add_transaction, add_transactions (batch + optional receipt_id), update_transaction, delete_transaction, list_transactions
- [x] Category tools: list_categories, create_category, update_category, recategorize, merge_categories
- [x] Report tools: spending_summary, category_breakdown, trends, top_merchants
- [x] Budget tools: set_budget, get_budget_status
- [x] Recurring tools: create_recurring, list_recurring, update_recurring, delete_recurring, generate_recurring
- [x] Escape hatch: query (read-only SQL)
- [x] Tests: tool registration works, tools call correct services, stateless request lifecycle works

**Done when:** MCP endpoint responds to tool calls, all tools wired to services. Verified with a real MCP client.

---

### Sprint 8: Scheduled Tasks ✅
**Goal:** Cron jobs for recurring transaction generation and database backups.

- [x] Install `node-cron`
- [x] `src/instrumentation.ts` — calls `initCronJobs()` on server start (with `NEXT_RUNTIME === "nodejs"` guard)
- [x] `src/lib/cron.ts` — `globalThis` singleton guard to prevent duplicate jobs in dev mode
- [x] Cron job: generate pending recurring transactions (daily at 02:00)
- [x] Cron job: SQLite backup with rotation (daily at 03:00)
- [x] Tests: verify `generatePending` idempotency, backup file creation and rotation

**Done when:** Recurring transactions auto-generate, backups auto-rotate, no duplicate jobs in dev mode.

---

### Sprint 9: App Shell + Minimal Dashboard ✅
**Goal:** Navigable layout with a functional dashboard — the first thing you see in the browser.

- [x] Root layout with sidebar navigation (Dashboard, Transactions, Categories, Reports, Budgets, Assets, Portfolio, Recurring)
- [x] Responsive: sidebar collapses on mobile
- [x] Active route highlighting
- [x] Install and configure shadcn/ui charts (Recharts wrapper) — Tremor v3 incompatible with Tailwind v4 OKLCH
- [x] Dashboard: KPI cards (total spend this month, delta vs last month, top category, budget utilization)
- [x] Dashboard: spending trend AreaChart (last 6 months)
- [x] Dashboard: category breakdown donut chart (current month)
- [x] Dashboard: recent transactions list (last 10-20 entries with category badges)
- [x] Empty state components for pages not yet built

**Done when:** Dashboard renders with real data, you can navigate the shell, other pages show placeholders.

---

### Sprint 10: Transactions Page ✅
**Goal:** Full transaction management UI — the most-used page.

- [x] Transaction list with sortable columns (date, amount, category, merchant)
- [x] Filter bar: date range picker, category dropdown, amount range, text search, type toggle (income/expense/all)
- [x] Pagination
- [x] Add transaction form (manual entry — amounts entered as decimals, converted to cents)
- [x] Inline edit (click to modify)
- [x] Bulk select → recategorize / delete
- [x] Receipt indicator badge, recurring indicator badge

**Done when:** Can create, view, filter, edit, bulk-manage, and delete transactions through the UI.

---

### Sprint 10.5: Common MCP Read Operations ✅
**Goal:** Implement dedicated MCP tools for high-frequency analytical queries (like net balance) so the AI doesn't need to write custom SQL.

- [x] `get_net_balance` tool: Returns total income minus total expenses, optionally filtered by a date range.
- [x] `get_transaction`, `get_category`, `get_recurring`: Simple read tools for fetching single records to save context window tokens when modifying them.

**--- MVP milestone ---**

*After Sprint 10, the app is usable daily: the AI assistant can enter transactions via MCP, you can view and manage them in the web UI, recurring transactions auto-generate, and the DB backs up automatically.*

---

## Phase 2: Full App — Complete Web Experience

*Goal: Build out all remaining UI pages, receipt flow, documentation, and polish.*

---

### Sprint 11: Categories Page ✅
**Goal:** Category management with hierarchy and merge.

- [x] Tree view showing parent → children hierarchy
- [x] Per-category stats: total spend (current month), transaction count, budget status
- [x] Create / rename / reparent / change icon & color
- [x] Merge UI: select source → target, preview affected transactions, confirm
- [x] Click-through to filtered transaction list

**Done when:** Full category CRUD and merge working in the UI.

---

### Sprint 12: Budgets Page ✅
**Goal:** Budget management and tracking UI.

- [x] Set monthly budgets per category (form with amount input in decimal, stored as cents)
- [x] Progress bars: green (<60%) → yellow (60-90%) → red (>90%)
- [x] Copy budgets from previous month (one-click)
- [x] Dashboard: budget alerts (categories approaching >80% or over budget)
- [x] Historical budget adherence chart

**Done when:** Can set, view, and track budgets. Visual feedback on spending vs budget.

---

### Sprint 13: Recurring Transactions Page ✅
**Goal:** Recurring template management UI.

- [x] List: description, amount, frequency, next occurrence, status (active/paused)
- [x] Create/edit form: amount, description, merchant, category, frequency, schedule, start/end date
- [x] Toggle active/inactive
- [x] View generated transactions for a template
- [x] Dashboard: upcoming recurring (next 5 due)

**Done when:** Full recurring transaction management through the UI.

---

### Sprint 14: Reports Page ✅
**Goal:** Rich reporting with configurable date ranges and visualizations.

- [x] Date range picker with presets (this month, last month, last 3/6/12 months, YTD, custom)
- [x] Spending by category: horizontal bar chart
- [x] Trends: multi-line chart (total + selected categories over time)
- [x] Merchant breakdown: table with merchant, total spend, count, avg transaction
- [x] Budget vs actual: grouped bar chart
- [x] Income vs expenses: summary card + trend chart

**Done when:** All report types render with real data, date range filtering works.

---

### Sprint 15: Receipts Flow ✅
**Goal:** Receipt upload via REST + linking via MCP + display in UI.

- [x] `ReceiptService`: upload (save image, create DB record), getById, getImage, listUnprocessed
- [x] `POST /api/receipts/upload` — multipart form-data endpoint (image file + optional metadata). Saves to `data/receipts/YYYY-MM/receipt-{id}.{ext}`, returns `{ receipt_id }`
- [x] `GET /api/receipts/[id]/image` — serve stored receipt images with correct Content-Type
- [x] `GET /api/receipts/[id]` — return JSON receipt record
- [x] **MCP Tools:** `list_unprocessed_receipts`, `get_receipt` (so the AI can proactively read and categorize new uploads)
- [x] MCP `add_transactions` tool: accepts optional `receipt_id` to link batch items to an uploaded receipt
- [x] UI: receipt icon on transactions → click to see full receipt, all items, original image
- [x] UI: "Add Receipt" button with file picker / drag-and-drop upload

**Done when:** AI clients can upload receipt images via REST (discovered through MCP instructions), link transactions via MCP, and the web UI displays receipt details.

---

### Sprint 16: Financial Data Service
**Goal:** A provider-based service for fetching exchange rates and asset prices from public APIs, with SQLite caching. The UI and MCP clients use this to convert currencies (e.g. a receipt in USD → EUR) and update asset valuations. Historical queries supported. Users configure API keys via a settings table.

#### The problem

Pinch stores amounts in cents with an implicit EUR base currency, but users encounter other currencies constantly: receipts from abroad, foreign-currency assets (Sprint 17), crypto priced in USD. Today, the AI has to guess exchange rates or ask the user. The app needs a reliable, self-hosted way to look up current and historical rates/prices.

#### Design principles

- **Provider abstraction:** A common interface (`FinancialDataProvider`) so backends are pluggable. Ship with free-tier providers; users can swap in premium ones by adding API keys.
- **Cache-first:** Every fetched rate/price is stored in SQLite. Subsequent lookups for the same pair+date hit the cache. Reduces API calls and gives offline resilience.
- **TTL-based freshness:** Current-day lookups have a configurable staleness window (default: 1 hour for exchange rates, 15 minutes for asset prices). Historical lookups (past dates) are considered immutable once cached.
- **Graceful degradation:** If all providers fail, return the most recent cached value (if any) with a `stale: true` flag. Never block a transaction on a rate lookup.

#### Providers to ship

| Provider | Type | Free tier | API key required | Notes |
|----------|------|-----------|------------------|-------|
| **ECB (European Central Bank)** | Exchange rates | Unlimited | No | Daily reference rates, ~30 currencies. 1-day lag. Default provider for EUR pairs. |
| **Frankfurter** | Exchange rates | Unlimited | No | Wraps ECB data with a clean REST API. Historical back to 1999. Good fallback. |
| **Open Exchange Rates** | Exchange rates | 1,000 req/month | Yes | Real-time rates, 170+ currencies. For users who need intraday or exotic pairs. |
| **CoinGecko** | Crypto prices | ~30 req/min | No (optional pro key) | Current + historical prices for major cryptos. Prices in any fiat. |
| **Alpha Vantage** | Stock/ETF prices | 25 req/day | Yes (free key) | Daily/intraday stock prices. Good for ETFs and equities. |

Each provider implements the same interface. The service tries providers in priority order per query type.

#### Schema additions

```sql
-- App-level settings (key-value store for API keys, preferences, etc.)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Cached exchange rates
CREATE TABLE exchange_rates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  base          TEXT NOT NULL,           -- e.g. 'USD'
  quote         TEXT NOT NULL,           -- e.g. 'EUR'
  rate          REAL NOT NULL,           -- 1 base = rate quote (e.g. 0.92)
  date          TEXT NOT NULL,           -- YYYY-MM-DD
  provider      TEXT NOT NULL,           -- which provider supplied this
  fetched_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(base, quote, date)
);

-- Cached asset/commodity prices (complements asset_prices in Sprint 17)
CREATE TABLE market_prices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol        TEXT NOT NULL,           -- ticker/id: 'AAPL', 'bitcoin', 'SPX'
  price         REAL NOT NULL,           -- in the asset's native currency
  currency      TEXT NOT NULL,           -- what currency the price is in
  date          TEXT NOT NULL,           -- YYYY-MM-DD
  provider      TEXT NOT NULL,
  fetched_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(symbol, currency, date)
);

CREATE INDEX idx_exchange_rates_pair ON exchange_rates(base, quote, date);
CREATE INDEX idx_market_prices_symbol ON market_prices(symbol, date);
```

**Why separate from `asset_prices`?** `asset_prices` (Sprint 17) tracks user-specific asset valuations linked to portfolio lots. `market_prices` is a shared cache of raw market data — an asset's price update can be sourced from `market_prices`, but they serve different purposes. The financial data service populates `market_prices`; the asset price service reads from it when updating portfolio valuations.

#### Provider interface

```typescript
interface ExchangeRateResult {
  base: string;
  quote: string;
  rate: number;
  date: string;         // YYYY-MM-DD
  provider: string;
}

interface MarketPriceResult {
  symbol: string;
  price: number;
  currency: string;
  date: string;
  provider: string;
}

interface FinancialDataProvider {
  name: string;
  supportsExchangeRates: boolean;
  supportsMarketPrices: boolean;

  // Exchange rates
  getExchangeRate?(base: string, quote: string, date?: string): Promise<ExchangeRateResult | null>;
  getExchangeRates?(base: string, date?: string): Promise<ExchangeRateResult[]>;   // all pairs for a base

  // Market prices
  getPrice?(symbol: string, currency: string, date?: string): Promise<MarketPriceResult | null>;

  // Health check — verify API key is valid, service is reachable
  healthCheck?(): Promise<boolean>;
}
```

#### Service layer

- **`FinancialDataService`** — orchestrates providers and cache:
  - `getExchangeRate(base, quote, date?)` — cache-first lookup. If cached and fresh, return it. Otherwise try providers in priority order, cache result, return it. `date` defaults to today.
  - `getExchangeRates(base, date?)` — all available pairs for a base currency on a given date.
  - `convert(amount, from, to, date?)` — convenience: look up rate + multiply. Returns `{ converted: number, rate: number, date: string, stale: boolean }`.
  - `getMarketPrice(symbol, currency?, date?)` — same pattern for asset prices. Currency defaults to EUR.
  - `getProviderStatus()` — list configured providers with health status (reachable, key valid, rate limits).
  - `setApiKey(provider, key)` — store in `settings` table.
  - `getApiKey(provider)` — read from `settings` table.

- **`SettingsService`** — generic key-value CRUD on the `settings` table. Used by financial data service for API keys, and available for future app settings.

#### MCP tools

| Tool | Description |
|------|-------------|
| `convert_currency` | Convert an amount between currencies. Params: `amount` (cents), `from`, `to`, `date` (optional, defaults to today). Returns converted amount (cents), rate used, source provider, whether the rate is stale. Primary use case: receipt in foreign currency → EUR. |
| `get_exchange_rate` | Look up an exchange rate. Params: `base`, `quote`, `date` (optional). Returns rate, date, provider. |
| `get_market_price` | Look up a market price. Params: `symbol`, `currency` (optional, default EUR), `date` (optional). Returns price, currency, date, provider. |
| `list_providers` | List configured financial data providers with status (active, API key set, healthy). |
| `set_api_key` | Configure an API key for a provider. Params: `provider`, `key`. |

#### API routes

- `GET /api/financial/exchange-rate` — `?base=USD&quote=EUR&date=2025-01-15`
- `GET /api/financial/convert` — `?amount=1250&from=USD&to=EUR&date=2025-01-15`
- `GET /api/financial/market-price` — `?symbol=bitcoin&currency=EUR&date=2025-01-15`
- `GET /api/financial/providers` — list provider status
- `POST /api/financial/providers/[provider]/key` — set API key

#### Cron integration

- **Daily rate fetch (08:00):** For each currency the user holds assets in (once Sprint 17 lands), fetch today's rate vs EUR and cache it. Until then, no-op — rates are fetched on demand.
- **Startup warm:** On server start, if the cache has no rate for today for common pairs (USD/EUR, GBP/EUR), fetch them proactively.

#### Integration with existing features

- **Receipt flow:** When the AI uploads a receipt in a foreign currency, it calls `convert_currency` to get the EUR equivalent before creating transactions. The MCP server `instructions` field is updated to mention this capability.
- **Sprint 17 bridge:** `AssetPriceService.record()` can optionally source from `FinancialDataService.getMarketPrice()` instead of requiring manual input. A future "update all prices" button/tool fetches latest prices for all tracked assets in one go.

#### Project structure additions

```
src/
├── lib/
│   ├── services/
│   │   ├── financial-data.ts       # Orchestrator: cache + provider fallback
│   │   └── settings.ts             # Generic key-value settings CRUD
│   ├── providers/
│   │   ├── types.ts                # FinancialDataProvider interface
│   │   ├── ecb.ts                  # ECB exchange rates (free, no key)
│   │   ├── frankfurter.ts          # Frankfurter API (free, no key)
│   │   ├── open-exchange-rates.ts  # Open Exchange Rates (key required)
│   │   ├── coingecko.ts            # CoinGecko crypto prices
│   │   └── alpha-vantage.ts        # Alpha Vantage stock prices
│   ├── mcp/tools/
│   │   └── financial.ts            # MCP tool registrations
│   └── validators/
│       └── financial.ts            # Zod schemas for rate/price queries
├── app/api/
│   └── financial/
│       ├── exchange-rate/route.ts
│       ├── convert/route.ts
│       ├── market-price/route.ts
│       └── providers/
│           ├── route.ts            # GET list providers
│           └── [provider]/
│               └── key/route.ts    # POST set API key
```

#### Testing strategy

- **Provider tests:** Mock HTTP responses for each provider. Verify parsing of ECB XML, Frankfurter JSON, CoinGecko JSON, etc.
- **Service tests:** Real SQLite (via `makeTestDb()`). Verify cache-first behavior, TTL expiry, provider fallback, stale flag.
- **Integration tests:** API routes with mocked providers — verify correct responses, error handling, key management.

**Done when:** `convert_currency` MCP tool can answer "what's 15.99 USD in EUR for 2025-01-15?" by hitting ECB/Frankfurter (no API key needed), caching the result, and returning the converted amount. A second call for the same pair+date hits the cache instantly. `get_market_price` can fetch BTC price from CoinGecko. Provider status is visible via `list_providers`. API keys are stored securely in the settings table.

### Sprint 17: Assets & Net Worth Tracking
**Goal:** Unified asset model for tracking net worth across savings, investments, crypto, and foreign currencies. Adds a `transfer` transaction type so asset purchases don't pollute spending reports. Replaces the previously planned separate Accounts (old Sprint 18) and Investments (old Sprint 19) sprints with a single, more powerful abstraction.

#### Design principles

Every financial holding is an **asset** — a bank deposit, a stock position, a crypto wallet, a foreign currency account. All assets are tracked uniformly through **lots** (quantity × price-per-unit events). This eliminates the need for separate account/holdings/transfers tables.

- **Savings deposit (EUR):** 5,000 units at €1.00/unit. Withdrawal = sell 1,000 at €1.00.
- **Foreign currency deposit:** 1,000 USD at €0.92/unit. Exchange rate changes = P&L.
- **Stocks:** 10 SPX at €345.63/unit. Price moves = P&L.
- **Crypto:** 0.5 BTC at €80,000/unit. Same math.

One model, zero special cases.

#### Schema additions

```sql
-- Assets: anything you own that has value
CREATE TABLE assets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,            -- "Emergency Fund", "SPX", "BTC", "USD Savings"
  type        TEXT NOT NULL CHECK(type IN ('deposit', 'investment', 'crypto', 'other')),
  currency    TEXT NOT NULL DEFAULT 'EUR',  -- the currency this asset is denominated in
  icon        TEXT,                     -- emoji or icon name
  color       TEXT,                     -- hex color for charts
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lots: every buy/sell/deposit/withdrawal event
CREATE TABLE asset_lots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  quantity        REAL NOT NULL,         -- positive = buy/deposit, negative = sell/withdraw
  price_per_unit  INTEGER NOT NULL,      -- cents, in the asset's currency
  date            TEXT NOT NULL,          -- ISO 8601 date
  transaction_id  INTEGER REFERENCES transactions(id) ON DELETE SET NULL,  -- optional cash-side link
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Price snapshots: current and historical valuations
CREATE TABLE asset_prices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  price_per_unit  INTEGER NOT NULL,      -- cents, in the asset's currency
  recorded_at     TEXT NOT NULL           -- ISO 8601 datetime
);

-- Indices
CREATE INDEX idx_asset_lots_asset ON asset_lots(asset_id);
CREATE INDEX idx_asset_lots_date ON asset_lots(asset_id, date);
CREATE INDEX idx_asset_lots_transaction ON asset_lots(transaction_id);
CREATE INDEX idx_asset_prices_asset ON asset_prices(asset_id);
CREATE INDEX idx_asset_prices_latest ON asset_prices(asset_id, recorded_at);
```

#### Transaction type extension

The `transactions.type` CHECK constraint gains `'transfer'`:

```sql
CHECK(type IN ('income', 'expense', 'transfer'))
```

**Transfer semantics:**
- A `transfer` transaction records cash leaving (or entering) your account to buy (or sell) an asset
- Transfers are **included in balance calculations** (they affect how much cash you have)
- Transfers are **excluded from spending reports**, savings rate, category budgets, and category breakdowns
- A transfer transaction is optionally linked to an asset lot via `asset_lots.transaction_id`

#### Derived calculations

| Metric | Formula |
|--------|---------|
| Current holdings | `SUM(quantity)` from `asset_lots` per asset |
| Cost basis | `SUM(quantity × price_per_unit)` for positive lots (buys), or weighted-average for partial sells |
| Current value | `SUM(quantity) × latest_price` from `asset_prices` |
| P&L | Current value − cost basis (`null` if no price recorded) |
| Net worth | Cash balance (from transactions) + total current value of all assets |
| Savings rate | `(income − expenses) / income` — transfers excluded from both sides |

**Deposit assets** (type `'deposit'`): if no price is recorded in `asset_prices`, assume price = 100 (€1.00 in cents) for same-currency deposits. Only foreign-currency deposits need explicit price updates.

#### Service layer

- `AssetService`: `create`, `list` (with current holdings + latest price + P&L), `getById`, `update`, `delete`
- `AssetLotService`: `buy` (atomic — creates transfer transaction + lot in one DB transaction), `sell` (atomic — creates transfer transaction + negative lot), `listLots` (history for an asset)
- `AssetPriceService`: `record` (insert price snapshot), `getLatest` (per asset), `getHistory` (time series for charting)
- `PortfolioService`: `getNetWorth` (cash + all assets), `getPnL` (aggregate P&L across all assets), `getAllocation` (percentage breakdown by asset)
- **Existing report updates:** `ReportService.spendingSummary`, `categoryBreakdown`, `trends` — add `WHERE type != 'transfer'` filter. `get_net_balance` tool — transfers still count (cash moved is cash moved).
- **Existing budget updates:** `BudgetService.getForMonth` — exclude transfers from spend calculations.

#### MCP tools

| Tool | Description |
|------|-------------|
| `create_asset` | Create an asset (name, type, currency, icon, color) |
| `list_assets` | All assets with current holdings, cost basis, current value, P&L |
| `get_asset` | Single asset with full details |
| `update_asset` | Update asset metadata (name, icon, color, notes) |
| `delete_asset` | Delete an asset and its lots |
| `buy_asset` | Record a purchase/deposit: asset, quantity, price per unit (cents), date. Creates a `transfer` transaction + asset lot atomically. |
| `sell_asset` | Record a sale/withdrawal: asset, quantity, price per unit (cents), date. Creates a `transfer` transaction + negative lot atomically. |
| `record_price` | Update current price for an asset. Used after checking a quote/rate. |
| `get_portfolio` | Full portfolio: all assets with holdings + P&L + net worth + allocation percentages |
| `get_price_history` | Price time series for a single asset (for charting) |
| `list_lots` | Lot history for a single asset (buy/sell events) |

#### API routes

- `GET/POST /api/assets` — list + create
- `GET/PATCH/DELETE /api/assets/[id]` — single asset CRUD
- `POST /api/assets/[id]/buy` — record purchase/deposit
- `POST /api/assets/[id]/sell` — record sale/withdrawal
- `GET /api/assets/[id]/lots` — lot history
- `GET/POST /api/assets/[id]/prices` — price history + record new price
- `GET /api/portfolio` — net worth, allocation, aggregate P&L

#### UI

- **Assets page** (`/assets`): asset cards/list showing name, type, icon, current holdings, current value, P&L (color-coded green/red), allocation %
- **Asset detail view**: lot history table (date, quantity, price, linked transaction), price chart (sparkline or full chart), P&L breakdown
- **Dashboard additions**: net worth card (cash + assets), portfolio allocation donut chart, top movers (assets with biggest P&L change)
- **Transaction list**: transfer type shown with distinct styling (e.g., arrow icon, muted color), filterable (show/hide transfers)
- **Quick actions**: "Buy asset" / "Sell asset" modals accessible from asset cards and transaction page
- **Sidebar**: add "Assets" nav item between Budgets and Recurring

#### Project structure additions

```
src/
├── app/
│   ├── assets/
│   │   ├── page.tsx              # Assets list
│   │   └── [id]/
│   │       └── page.tsx          # Asset detail (lots, prices, P&L)
│   └── api/
│       ├── assets/
│       │   ├── route.ts          # GET/POST
│       │   └── [id]/
│       │       ├── route.ts      # GET/PATCH/DELETE
│       │       ├── buy/route.ts
│       │       ├── sell/route.ts
│       │       ├── lots/route.ts
│       │       └── prices/route.ts
│       └── portfolio/
│           └── route.ts          # GET net worth + allocation
├── components/
│   └── assets/                   # Asset cards, lot table, price chart, buy/sell modals
├── lib/
│   ├── services/
│   │   ├── assets.ts
│   │   ├── asset-lots.ts
│   │   ├── asset-prices.ts
│   │   └── portfolio.ts
│   ├── mcp/tools/
│   │   └── assets.ts
│   └── validators/
│       └── assets.ts
```

**Done when:** "Bought 10 SPX for €3,456.32" via MCP creates a transfer transaction (cash balance drops by €3,456.32, excluded from spending) + an asset lot (10 units at €345.63). "SPX is now €360" records a price → P&L shows +€143.70. "Deposited €1,000 to savings" creates a transfer + deposit lot. Dashboard shows net worth across cash + all assets. Savings rate stays clean.

---

### Sprint 18: Portfolio & Asset Reports — Backend
**Goal:** Service layer, API routes, and MCP tools for common portfolio/asset analytics. All computed from lots + prices — no snapshots.

#### Reports

| Report | What it answers | How it's computed |
|--------|----------------|-------------------|
| **Net worth over time** | "How has my total wealth changed?" | For each date point: sum of transactions up to that date (cash) + sum of lot quantities up to that date × nearest recorded price. Configurable window (3/6/12 months, YTD, all time). |
| **Asset performance** | "How is each asset doing?" | Per asset: cost basis (from lots), current value (quantity × latest price), P&L (absolute + %), annualized return. Sortable by P&L, value, return %. |
| **Portfolio allocation** | "Where is my money?" | Percentage breakdown: cash vs each asset, optionally grouped by asset type (deposits/investments/crypto). Current + historical (allocation at month boundaries). |
| **Asset history** | "What happened with this specific asset?" | Per asset: lot timeline (buys/sells with quantities, prices, running total), price chart overlay, value over time. |
| **Currency exposure** | "How exposed am I to each currency?" | Group all assets by currency, sum current values, show as percentages of total net worth. |
| **Realized vs unrealized P&L** | "What have I actually locked in vs what's on paper?" | Realized: P&L from sell lots (sell price − average cost basis at time of sell). Unrealized: current value − remaining cost basis. |
| **Income/expense/transfer summary** | "Where did my money go this month, including transfers?" | Extends existing `spending_summary` with a transfer breakdown: how much went to each asset type, net cash flow after transfers. |

#### Service layer

- `PortfolioReportService`:
  - `getNetWorthTimeSeries(window)` — time series of total net worth (cash + assets) at configurable intervals (daily/weekly/monthly)
  - `getAssetPerformance(dateRange?)` — per-asset P&L table with cost basis, current value, absolute P&L, percentage return, annualized return
  - `getAllocationHistory(window)` — portfolio allocation at month boundaries over time
  - `getCurrencyExposure()` — current value grouped by currency
  - `getRealizedPnL(dateRange?)` — P&L from completed sells, using weighted-average cost basis
  - `getAssetHistory(assetId, window)` — combined lot + price timeline for a single asset
  - `getTransferSummary(month)` — transfer amounts grouped by destination asset/type

- **Extend existing** `ReportService`:
  - `spendingSummary` gains an optional `includeTransfers` flag — when true, returns a separate `transfers` section showing money moved to assets
  - `trends` gains a `netWorth` mode alongside the existing spending mode

#### MCP tools

| Tool | Description |
|------|-------------|
| `get_net_worth_history` | Net worth time series. Params: window (3m/6m/12m/ytd/all), interval (daily/weekly/monthly). Returns date + cash + assets + total per point. |
| `get_asset_performance` | All assets ranked by performance. Params: optional date range. Returns cost basis, current value, P&L, P&L %, annualized return per asset. |
| `get_allocation` | Current portfolio allocation by asset and by type. |
| `get_currency_exposure` | Net worth breakdown by currency. |
| `get_realized_pnl` | Realized P&L from sells in a date range. |
| `get_asset_history` | Combined lot + price + value timeline for one asset. Params: asset ID, window. |

#### API routes

- `GET /api/portfolio/net-worth` — `?window=6m&interval=monthly`
- `GET /api/portfolio/performance` — `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/portfolio/allocation` — `?historical=true&window=12m`
- `GET /api/portfolio/currency-exposure`
- `GET /api/portfolio/realized-pnl` — `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/assets/[id]/history` — `?window=12m`
- `GET /api/reports/summary` — extended with `?includeTransfers=true`

#### Key implementation notes

- **Net worth at a past date** requires finding the nearest recorded price for each asset held at that date. If no price exists before a date for an asset, use the lot's `price_per_unit` (cost basis) as a fallback — better than `null`.
- **Annualized return** uses time-weighted calculation: `((current_value / cost_basis) ^ (365 / days_held)) - 1`. Only meaningful for assets held > 30 days.
- **Deposit assets** (type `'deposit'`, same currency): price is always 1, so P&L is always 0 and net worth contribution = sum of lots. Skip price lookups for these.
- All reports should handle the **empty state** gracefully (no assets yet, no prices recorded).

**Done when:** The AI can ask "how has my net worth changed over the last 6 months?" and get a time series. "Which of my assets is performing best?" returns a ranked P&L table. All endpoints return correct data tested against known lot + price fixtures.

---

### Sprint 19: Portfolio & Asset Reports — UI
**Goal:** Web UI pages and dashboard widgets for visualizing portfolio reports from Sprint 18.

#### Assets page enhancements (`/assets`)

- **Performance table**: sortable columns — asset name, type, holdings, cost basis, current value, P&L (€), P&L (%), annualized return. Color-coded green/red for P&L.
- **Allocation donut chart**: interactive — click a segment to navigate to asset detail
- **Currency exposure bar**: horizontal stacked bar showing % per currency
- **Summary cards row**: total net worth, total invested, total P&L (absolute + %), cash balance

#### Asset detail page enhancements (`/assets/[id]`)

- **Value over time chart**: line chart combining price history × holdings quantity. Overlay lot events (buy/sell markers on the timeline).
- **Lot history table**: date, type (buy/sell), quantity, price per unit, total value, running holdings total, linked transaction (clickable)
- **P&L card**: cost basis, current value, unrealized P&L, realized P&L (from sells)
- **Price history chart**: standalone price line chart with "record price" quick action

#### New page: Portfolio Reports (`/portfolio`)

- **Net worth over time**: area chart (stacked: cash + each asset, or grouped by asset type). Date range picker with presets.
- **Allocation over time**: stacked area or stacked bar chart showing allocation % shifts month-over-month
- **Performance ranking**: horizontal bar chart — assets sorted by P&L % or absolute P&L, toggleable
- **Realized vs unrealized P&L**: grouped bar chart or summary cards
- **Transfer flow**: Sankey-style or simple bar chart showing money flow from cash → asset types per month

#### Dashboard additions

- **Net worth card**: prominent, showing total net worth with trend arrow (vs last month)
- **Net worth sparkline**: mini area chart (last 6 months) below or beside the card
- **Top movers**: 2-3 assets with biggest P&L change (absolute or %) this month
- **Allocation mini-donut**: small donut chart in the dashboard grid

#### Responsive considerations

- Charts should degrade gracefully on mobile (hide legends, simplify to key metrics)
- Performance table → card layout on small screens
- Portfolio page tabs on mobile instead of side-by-side sections

#### Project structure additions

```
src/
├── app/
│   └── portfolio/
│       └── page.tsx                  # Portfolio reports page
├── components/
│   ├── portfolio/                    # Portfolio-specific charts and widgets
│   │   ├── net-worth-chart.tsx
│   │   ├── allocation-chart.tsx
│   │   ├── performance-table.tsx
│   │   ├── currency-exposure.tsx
│   │   ├── pnl-summary.tsx
│   │   └── transfer-flow.tsx
│   └── assets/                       # Enhanced asset components
│       ├── value-chart.tsx           # Asset value over time with lot markers
│       └── price-chart.tsx           # Price history with record action
```

**Done when:** Portfolio page shows net worth over time, allocation breakdown, and performance ranking with real data. Asset detail pages show value charts with buy/sell markers. Dashboard includes net worth card with sparkline. All charts are responsive.

---
### Sprint 20: Onboarding & Initial Setup
**Goal:** Make it easy for new users to enter their current financial state without fabricating transaction history. Includes an interactive first-run experience.

#### The problem

A new user has an existing financial life: bank balance, savings, maybe some investments. Without onboarding, they'd need to create fake income transactions (inflating reports) or manually construct lots. The app should meet users where they are.

#### Opening balance approach

Uses `transfer` type transactions (already excluded from income/expense reports) and unlinked asset lots. No schema changes needed.

- **Cash opening balance:** A `transfer` transaction with a description like "Opening balance" and no linked asset. Included in balance calculation, excluded from spending/income reports. Effectively: "I had this much cash before I started tracking."
- **Asset opening balances:** An asset lot with `transaction_id = null`. Represents "I already own this." User provides: asset name/type, quantity held, approximate total cost basis (or "I don't know" → use current value as cost basis, P&L starts from zero).

#### First-run setup wizard (Web UI)

Triggered on first visit when no transactions exist. Multi-step flow:

1. **Welcome** — brief intro, "Let's set up your starting point"
2. **Currency** — confirm default currency (EUR), option to change
3. **Cash balance** — "How much cash do you have right now?" Single input → creates opening balance transfer transaction
4. **Savings** (optional) — "Do you have any savings accounts?" → for each: name, current balance → creates deposit asset + opening lot
5. **Investments** (optional) — "Do you own any stocks, ETFs, or crypto?" → for each: name, type (stock/crypto), quantity, approximate cost basis → creates asset + opening lot
6. **Categories** — show default categories, let user toggle on/off, rename, add custom ones. Quick and visual (checkboxes + inline edit).
7. **Done** — summary of what was created, link to dashboard

The wizard should be **skippable** ("I'll set this up later") and **re-runnable** (accessible from settings, not just first-run — in case someone wants to add a new asset opening balance later).

#### MCP onboarding tools

| Tool | Description |
|------|-------------|
| `set_opening_cash_balance` | Set initial cash balance. Creates a `transfer` transaction dated today (or specified date). Idempotent: if an opening balance transfer already exists, updates it. |
| `add_opening_asset` | Add an existing asset holding. Params: name, type, currency, quantity, cost_basis_total (cents, optional — defaults to current value if price provided, or quantity × price_per_unit). Creates asset + lot with no transaction link. |
| `get_onboarding_status` | Returns what's been set up: has opening cash balance, list of assets with opening lots, category count. Helps the AI know what to ask next. |

This lets the AI run the same onboarding conversationally: "What's your current bank balance?" → "Do you have any savings or investments?" → enters everything via MCP.

#### Interactive tutorial

After setup (or skippable independently):

- **Guided tour**: highlight key UI areas (sidebar nav, transaction list, add button, filters) using tooltip overlays
- **First transaction prompt**: "Try adding your first real transaction" with a guided form
- **MCP hint**: for AI-connected users, show a card: "You can also add transactions by telling your AI assistant — just send a receipt photo or say 'spent €25 at Lidl on groceries'"
- **Sample data option**: "Want to explore with sample data first?" → loads demo transactions/assets (ties into the existing "Clear sample data" bar from Sprint 21)

#### API routes

- `POST /api/onboarding/cash-balance` — set opening cash balance
- `POST /api/onboarding/asset` — add opening asset holding
- `GET /api/onboarding/status` — what's been configured

#### Project structure additions

```
src/
├── app/
│   ├── onboarding/
│   │   └── page.tsx              # Setup wizard
│   └── api/
│       └── onboarding/
│           ├── cash-balance/route.ts
│           ├── asset/route.ts
│           └── status/route.ts
├── components/
│   └── onboarding/               # Wizard steps, tour overlays
│       ├── wizard.tsx
│       ├── steps/
│       │   ├── welcome.tsx
│       │   ├── currency.tsx
│       │   ├── cash-balance.tsx
│       │   ├── savings.tsx
│       │   ├── investments.tsx
│       │   ├── categories.tsx
│       │   └── summary.tsx
│       └── guided-tour.tsx
├── lib/
│   └── services/
│       └── onboarding.ts         # Opening balance + status logic
```

**Done when:** A brand new user opens the app, walks through the wizard in under 2 minutes, and lands on a dashboard showing their actual net worth. An AI assistant can do the same via MCP: "I have €5,000 in my bank, €3,000 in savings, and 0.5 BTC" → three tool calls → everything set up. No fake income transactions polluting reports.

---

### Sprint 21: Polish & Hardening
**Goal:** Production readiness.

- [ ] Dark mode (Tailwind dark variant)
- [ ] Mobile-responsive audit and fixes
- [ ] CSV export for any filtered view
- [ ] Tailscale access verification middleware
- [ ] Error boundaries and loading states across all pages
- [ ] Performance: check query efficiency, add missing indices if needed
- [ ] Floating "Clear sample data" bar (shows only when populated with seed/sample data) to let users easily reset and start using the app.

**Done when:** App is polished, responsive, handles errors gracefully, ready for daily use.

---

### Sprint 22: Packaging & Auto-Updates
**Goal:** Make Pinch trivial to deploy and maintain for anyone (human or AI agent).

- [ ] Provide simple, robust packaging (e.g., Docker container or single install script)
- [ ] Build an auto-updater mechanism for easy rolling releases

---

### Sprint 23: Documentation & Project Files
**Goal:** Make this a proper public open-source project.

- [ ] README.md — project overview, feature list, screenshots/demo, tech stack, quick start guide, usage instructions
- [ ] LICENSE file (choose an appropriate open-source license)
- [ ] CONTRIBUTING.md — dev setup, how to run tests, coding standards, PR workflow
- [ ] API documentation — REST endpoints and MCP tools (in README or `docs/`)
- [ ] Extend MCP `instructions` field: Add explicit behavioral prompts (e.g., "If unsure about categorization, ask the user and remember the decision for next time").
- [ ] Verify .gitignore, .env.example, and any other dotfiles are in order

**Done when:** A developer can clone the repo, read the README, and get running. Project looks professional on GitHub.

---

### Sprint 24: Project Website
**Goal:** Create a public face for the project.

- [ ] Build a standalone project website (e.g., hosted on GitHub Pages) to serve as the main landing page and documentation hub
- [ ] Write definitive Quick Start installation instructions hosted on the website, specifically formatted for an AI agent (so a user can just drop the URL to their agent to deploy Pinch)

## Future Considerations (not in scope now, but design should accommodate)

- **CSV/OFX import:** Bank statement import. Service layer already structured for batch inserts. Add a parser + import UI/MCP tool when needed.
- **Multi-currency transactions:** Assets already support per-asset currencies (Sprint 17). For full multi-currency, add a `currency` field to transactions and an exchange rate table. All reporting converts to EUR base.
- **Attachments:** Beyond receipts — invoices, contracts. Generalize receipt storage to a generic attachments table.
- **App-level auth:** Session-based or token-based auth for shared access or public exposure. Keep auth concerns in middleware/route guards so this can be slotted in cleanly.
- **Shared access:** Multiple users or shared household access. Auth is a prerequisite.
