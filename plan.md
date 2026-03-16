# Pinch — Personal Finance Tracker

*AI-powered personal finance app. Track spending, scan receipts, manage budgets — with an MCP interface for AI-driven data entry and analysis.*

## Overview

Web dashboard (Next.js) for viewing and analyzing spending. MCP server embedded in the app for AI interaction: receipt scanning, categorization, batch operations, ad-hoc SQL queries. Single-user, self-hosted on VPS, accessed via Tailscale.

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 15 (App Router) | Full-stack: React frontend + API routes + MCP endpoint |
| Language | TypeScript (strict) | End-to-end type safety |
| Styling | Tailwind CSS 4 | Utility-first, fast iteration |
| UI Components | shadcn/ui | Accessible, composable, Tailwind-native |
| Charts | Tremor | Dashboard primitives built on Recharts + Tailwind |
| Database | SQLite (via better-sqlite3) | Single file, zero infra, perfect for personal use |
| ORM | Drizzle ORM | Type-safe, SQL-like query builder, great SQLite support |
| Migrations | Drizzle Kit | Schema-driven, generates SQL migrations |
| Validation | Zod | Shared schemas for API, MCP tools, and forms |
| MCP | @modelcontextprotocol/sdk | Streamable HTTP transport, mounted inside Next.js |

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

Key: API routes and MCP tools call the **same service layer**. No logic duplication. The UI calls API routes; Snippy calls MCP tools. Both hit the same services → same DB.

## Access & Security

**Tailscale-only access.** No auth layer in the app itself.

- App binds to `0.0.0.0:<port>` but is only reachable via Tailscale network
- Works on all devices: desktop browser, iOS (Tailscale app), Android
- Optional safety net: middleware that verifies requests come from the Tailscale interface (`100.x.x.x` source IP)
- MCP endpoint is also Tailscale-only — Snippy accesses it via the VPS Tailscale IP
- Zero passwords, zero tokens, zero session management

**Why this over app-level auth:** Single user, personal VPS. Building login flows, password resets, session handling is pure waste. Tailscale gives us mutual WireGuard authentication at the network level — stronger than any password form.

## Database Schema

### Tables

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
  amount REAL NOT NULL,          -- always positive; type field distinguishes income/expense
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
  total REAL,                    -- receipt total (for validation against sum of items)
  image_path TEXT,               -- path to stored receipt image
  raw_text TEXT,                 -- OCR/vision extracted text
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Budgets (per category per month)
CREATE TABLE budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL,           -- YYYY-MM format
  amount REAL NOT NULL,
  UNIQUE(category_id, month)
);

-- Recurring Transactions (templates for auto-generated transactions)
CREATE TABLE recurring_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
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
```

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
| `add_transactions` | Batch add (for receipts — array of items + shared receipt metadata: merchant, date, total, image_path) |
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

## Recurring Transaction Engine

**How it works:**

1. Each recurring template defines: amount, description, category, frequency (daily/weekly/monthly/yearly), schedule details, start/end date
2. The engine tracks `last_generated` — the last date it created a transaction for this template
3. On app startup + once daily (via Next.js cron or middleware check): scan all active templates, generate any missing transactions between `last_generated` and today
4. Generated transactions link back to their template via `recurring_id`
5. Generated transactions are normal transactions — editable, deletable, recategorizable independently
6. Deactivating a template stops future generation but doesn't touch already-generated transactions

**MCP management:** Snippy can create/modify/pause/resume recurring templates. Example: "I'm canceling my Netflix" → `update_recurring(id, is_active: false)`.

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

1. User sends photo to Snippy via Telegram
2. Snippy uses vision model to extract: merchant name, date, line items (description + amount per item), total
3. Snippy calls MCP `add_transactions` with:
   - Array of items (each becomes a transaction)
   - Receipt metadata: merchant, date, total, image stored to `data/receipts/`
4. Receipt record created in `receipts` table with `image_path` and `raw_text`
5. Each transaction linked via `receipt_id`
6. Snippy confirms: "Added 7 items from Kaufland (€43.20) — categorized as Groceries"
7. In the web UI: receipt icon on transactions → click to see full receipt, all items, original image

**Category assignment:** Snippy uses merchant name + item descriptions to assign categories. If a merchant is seen before, reuse the previous category. If ambiguous, ask. Over time, category assignment gets smarter via accumulated history.

## Currency

All amounts in **EUR (€)**. Single-currency app. No exchange rate logic needed.

## Data Storage

- **Database:** `src/data/pinch.db` (SQLite, gitignored)
- **Receipt images:** `data/receipts/YYYY-MM/receipt-{id}.{ext}` (organized by month, gitignored)
- **Backups:** Periodic SQLite backup via `.backup` command (can be automated via cron)

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
│   │       │   └── route.ts     # MCP Streamable HTTP endpoint
│   │       ├── transactions/
│   │       │   └── route.ts
│   │       ├── categories/
│   │       │   └── route.ts
│   │       ├── reports/
│   │       │   └── route.ts
│   │       ├── budgets/
│   │       │   └── route.ts
│   │       └── recurring/
│   │           └── route.ts
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── charts/              # Tremor chart wrappers
│   │   ├── transactions/        # Transaction list, form, filters
│   │   ├── categories/          # Category tree, merge dialog
│   │   ├── budgets/             # Budget progress bars, form
│   │   └── layout/              # Sidebar, header, breadcrumbs
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts         # DB connection singleton + PRAGMAs
│   │   │   ├── schema.ts        # Drizzle table definitions
│   │   │   └── seed.ts          # Default categories + sample data (dev)
│   │   ├── services/
│   │   │   ├── transactions.ts  # CRUD + batch + filtered queries
│   │   │   ├── categories.ts    # CRUD + merge + recategorize
│   │   │   ├── reports.ts       # Aggregations, trends, comparisons
│   │   │   ├── budgets.ts       # Set/get/compare
│   │   │   └── recurring.ts     # Template CRUD + generation engine
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
│   │   │   ├── transactions.ts
│   │   │   ├── categories.ts
│   │   │   ├── budgets.ts
│   │   │   └── recurring.ts
│   │   └── utils/
│   │       ├── dates.ts         # Date helpers (month ranges, formatting)
│   │       └── currency.ts      # EUR formatting
│   └── data/                    # Runtime data (gitignored)
│       ├── pinch.db             # SQLite database
│       └── receipts/            # Receipt images organized by YYYY-MM/
├── drizzle/                     # Generated migrations
└── public/
    └── favicon.ico
```

## Development Phases

### Phase 1: Foundation
- [ ] Initialize Next.js 15 + Tailwind 4 + shadcn/ui
- [ ] Set up Drizzle + SQLite schema + initial migration
- [ ] Implement service layer: transactions CRUD, categories CRUD
- [ ] API routes for transactions + categories
- [ ] MCP server with core tools: add/list/update/delete transactions, manage categories
- [ ] Seed script with default categories (Groceries, Rent, Utilities, Transport, Entertainment, Dining, Health, Shopping, Subscriptions, Income, Other)
- [ ] Tailscale access verification middleware

### Phase 2: Dashboard & Core UI
- [ ] App shell: sidebar navigation, responsive layout
- [ ] Dashboard: KPI cards, spending trend (Tremor AreaChart), category donut chart, recent transactions
- [ ] Transactions page: list with sorting, filter bar, inline edit, add form
- [ ] Categories page: tree view, CRUD, merge UI

### Phase 3: MCP Intelligence + Receipts
- [ ] Full MCP tools: reporting, recategorize, merge, query escape hatch
- [ ] Receipt flow: add_transactions with receipt metadata + image storage
- [ ] Receipt display in transaction list (icon + detail view)
- [ ] Category auto-assignment logic (merchant history)

### Phase 4: Budgets & Recurring
- [ ] Budget service + MCP tools + API routes
- [ ] Budget UI: set budgets, progress bars, copy from previous month
- [ ] Recurring transaction engine (generation on startup + daily)
- [ ] Recurring MCP tools + UI page
- [ ] Budget alerts on dashboard
- [ ] Upcoming recurring widget on dashboard

### Phase 5: Reports & Polish
- [ ] Reports page: date range picker, category bars, trends, merchant breakdown, budget vs actual
- [ ] Income vs expenses summary
- [ ] Dark mode (Tailwind dark variant)
- [ ] Mobile-responsive layout (Tailscale works on iOS)
- [ ] Export: CSV download for any filtered view
- [ ] SQLite backup automation

## Future Considerations (not in scope now, but architecture supports)

- **CSV/OFX import:** Bank statement import. Service layer already structured for batch inserts. Add a parser + import UI/MCP tool when needed.
- **Multi-currency:** Add `currency` field to transactions, exchange rate table. All reporting converts to EUR base. Only build if actually needed.
- **Attachments:** Beyond receipts — invoices, contracts. Generalize receipt storage to a generic attachments table.
- **Shared access:** If Tsveti needs access, Tailscale sharing or simple PIN auth. Current architecture doesn't preclude it.
