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
│  │   Transactions, Categories, Reports,   │   │
│  │   Budgets, Recurring, Receipts,        │   │
│  │   Assets, Portfolio, FinancialData,    │   │
│  │   Settings                             │   │
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

**Future: app-level auth.** The architecture should not make auth hard to add later. Keep auth concerns isolated (middleware/route guards), so we can slot in session-based or token-based auth when needed (e.g., shared access, public exposure). **Note:** Once auth is added and pages call `cookies()`/`headers()`, Next.js will automatically treat them as dynamic — at that point, remove the `export const dynamic = "force-dynamic"` lines from page files, as they'll be redundant.

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

-- Budgets (per category per month, with soft-delete for inheritance)
CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL,           -- YYYY-MM format
  amount INTEGER NOT NULL,       -- cents
  deleted INTEGER NOT NULL DEFAULT 0,  -- soft-delete flag (1 = deleted)
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

-- App-level settings (key-value store for API keys, timezone, preferences)
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Unified price cache: market prices, exchange rates, and any other provider data.
-- Exchange rates are stored as prices: symbol='USD', currency='EUR', price=0.92 means 1 USD = 0.92 EUR.
CREATE TABLE market_prices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol        TEXT NOT NULL,           -- ticker/id: 'AAPL', 'bitcoin', or currency code: 'USD'
  price         TEXT NOT NULL,           -- string to avoid float imprecision
  currency      TEXT NOT NULL,           -- target currency (e.g. 'EUR')
  date          TEXT NOT NULL,           -- YYYY-MM-DD
  provider      TEXT NOT NULL,
  fetched_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(symbol, currency, date)
);

-- Assets: anything you own that has value (deposit, investment, crypto, other)
CREATE TABLE assets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('deposit', 'investment', 'crypto', 'other')),
  currency    TEXT NOT NULL DEFAULT 'EUR',
  symbol_map  TEXT,                     -- JSON: {"coingecko":"bitcoin"} for auto price tracking
  icon        TEXT,
  color       TEXT,
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
  date            TEXT NOT NULL,
  transaction_id  INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Price snapshots: user-recorded or auto-fetched asset valuations
CREATE TABLE asset_prices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id        INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  price_per_unit  INTEGER NOT NULL,      -- cents, in the asset's currency
  recorded_at     TEXT NOT NULL
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

**Price resolution:** When valuing an asset, the unified price resolver (`src/lib/services/price-resolver.ts`) checks in order: user-recorded `asset_prices` → provider data in `market_prices` (via `symbolMap`) → lot cost basis → deposit identity (EUR deposits = €1.00).

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

-- Market prices
CREATE INDEX idx_market_prices_symbol ON market_prices(symbol, date);

-- Asset lots & prices
CREATE INDEX idx_asset_lots_asset ON asset_lots(asset_id);
CREATE INDEX idx_asset_lots_date ON asset_lots(asset_id, date);
CREATE INDEX idx_asset_lots_transaction ON asset_lots(transaction_id);
CREATE INDEX idx_asset_prices_asset ON asset_prices(asset_id);
CREATE INDEX idx_asset_prices_latest ON asset_prices(asset_id, recorded_at);

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

## MCP Tools (59 tools)

### Transactions (8 tools)
| Tool | Description |
|------|-------------|
| `create_transaction` | Add a single transaction |
| `create_transactions` | Batch add, optionally linked to an uploaded receipt via `receipt_id` |
| `get_transaction` | Get a single transaction by ID |
| `list_transactions` | List/filter by date range, category, amount range, merchant, text search, tags, type. Pagination via limit+offset. |
| `update_transaction` | Update fields on an existing transaction by ID |
| `batch_update_transactions` | Bulk-update multiple transactions in one call |
| `delete_transaction` | Delete by ID or array of IDs |
| `list_tags` | List all distinct tags used across transactions |

### Categories (7 tools)
| Tool | Description |
|------|-------------|
| `list_categories` | All categories with hierarchy, transaction counts, and metadata |
| `get_category` | Get a single category by ID |
| `create_category` | New category (name, optional parent, icon, color) |
| `update_category` | Rename, reparent, change icon/color |
| `delete_category` | Delete a category (transactions become uncategorized) |
| `recategorize` | Bulk-move transactions matching a filter to a new category |
| `merge_categories` | Merge source into target — reassign transactions, transfer budgets, delete source |

### Budgets (4 tools)
| Tool | Description |
|------|-------------|
| `set_budget` | Set or update a monthly budget for a category |
| `get_budget_status` | Spend vs budget for all budgeted categories in a month, with amounts, percentages, and over/under status |
| `delete_budget` | Remove a budget for a category + month |
| `reset_budgets` | Revert a month's budgets to inherited defaults |

### Recurring Transactions (6 tools)
| Tool | Description |
|------|-------------|
| `create_recurring` | Create a recurring template (daily/weekly/monthly/yearly) |
| `get_recurring` | Get a single recurring template by ID |
| `list_recurring` | List all templates with next occurrence and status |
| `update_recurring` | Modify a template (or pause with `isActive: false`) |
| `delete_recurring` | Delete a template (past transactions kept) |
| `generate_pending_recurring` | Manually trigger generation of pending recurring transactions up to today |

### Receipts (4 tools)
| Tool | Description |
|------|-------------|
| `get_receipt` | Get receipt metadata and image URL by ID |
| `list_receipts` | List/filter receipts by date range or merchant |
| `list_unprocessed_receipts` | Find receipts with no linked transactions yet |
| `delete_receipt` | Delete receipt(s) and their image files |

### Reporting (6 tools)
| Tool | Description |
|------|-------------|
| `get_spending_summary` | Total spend for a period, grouped by category/month/merchant, with optional period comparison |
| `get_category_stats` | Per-category spending with amounts, percentages, and hierarchy rollups |
| `get_trends` | Monthly totals time series (up to 24 months), optionally filtered by category |
| `get_top_merchants` | Highest-spend merchants with transaction counts and averages |
| `get_net_income` | Profit & Loss: income minus expenses, optionally filtered by date range |
| `get_cash_balance` | Current checking account balance (income − expenses ± asset transfers) |

### Portfolio Reports (6 tools)
| Tool | Description |
|------|-------------|
| `get_net_worth_history` | Net worth time series. Params: window (3m/6m/12m/ytd/all), interval (daily/weekly/monthly). Returns date + cash + assets + total per point. |
| `get_asset_performance` | All assets ranked by performance. Returns cost basis, current value, P&L, P&L %, annualized return per asset. |
| `get_allocation` | Current portfolio allocation by asset and by type. |
| `get_currency_exposure` | Net worth breakdown by currency. |
| `get_realized_pnl` | Realized P&L from sells in a date range, using FIFO cost basis. |
| `get_asset_history` | Combined lot + price + value timeline for one asset. Params: asset ID, window. |

### Assets (10 tools)
| Tool | Description |
|------|-------------|
| `create_asset` | Create an asset (name, type, currency, symbolMap, icon, color) |
| `list_assets` | All assets with current holdings, cost basis, current value, P&L |
| `get_asset` | Single asset with full details |
| `update_asset` | Update asset metadata |
| `delete_asset` | Delete an asset and its lots |
| `buy_asset` | Record purchase/deposit — creates transfer transaction + lot atomically |
| `sell_asset` | Record sale/withdrawal — creates transfer transaction + negative lot atomically |
| `record_price` | Update current price for an asset |
| `list_lots` | Lot history for a single asset |
| `get_price_history` | Price time series for a single asset |

### Financial Data (5 tools)
| Tool | Description |
|------|-------------|
| `convert_currency` | Convert amount between currencies (cache-first, provider fallback) |
| `get_price` | Unified price lookup — exchange rates, crypto, stocks, ETFs |
| `search_symbol` | Search for market symbols across all providers |
| `list_providers` | List configured financial data providers with status |
| `set_api_key` | Configure an API key for a provider |

### Settings (2 tools)
| Tool | Description |
|------|-------------|
| `get_timezone` | Get the configured user timezone |
| `set_timezone` | Set the user timezone (IANA identifier) |

### Escape Hatch (2 tools)
| Tool | Description |
|------|-------------|
| `get_db_schema` | Return CREATE TABLE DDL and data conventions (use before writing queries) |
| `query` | Execute read-only SQL (SELECT/WITH) for ad-hoc analysis |

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

  // Schedule market price auto-fetch — daily at 04:00
  // For each asset with a symbolMap, fetches today's price from the linked provider
  cron.schedule("0 4 * * *", async () => {
    await autoRecordMarketPrices();
  });
}
```

### Recurring transaction generation

1. Each recurring template defines: amount, description, category, frequency (daily/weekly/monthly/yearly), schedule details, start/end date
2. The engine tracks `last_generated` — the last date it created a transaction for this template
3. Runs daily at 02:00 via cron (see above) + on first request after startup via middleware. Also manually triggerable via `generate_pending_recurring` MCP tool.
4. Generated transactions link back to their template via `recurring_id`
5. Generated transactions are normal transactions — editable, deletable, recategorizable independently
6. Deactivating a template stops future generation but doesn't touch already-generated transactions

**MCP management:** The AI assistant can create/modify/pause/resume recurring templates. Example: "I'm canceling my Netflix" → `update_recurring(id, is_active: false)`.

## MCP Integration Details

The MCP server runs inside Next.js as a **stateless** Streamable HTTP endpoint at `/api/mcp`. Each POST request creates a fresh `McpServer` + transport instance, registers tools, handles the request, and tears down. No session state between requests.

**Key decisions:**
- **Stateless mode:** `sessionIdGenerator: undefined` — no `Mcp-Session-Id` headers, no SSE resumption. This is the simplest model and fits Next.js route handlers perfectly. The AI assistant makes independent tool calls; there is no multi-turn MCP session state to preserve.
- **JSON responses:** `enableJsonResponse: true` — returns plain JSON instead of SSE. Simpler to debug, no streaming needed for our tool calls.
- **Request/Response compatibility:** Uses `WebStandardStreamableHTTPServerTransport` which works natively with Next.js App Router's Web `Request`/`Response`.
- **Tool registration:** Factor tool registration into a shared `registerTools(server)` function so the per-request server setup is minimal.
- **Server instructions:** The `McpServer` `instructions` field advertises the companion REST endpoint for receipt image uploads. This is how unknown AI clients discover that binary uploads go through REST, not MCP. Tool descriptions on `create_transactions` reference `receipt_id` and point to the instructions for the upload flow.

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
      "Then pass receipt_id to create_transactions to link line items to the receipt.",
      "All monetary amounts are integers in cents (e.g. 1210 = €12.10).",
    ].join(" "),
  });
  registerTools(server);
  const transport = new WebStandardStreamableHTTPServerTransport({
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
- **Net worth card + sparkline:** Total net worth with 6-month mini area chart
- **Top movers:** Assets with biggest P&L change this month
- **Allocation mini-donut:** Portfolio allocation at a glance

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

### Assets (`/assets`)
- **Summary cards:** Total net worth, total invested, total P&L (absolute + %), cash balance
- **Performance table:** Sortable columns — name, type, holdings, cost basis, current value, P&L, annualized return
- **Allocation donut chart** + **currency exposure bar**
- **Asset detail** (`/assets/[id]`): value-over-time chart with buy/sell markers, lot history table, price history chart, P&L breakdown

### Cash Flow (`/reports/cash-flow`)
Date range picker, spending by category, trends, merchant breakdown, budget vs actual, income vs expenses. (`/reports` redirects here.)

### Portfolio (`/reports/portfolio`)
Net worth over time, allocation breakdown, performance ranking, realized vs unrealized P&L, transfer flow.

*Assets, Cash Flow, and Portfolio are grouped under a "Wealth" section in the sidebar as flat navigation items.*

### Settings (`/settings`)
- Timezone selector (required on first run — onboarding gate redirects here)
- API key management for financial data providers

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
- MCP `create_transactions` then accepts `receipt_id` to link line items to the uploaded receipt.

**Discovery:** AI clients learn about this REST endpoint via the MCP server's `instructions` field (see MCP Integration Details). Any MCP-compatible agent that reads server instructions on connect will know the upload flow. Tool descriptions on `create_transactions` also reference `receipt_id`.

### From an AI client (e.g., via Telegram)

1. User sends receipt photo to the AI assistant via Telegram
2. AI uses vision model to extract: merchant name, date, line items (description + amount per item), total
3. AI uploads the image via `POST /api/receipts/upload` (multipart) → gets `{ receipt_id }`
4. AI calls MCP `create_transactions` with line items + `receipt_id`
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
src/
├── instrumentation.ts           # Next.js hook — starts cron jobs on server boot
├── app/                         # Pages: /, /transactions, /categories, /reports
│   │                            #   (cash-flow + portfolio), /budgets, /recurring,
│   │                            #   /assets, /settings, /api-docs
│   └── api/                     # REST routes per domain + /api/mcp (MCP endpoint)
│       └── mcp/route.ts         #   + /api/openapi (spec endpoint)
├── components/                  # Per-domain dirs (budgets/, categories/, assets/,
│   │                            #   portfolio/, dashboard/, …)
│   └── ui/                      #   + shadcn/ui primitives
├── lib/
│   ├── api/                     # Route helpers (parseBody, errorResponse), service
│   │                            #   factory functions, OpenAPI spec
│   ├── db/                      # Drizzle schema, connection singleton, seed
│   ├── services/                # One service per domain — single source of truth
│   ├── providers/               # Financial data providers (ECB, Frankfurter,
│   │                            #   CoinGecko, Alpha Vantage, Open Exchange Rates)
│   ├── mcp/                     # MCP server init + tools/ (one file per domain)
│   ├── validators/              # Zod schemas shared by API, MCP, and forms
│   ├── utils/                   # Currency formatting
│   ├── date-ranges.ts           # All date/time utilities (timezone-aware)
│   └── cron.ts                  # Recurring (02:00) + backup (03:00) + market prices (04:00)
├── test/                        # All tests — not colocated with source
│   ├── helpers.ts               # makeTestDb() shared helper
│   ├── unit/                    # Service + utility tests
│   └── integration/             # API route + MCP protocol tests
│       ├── api/
│       └── mcp/
e2e/                             # E2E tests (Playwright) + MCP test prompts
data/                            # Runtime (gitignored): pinch.db, backups/, receipts/
drizzle/                         # Generated migrations
```

## Development Sprints

Each sprint is a self-contained chunk of work that results in something testable. Sprints are designed to be completable in a single AI agent session with human review between sprints.

Sprints are organized into two phases: **MVP** and **Full App**.

**Completed sprints (1-21):** Project scaffolding, database schema, validators, service layer (transactions, categories, reports, budgets, recurring), API routes, MCP server, scheduled tasks, app shell + dashboard, transactions page, common MCP read operations, categories page, budgets page, recurring page, reports page, receipts flow, financial data service (exchange rates + market prices), assets & net worth tracking (transfer type, asset lots, price snapshots, portfolio), portfolio reports backend (asset–market price linking via symbolMap, unified price resolver, portfolio report services — net worth history, asset performance, allocation, currency exposure, realized P&L, asset history), portfolio reports UI (reports sidebar with Cash Flow / Portfolio sub-pages, portfolio reports page, enhanced assets page with summary cards and charts, asset detail enhancements, dashboard net worth sparkline / top movers / allocation donut, onboarding tools and interactive tutorial).

---

### Sprint 22: Polish & Hardening
**Goal:** Production readiness.

- [x] Dark mode (Tailwind dark variant) - just change the existing design, no need for multi-theme support. Make it fancy. Consider color schemes, design language, etc.
- [ ] Mobile-responsive audit and fixes
   - transactions table is too wide
   - better positioning for the menu button on mobile
- [ ] CSV export for any filtered view
- [ ] Error boundaries and loading states across all pages
- [ ] Symbol search - limit by type, stream results
- [ ] Add more financial data providers - ExchangeRate-API, Twelve Data, Finnhub, CoinMarketCap
- [x] E2E tests (Playwright — browser UI flows, async server component rendering)
- [ ] Performance: check query efficiency, add missing indices if needed
- [x] Floating "Clear sample data" bar (shows only when populated with seed/sample data) + MCP tool to let users easily reset and start using the app. Detect sample data by a setting value (e.g. `sample_data = "true"`) that the seed script writes to the `settings` table on insert. The clear action deletes all seeded data and removes the setting (probably best by dropping the entire DB - maybe check backup.ts for potentially related code).
- [ ] **MCP amount format:** Convert all `amount` fields in MCP input/output from cents to decimals (e.g. `13.28` instead of `1328`). Conversion happens in the MCP presentation layer only — service layer stays in cents. Same as what the UI already does. Improves AI usability significantly. We also have to delete "all amounts are in cents" from the MCP instructions.

**Done when:** App is polished, responsive, handles errors gracefully, ready for daily use.

---

### Sprint 23: Packaging & Auto-Updates
**Goal:** Make Pinch trivial to deploy and maintain for anyone (human or AI agent).

- [ ] Provide simple, robust packaging (e.g., Docker container or single install script)
- [ ] Build an auto-updater mechanism for easy rolling releases

---

### Sprint 25: Documentation & Project Files
**Goal:** Make this a proper public open-source project.

- [ ] README.md — project overview, feature list, screenshots/demo, tech stack, quick start guide, usage instructions
- [ ] LICENSE file (choose an appropriate open-source license)
- [ ] CONTRIBUTING.md — dev setup, how to run tests, coding standards, PR workflow
- [ ] API documentation — REST endpoints and MCP tools (in README or `docs/`)
- [ ] Extend MCP `instructions` field: Add explicit behavioral prompts (e.g., "If unsure about categorization, ask the user and remember the decision for next time").
- [ ] Verify .gitignore, .env.example, and any other dotfiles are in order

**Done when:** A developer can clone the repo, read the README, and get running. Project looks professional on GitHub.

---

### Sprint 26: Project Website
**Goal:** Create a public face for the project.

- [ ] Build a standalone project website (e.g., hosted on GitHub Pages) to serve as the main landing page and documentation hub
- [ ] Write definitive Quick Start installation instructions hosted on the website, specifically formatted for an AI agent (so a user can just drop the URL to their agent to deploy Pinch)
- [ ] Donation button / MCP instructions ("if user is saving lots of money...")

### Sprint 27: Multi-Currency UX
**Goal:** Make foreign-currency assets a first-class experience — surface currency info during search, auto-fill on creation, and separate FX effects in reports.

- [ ] **Currency selector dropdown** - search + dropdown (similar to the Symbol Search widget), Intl API for currency symbols, currency-codes NPM package for codes, most popular (USD, EUR, GBP, JPY, CAD, AUD) on top, then divider, then the rest of the codes, alphabetically
- [ ] **Symbol search: surface currency** — return base currency (e.g. USD for SPX, USD for AAPL) from financial data providers in search results, display it in the symbol search UI
- [ ] **Asset creation: auto-fill currency** — when a symbol search result is selected, pre-fill the asset's currency field from the result's base currency instead of defaulting to EUR
- [ ] **Buy/sell dialog: show native + base currency** — display both the asset's native currency amount and the EUR equivalent side-by-side
- [ ] **Reports: separate FX vs asset P&L** — in asset performance reports, break down total P&L into asset price change and FX gain/loss components
- [ ] **Configurable base currency** — extract the hardcoded `"EUR"` from throughout the application into a user setting. After we're done, we shouldn't have "EUR" or "toEuros" and similar anywhere in the code, maybe except for sample data (seed script) and tests
- [ ] **Currency exposure chart** — add a dashboard widget showing portfolio allocation by currency with current FX rates

**Done when:** A user can add a USD-denominated asset (e.g. SPX) and clearly see what currency it's in at every step — search, creation, transactions, and reports. FX effects are visible separately from asset performance.

---

### Sprint 28: UI Translations (i18n)
**Goal:** Make Pinch translatable with full translator context — translators should understand what each string means and where it appears, not just see a flat key-value file.

**Library:** next-intl (purpose-built for Next.js App Router, native server/client component support, ICU message format built-in, PO extraction with source file references and descriptions).

**Phase 1 — Infrastructure**
- [ ] **Install & configure next-intl** — `next-intl` package, Next.js plugin, `getRequestConfig`, `NextIntlClientProvider` in root layout. English as default locale, locale detection from browser `Accept-Language` header with user override in settings.
- [ ] **Namespace structure** — split messages by domain (matching service layer): `common`, `navigation`, `transactions`, `categories`, `budgets`, `recurring`, `portfolio`, `reports`, `settings`, `onboarding`. Nested keys encode UI location (e.g. `table.columns.amount`, `form.amount.placeholder`, `filters.dateRange`).
- [ ] **Key naming convention** — document in CLAUDE.md: keys must encode their UI context via the path. `{namespace}.{section}.{element}.{variant}` pattern. Examples: `Transactions.table.columns.amount` (column header), `Transactions.form.amount.label` (form label), `Transactions.form.amount.placeholder` (input placeholder).
- [ ] **Extraction pipeline** — configure next-intl extraction to output `.po` files with source file references and inline descriptions. Add `npm run i18n:extract` script.
- [ ] **Locale switcher** — add a language selector to the settings page. Store preferred locale in the `settings` table (key: `locale`). Default to browser locale, fall back to `en`.
- [ ] **Locale routing** — configure Next.js middleware for locale-aware routing (`/en/transactions`, `/bg/transactions`). Persist user's locale choice across sessions.

**Phase 2 — Migrate existing strings**
- [ ] **Common namespace** — extract shared strings: button labels (Save, Cancel, Delete, Edit), status words (Loading, Error, Empty), confirmation dialogs, toast messages.
- [ ] **Navigation namespace** — sidebar items, page titles, breadcrumbs.
- [ ] **Transactions namespace** — table headers, form labels/placeholders, filter labels, empty states, action menus.
- [ ] **Categories namespace** — tree view labels, form, merge dialog, stats.
- [ ] **Budgets namespace** — budget cards, form, progress labels, status text.
- [ ] **Recurring namespace** — template list, form, generation status.
- [ ] **Portfolio namespace** — asset cards, lot table, performance metrics, buy/sell dialogs.
- [ ] **Reports namespace** — chart titles, legends, summary labels, date range presets.
- [ ] **Settings namespace** — section headers, field labels, API key form, timezone selector.
- [ ] **Onboarding namespace** — tutorial steps, wizard prompts, sample data notice.

**Phase 3 — Translator experience**
- [ ] **Inline descriptions for ambiguous strings** — audit all extracted strings. For any string where the meaning isn't clear from the key path alone (e.g. "Balance", "Note", "Right", "Net"), add descriptions via `t({ message: '...', description: '...' })`.
- [ ] **ICU plurals & formatting** — convert plural constructs (e.g. "3 transactions", "1 item") to ICU `{count, plural, ...}` syntax. Use ICU `{amount, number}` for formatted numbers where applicable.
- [ ] **Crowdin setup** — register Pinch on Crowdin (free OSS plan). Configure Crowdin CLI for CI push/pull. Upload `.po` files. Tag screenshots for key pages (dashboard, transactions, budgets, portfolio, settings).
- [ ] **Bulgarian translation** — add `bg.json` as the first non-English locale. Translate all namespaces.
- [ ] **Contributing guide for translators** — add a section to CONTRIBUTING.md explaining how to contribute translations via Crowdin, what context is available (key paths, descriptions, screenshots), and how to request new languages.

**Done when:** All user-visible strings are extracted and translatable. A translator on Crowdin can see key paths, descriptions, and screenshots for context. The app renders in English and Bulgarian, switchable from settings. Adding a new language requires only translation files — no code changes.

---

## Future Considerations (not in scope now, but design should accommodate)

- **CSV/OFX import:** Bank statement import. Service layer already structured for batch inserts. Add a parser + import UI/MCP tool when needed.
- **Multi-currency transactions:** Assets already support per-asset currencies (Sprint 17). For full multi-currency, add a `currency` field to transactions and an exchange rate table. All reporting converts to EUR base.
- **Attachments:** Beyond receipts — invoices, contracts. Generalize receipt storage to a generic attachments table.
- **App-level auth:** Session-based or token-based auth for shared access or public exposure. Keep auth concerns in middleware/route guards so this can be slotted in cleanly.
- **Shared access:** Multiple users or shared household access. Auth is a prerequisite.
