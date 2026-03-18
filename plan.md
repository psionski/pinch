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
| Charts | Tremor | Dashboard primitives built on Recharts + Tailwind |
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
│  │  (Tremor    │  │  /api/transactions    │   │
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
  type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense')),
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
  type TEXT NOT NULL DEFAULT 'expense' CHECK(type IN ('income', 'expense')),
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
│   │       └── receipts/
│   │           ├── upload/
│   │           │   └── route.ts      # POST multipart receipt image upload → { receipt_id }
│   │           └── [id]/
│   │               └── image/
│   │                   └── route.ts  # GET serve receipt image by ID
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── charts/              # Tremor chart wrappers
│   │   ├── transactions/        # Transaction list, form, filters
│   │   ├── categories/          # Category tree, merge dialog
│   │   ├── budgets/             # Budget progress bars, form
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
│   │   │   └── backup.ts        # SQLite backup logic
│   │   ├── mcp/
│   │   │   ├── server.ts        # MCP server init + tool registration
│   │   │   └── tools/
│   │   │       ├── transactions.ts
│   │   │       ├── categories.ts
│   │   │       ├── reports.ts
│   │   │       ├── budgets.ts
│   │   │       ├── recurring.ts
│   │   │       └── query.ts     # Read-only SQL escape hatch
│   │   ├── validators/          # Zod schemas (shared by API + MCP + forms)
│   │   │   ├── common.ts        # Pagination, error envelope
│   │   │   ├── transactions.ts
│   │   │   ├── categories.ts
│   │   │   ├── budgets.ts
│   │   │   └── recurring.ts
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

- [x] Root layout with sidebar navigation (Dashboard, Transactions, Categories, Reports, Budgets, Recurring)
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

### Sprint 12: Budgets Page
**Goal:** Budget management and tracking UI.

- [ ] Set monthly budgets per category (form with amount input in decimal, stored as cents)
- [ ] Progress bars: green (<60%) → yellow (60-90%) → red (>90%)
- [ ] Copy budgets from previous month (one-click)
- [ ] Dashboard: budget alerts (categories approaching >80% or over budget)
- [ ] Historical budget adherence chart

**Done when:** Can set, view, and track budgets. Visual feedback on spending vs budget.

---

### Sprint 13: Recurring Transactions Page
**Goal:** Recurring template management UI.

- [ ] List: description, amount, frequency, next occurrence, status (active/paused)
- [ ] Create/edit form: amount, description, merchant, category, frequency, schedule, start/end date
- [ ] Toggle active/inactive
- [ ] View generated transactions for a template
- [ ] Dashboard: upcoming recurring (next 5 due)

**Done when:** Full recurring transaction management through the UI.

---

### Sprint 14: Reports Page
**Goal:** Rich reporting with configurable date ranges and visualizations.

- [ ] Date range picker with presets (this month, last month, last 3/6/12 months, YTD, custom)
- [ ] Spending by category: horizontal bar chart
- [ ] Trends: multi-line chart (total + selected categories over time)
- [ ] Merchant breakdown: table with merchant, total spend, count, avg transaction
- [ ] Budget vs actual: grouped bar chart
- [ ] Income vs expenses: summary card + trend chart

**Done when:** All report types render with real data, date range filtering works.

---

### Sprint 15: Receipts Flow
**Goal:** Receipt upload via REST + linking via MCP + display in UI.

- [ ] `ReceiptService`: upload (save image, create DB record), getById, getImage, listUnprocessed
- [ ] `POST /api/receipts/upload` — multipart form-data endpoint (image file + optional metadata). Saves to `data/receipts/YYYY-MM/receipt-{id}.{ext}`, returns `{ receipt_id }`
- [ ] `GET /api/receipts/[id]/image` — serve stored receipt images with correct Content-Type
- [ ] **MCP Tools:** `list_unprocessed_receipts`, `get_receipt` (so the AI can proactively read and categorize new uploads)
- [ ] MCP `add_transactions` tool: accepts optional `receipt_id` to link batch items to an uploaded receipt
- [ ] UI: receipt icon on transactions → click to see full receipt, all items, original image
- [ ] UI: "Add Receipt" button with file picker / drag-and-drop upload

**Done when:** AI clients can upload receipt images via REST (discovered through MCP instructions), link transactions via MCP, and the web UI displays receipt details.

---

### Sprint 16: Documentation & Project Files
**Goal:** Make this a proper public open-source project.

- [ ] README.md — project overview, feature list, screenshots/demo, tech stack, quick start guide, usage instructions
- [ ] LICENSE file (choose an appropriate open-source license)
- [ ] CONTRIBUTING.md — dev setup, how to run tests, coding standards, PR workflow
- [ ] API documentation — REST endpoints and MCP tools (in README or `docs/`)
- [ ] Extend MCP `instructions` field: Add explicit behavioral prompts (e.g., "If unsure about categorization, ask the user and remember the decision for next time").
- [ ] Verify .gitignore, .env.example, and any other dotfiles are in order

**Done when:** A developer can clone the repo, read the README, and get running. Project looks professional on GitHub.

---

### Sprint 17: Polish & Hardening
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

### Sprint 18: Accounts & Savings
**Goal:** First-class account model. Existing transactions map to a default checking account. Savings accounts can be created, and transfers between accounts are recorded atomically.

#### Schema additions

```sql
accounts (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,          -- "Main Checking", "Emergency Fund", etc.
  type        TEXT NOT NULL,          -- 'checking' | 'savings'
  currency    TEXT NOT NULL DEFAULT 'EUR',
  notes       TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0,  -- only one account can be default
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
)

-- transactions gets a nullable FK; NULL means "default account" for backwards compat
-- (add account_id to the transactions table definition in schema.ts; Drizzle Kit generates the migration)

transfers (
  id                   INTEGER PRIMARY KEY,
  from_account_id      INTEGER NOT NULL REFERENCES accounts(id),
  from_transaction_id  INTEGER NOT NULL REFERENCES transactions(id),
  to_account_id        INTEGER NOT NULL REFERENCES accounts(id),
  to_transaction_id    INTEGER NOT NULL REFERENCES transactions(id),
  amount               INTEGER NOT NULL,  -- cents, always positive
  date                 TEXT NOT NULL,
  notes                TEXT,
  created_at           TEXT NOT NULL
)
```

A transfer creates two transactions (one `expense` on the source, one `income` on the destination) inside a DB transaction, then records the link in `transfers`. Deleting a transfer deletes both child transactions.

#### Service layer

- `AccountService`: `create`, `list`, `getById`, `update`, `delete`, `getBalance` (sum of all transactions on the account, or default account if null)
- `TransferService`: `create` (atomic — two txns + transfer record), `list`, `getById`, `delete` (atomic)
- `TransactionService.list`: extend `accountId` filter (null = default account, a number = specific account)

#### MCP tools

| Tool | Description |
|------|-------------|
| `list_accounts` | All accounts with current balance |
| `create_account` | Create a savings account |
| `get_account_balance` | Balance for a specific account |
| `create_transfer` | Move money between accounts — e.g. "deposited 1000 EUR to savings" → debit checking, credit savings |
| `list_transfers` | Recent transfers, optionally filtered by account |

#### API routes

- `GET/POST /api/accounts`
- `GET/PATCH/DELETE /api/accounts/[id]`
- `GET /api/accounts/[id]/balance`
- `GET/POST /api/transfers`
- `GET/DELETE /api/transfers/[id]`

#### UI

- Dashboard: account balance cards (one per account) above the KPI row
- Transfers page or modal: select from/to account, amount, date, optional note
- Transaction list: account column + account filter dropdown

**Done when:** You can tell the AI "move 500 EUR to savings" and it creates a transfer. Both account balances update correctly. The web UI shows per-account balances.

---

### Sprint 19: Investment Accounts & Portfolio Tracking
**Goal:** Track stock/ETF/crypto purchases. Buying an asset debits the funding account and records a holding. A prices table provides current values for P&L calculation.

#### Schema additions

```sql
-- accounts.type gains 'investment' (extends Sprint 18 enum)

holdings (
  id               INTEGER PRIMARY KEY,
  account_id       INTEGER NOT NULL REFERENCES accounts(id),
  ticker           TEXT NOT NULL,   -- "SPX", "AAPL", "BTC", etc.
  name             TEXT,            -- "S&P 500 ETF", optional display name
  quantity         REAL NOT NULL,   -- supports fractional shares
  cost_basis_cents INTEGER NOT NULL, -- total paid, in cents
  currency         TEXT NOT NULL DEFAULT 'EUR',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (account_id, ticker)
)

asset_prices (
  id           INTEGER PRIMARY KEY,
  ticker       TEXT NOT NULL,
  price_cents  INTEGER NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'EUR',
  recorded_at  TEXT NOT NULL        -- ISO datetime
)
-- only the latest price per ticker matters for P&L; history is kept for charting
```

#### Business logic

- **Buy:** debit funding account (new `expense` transaction linked to holding), upsert holding (add quantity, add to cost basis). All in one DB transaction.
- **Sell:** credit funding account (new `income` transaction), reduce holding quantity/cost basis proportionally (FIFO average cost). If quantity reaches 0, holding remains at zero (not deleted) for history.
- **P&L:** `(current_price × quantity) − cost_basis`. Requires a price record. If no price recorded, P&L is `null`.
- **Price updates:** stored in `asset_prices`. The AI can record a price any time ("SPX is now 5800 USD"). Latest record per ticker is used for valuations.

#### Service layer

- `InvestmentService`: `buy` (atomic), `sell` (atomic), `listHoldings`, `getHolding`, `getPortfolioPnL` (all holdings + latest prices)
- `PriceService`: `record` (insert price), `getLatest` (latest price per ticker), `getHistory` (time series for charting)

#### MCP tools

| Tool | Description |
|------|-------------|
| `buy_asset` | Record a purchase: ticker, quantity, total cost in cents, funding account, date. Creates expense + updates holding. |
| `sell_asset` | Record a sale: ticker, quantity, total proceeds in cents, destination account, date. Creates income + reduces holding. |
| `record_price` | Update current price for a ticker. Use after checking a quote. |
| `list_holdings` | All holdings with quantity, cost basis, current value, and P&L (null if no price recorded). |
| `get_portfolio_pnl` | Aggregate portfolio: total cost basis, total current value, total P&L, P&L %. |

#### API routes

- `GET/POST /api/investments/holdings`
- `GET /api/investments/holdings/[id]`
- `POST /api/investments/buy`
- `POST /api/investments/sell`
- `GET/POST /api/investments/prices` — record + history
- `GET /api/investments/pnl`

#### UI

- Investment account detail page: holdings table (ticker, quantity, cost basis, current price, current value, P&L, P&L %)
- "Update price" inline action per row (quick form → calls `record_price`)
- Portfolio summary card on dashboard: total invested, current value, total P&L with colour coding
- Price history sparkline per holding

**Done when:** "Bought 10 SPX for 3456.32 EUR" via MCP creates the expense on the checking account and records the holding. Telling the AI the current price shows accurate P&L in the UI.

---
### Sprint 20: Packaging & Auto-Updates
**Goal:** Make Pinch trivial to deploy and maintain for anyone (human or AI agent).

- [ ] Provide simple, robust packaging (e.g., Docker container or single install script)
- [ ] Build an auto-updater mechanism for easy rolling releases

### Sprint 21: Project Website & AI Onboarding
**Goal:** Create a public face for the project and a frictionless onboarding experience.

- [ ] Build a standalone project website (e.g., hosted on GitHub Pages) to serve as the main landing page and documentation hub
- [ ] Write definitive Quick Start installation instructions hosted on the website, specifically formatted for an AI agent (so a user can just drop the URL to their agent to deploy Pinch)
- [ ] Implement an interactive tutorial (either on the website or an in-app wizard) to guide users through their first setup and transactions

## Future Considerations (not in scope now, but design should accommodate)

- **CSV/OFX import:** Bank statement import. Service layer already structured for batch inserts. Add a parser + import UI/MCP tool when needed.
- **Multi-currency:** Add `currency` field to transactions, exchange rate table. All reporting converts to EUR base. Avoid hardcoding EUR assumptions in business logic so this is easy to add.
- **Attachments:** Beyond receipts — invoices, contracts. Generalize receipt storage to a generic attachments table.
- **App-level auth:** Session-based or token-based auth for shared access or public exposure. Keep auth concerns in middleware/route guards so this can be slotted in cleanly.
- **Shared access:** Multiple users or shared household access. Auth is a prerequisite.
