# Pinch — Personal Finance Tracker

*AI-powered personal finance app. Track spending, scan receipts, manage budgets — with an MCP interface for AI-driven data entry and analysis.*

## Overview

Web dashboard (Next.js) for viewing and analyzing spending. MCP server embedded in the app for AI interaction: receipt scanning, categorization, batch operations, ad-hoc SQL queries.

## Actors

| Actor | What it is | How it interacts with Pinch |
|-------|-----------|----------------------------|
| **User** | The human (app owner). | Browses the web UI from any device. Sends receipts/commands to the AI assistant via Telegram. |
| **AI** | An AI assistant (e.g. built on [OpenClaw](https://github.com/openclaw/openclaw)) running on the same VPS as Pinch. | Connects to Pinch's MCP endpoint on localhost. Uses MCP tools to add transactions, scan receipts, query reports, manage categories/budgets — acts as the AI-powered data entry and analysis layer. |

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

**MCP management:** The AI assistant can create/modify/pause/resume recurring templates. Example: "I'm canceling my Netflix" → `update_recurring(id, is_active: false)`.

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

1. User sends photo to the AI assistant via Telegram
2. AI assistant uses vision model to extract: merchant name, date, line items (description + amount per item), total
3. AI assistant calls `add_transactions` with:
   - Array of items (each becomes a transaction with its own category)
   - Receipt metadata: merchant, date, total, image stored to `data/receipts/`
4. Receipt record created in `receipts` table with `image_path` and `raw_text`
5. Each transaction linked via `receipt_id` — a single receipt can span multiple categories (e.g. eggs → Groceries, cigarettes → Tobacco on the same Kaufland receipt)
6. AI assistant confirms: "Added 7 items from Kaufland (€43.20) — 5× Groceries, 1× Tobacco, 1× Household"
7. In the web UI: receipt icon on transactions → click to see full receipt, all items, original image

**Category assignment:** The AI assistant uses item descriptions (per line item) and merchant name to assign categories. Each item on a receipt is categorized independently. If a merchant/item pattern has been seen before, reuse the previous category. If ambiguous, ask. Over time, category assignment gets smarter via accumulated history.

## Currency

Default currency is **EUR (€)**. Start single-currency for simplicity, but keep the door open for multi-currency later — avoid hardcoding EUR assumptions deep in business logic. When multi-currency is needed, add a `currency` field to transactions and an exchange rate table.

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

## Development Sprints

Each sprint is a self-contained chunk of work that results in something testable. Sprints are designed to be completable in a single AI agent session with human review between sprints.

---

### Sprint 1: Project Scaffolding
**Goal:** Bootable Next.js app with tooling configured. Nothing custom yet — just the skeleton.

- [ ] Initialize Next.js 15 (App Router) with TypeScript strict mode
- [ ] Install and configure Tailwind CSS 4
- [ ] Initialize shadcn/ui, add a few base components (Button, Card, Input, Table)
- [ ] Set up path alias (`@/` → `src/`)
- [ ] Configure Vitest for testing
- [ ] Verify: `npm run dev` starts, `npm run build` passes, `npm test` runs

**Done when:** App boots to a blank page, all tooling works, tests run green.

---

### Sprint 2: Database & Schema
**Goal:** Drizzle ORM wired to SQLite, full schema defined, migrations running.

- [ ] Install Drizzle ORM + better-sqlite3 + Drizzle Kit
- [ ] Define all tables in `src/lib/db/schema.ts` (categories, transactions, receipts, budgets, recurring_transactions)
- [ ] Configure `drizzle.config.ts`
- [ ] DB connection singleton with PRAGMAs (`src/lib/db/index.ts`)
- [ ] Generate and run initial migration
- [ ] Seed script: default categories (Groceries, Rent, Utilities, Transport, Entertainment, Dining, Health, Shopping, Subscriptions, Income, Other)
- [ ] Tests: DB connects, schema creates tables, seed runs, basic insert/select works

**Done when:** `npm run db:migrate` creates the database, `npm run db:seed` populates categories, tests verify round-trip CRUD.

---

### Sprint 3: Zod Validators
**Goal:** Shared validation schemas that will be used by API routes, MCP tools, and forms.

- [ ] `src/lib/validators/transactions.ts` — create, update, list filters (date range, category, amount range, merchant, text search, pagination)
- [ ] `src/lib/validators/categories.ts` — create, update, recategorize filters, merge params
- [ ] `src/lib/validators/budgets.ts` — set budget, query params
- [ ] `src/lib/validators/recurring.ts` — create, update, generation params
- [ ] Export inferred TypeScript types from each schema
- [ ] Tests: valid inputs pass, invalid inputs fail with expected errors

**Done when:** All validators defined with full type inference, test coverage on edge cases.

---

### Sprint 4: Service Layer — Transactions & Categories
**Goal:** Core business logic for the two primary domains.

- [ ] `TransactionService`: create, createBatch, getById, list (with all filters + pagination), update, delete, deleteBatch
- [ ] `CategoryService`: create, getAll (with hierarchy), getById, update, delete, recategorize (bulk move), merge
- [ ] All services use Drizzle queries, accept validated types, return typed results
- [ ] Tests: full CRUD, filter combinations, batch operations, category merge reassigns transactions, recategorize works

**Done when:** Services fully tested against real SQLite. No API routes yet — just the logic layer.

---

### Sprint 5: Service Layer — Reports, Budgets, Recurring
**Goal:** Remaining services that build on top of transactions/categories.

- [ ] `ReportService`: spendingSummary (grouped by category/month/merchant, with period comparison), categoryBreakdown, trends (time series), topMerchants
- [ ] `BudgetService`: set, getForMonth (all categories with spend vs budget), copyFromPreviousMonth
- [ ] `RecurringService`: create, list (with next occurrence), update, delete, generatePending (create missing transactions up to a date)
- [ ] Tests: report aggregations return correct numbers, budget status calculates correctly, recurring generation creates expected transactions

**Done when:** All five services complete and tested. The entire backend logic works without any HTTP layer.

---

### Sprint 6: API Routes
**Goal:** REST API exposing all services via Next.js route handlers.

- [ ] `POST/GET /api/transactions` — create + list
- [ ] `GET/PATCH/DELETE /api/transactions/[id]` — single transaction ops
- [ ] `POST/GET /api/categories` — create + list
- [ ] `PATCH/DELETE /api/categories/[id]` — single category ops
- [ ] `POST /api/categories/recategorize` + `POST /api/categories/merge`
- [ ] `GET /api/reports/summary` + `/breakdown` + `/trends` + `/top-merchants`
- [ ] `POST/GET /api/budgets` — set + get status
- [ ] `POST/GET/PATCH/DELETE /api/recurring` — full CRUD + `POST /api/recurring/generate`
- [ ] All routes: validate with Zod, call service, return JSON. Consistent error shape.
- [ ] Integration tests: hit route handlers, verify responses

**Done when:** Full API working, tested end-to-end through route handlers.

---

### Sprint 7: MCP Server
**Goal:** MCP endpoint with all tools, calling the same service layer as API routes.

- [ ] MCP server setup with @modelcontextprotocol/sdk (`src/lib/mcp/server.ts`)
- [ ] Mount as Streamable HTTP endpoint at `/api/mcp`
- [ ] Transaction tools: add_transaction, add_transactions (batch), update_transaction, delete_transaction, list_transactions
- [ ] Category tools: list_categories, create_category, update_category, recategorize, merge_categories
- [ ] Report tools: spending_summary, category_breakdown, trends, top_merchants
- [ ] Budget tools: set_budget, get_budget_status
- [ ] Recurring tools: create_recurring, list_recurring, update_recurring, delete_recurring, generate_recurring
- [ ] Escape hatch: query (read-only SQL)
- [ ] Tests: tool registration works, tools call correct services

**Done when:** MCP endpoint responds to tool calls, all tools wired to services.

---

### Sprint 8: App Shell & Layout
**Goal:** Navigation, layout, and the structural UI — no data yet.

- [ ] Root layout with sidebar navigation (Dashboard, Transactions, Categories, Reports, Budgets, Recurring)
- [ ] Responsive: sidebar collapses on mobile
- [ ] Active route highlighting
- [ ] Breadcrumbs component
- [ ] Install and configure Tremor
- [ ] Empty state components for each page (placeholder content)

**Done when:** You can click through all pages, responsive layout works, looks clean.

---

### Sprint 9: Dashboard
**Goal:** Main dashboard with real data from API.

- [ ] KPI cards: total spend this month, delta vs last month (% change), top category, budget utilization
- [ ] Spending trend: Tremor AreaChart, last 6 months
- [ ] Category breakdown: donut chart, current month
- [ ] Recent transactions: last 10-20 entries with category badges
- [ ] Budget alerts: categories approaching (>80%) or over budget
- [ ] Upcoming recurring: next 5 due recurring transactions

**Done when:** Dashboard renders with real data, charts display correctly.

---

### Sprint 10: Transactions Page
**Goal:** Full transaction management UI.

- [ ] Transaction list with sortable columns (date, amount, category, merchant)
- [ ] Filter bar: date range picker, category dropdown, amount range, text search, type toggle (income/expense/all)
- [ ] Pagination
- [ ] Add transaction form (manual entry)
- [ ] Inline edit (click to modify)
- [ ] Bulk select → recategorize / delete
- [ ] Receipt indicator badge, recurring indicator badge

**Done when:** Can create, view, filter, edit, bulk-manage, and delete transactions through the UI.

---

### Sprint 11: Categories Page
**Goal:** Category management with hierarchy and merge.

- [ ] Tree view showing parent → children hierarchy
- [ ] Per-category stats: total spend (current month), transaction count, budget status
- [ ] Create / rename / reparent / change icon & color
- [ ] Merge UI: select source → target, preview affected transactions, confirm
- [ ] Click-through to filtered transaction list

**Done when:** Full category CRUD and merge working in the UI.

---

### Sprint 12: Budgets Page
**Goal:** Budget management and tracking UI.

- [ ] Set monthly budgets per category (form with amount input)
- [ ] Progress bars: green (<60%) → yellow (60-90%) → red (>90%)
- [ ] Copy budgets from previous month (one-click)
- [ ] Historical budget adherence chart

**Done when:** Can set, view, and track budgets. Visual feedback on spending vs budget.

---

### Sprint 13: Recurring Transactions Page
**Goal:** Recurring template management UI.

- [ ] List: description, amount, frequency, next occurrence, status (active/paused)
- [ ] Create/edit form: amount, description, merchant, category, frequency, schedule, start/end date
- [ ] Toggle active/inactive
- [ ] View generated transactions for a template

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
**Goal:** Receipt scanning support for MCP + display in UI.

- [ ] Receipt image storage (`data/receipts/YYYY-MM/receipt-{id}.{ext}`)
- [ ] `add_transactions` MCP tool: batch add with receipt metadata (merchant, date, total, image_path, raw_text)
- [ ] Receipt record creation in DB, linked to transactions via `receipt_id`
- [ ] UI: receipt icon on transactions → click to see full receipt, all items, original image

**Done when:** MCP can create receipts with linked transactions, UI displays receipt details.

---

### Sprint 16: Documentation & Project Files
**Goal:** Make this a proper public open-source project.

- [ ] README.md — project overview, feature list, screenshots/demo, tech stack, quick start guide, usage instructions
- [ ] LICENSE file (choose an appropriate open-source license)
- [ ] CONTRIBUTING.md — dev setup, how to run tests, coding standards, PR workflow
- [ ] API documentation — REST endpoints and MCP tools (in README or `docs/`)
- [ ] Verify .gitignore, .env.example, and any other dotfiles are in order

**Done when:** A developer can clone the repo, read the README, and get running. Project looks professional on GitHub.

---

### Sprint 17: Polish & Hardening
**Goal:** Production readiness.

- [ ] Dark mode (Tailwind dark variant)
- [ ] Mobile-responsive audit and fixes
- [ ] CSV export for any filtered view
- [ ] Tailscale access verification middleware
- [ ] SQLite backup script
- [ ] Error boundaries and loading states across all pages
- [ ] Performance: check query efficiency, add missing indices if needed

**Done when:** App is polished, responsive, handles errors gracefully, ready for daily use.

## Future Considerations (not in scope now, but design should accommodate)

- **CSV/OFX import:** Bank statement import. Service layer already structured for batch inserts. Add a parser + import UI/MCP tool when needed.
- **Multi-currency:** Add `currency` field to transactions, exchange rate table. All reporting converts to EUR base. Avoid hardcoding EUR assumptions in business logic so this is easy to add.
- **Attachments:** Beyond receipts — invoices, contracts. Generalize receipt storage to a generic attachments table.
- **App-level auth:** Session-based or token-based auth for shared access or public exposure. Keep auth concerns in middleware/route guards so this can be slotted in cleanly.
- **Shared access:** Multiple users or shared household access. Auth is a prerequisite.
