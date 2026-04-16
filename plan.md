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
        Browser                          AI Assistant
           │                                  │
┌──────────┼──────────────────────────────────┼───────┐
│          ▼            Next.js App           ▼       │
│                                                     │
│  ┌───────────────┐                    ┌───────────┐ │
│  │   React UI    │                    │    MCP    │ │
│  │ Server│Client │                    │ /api/mcp  │ │
│  └──┬────┘──┬────┘                    └─────┬─────┘ │
│     │       │                               │       │
│     │  ┌────▼────────┐                      │       │
│     │  │  API Routes │                      │       │
│     │  │  /api/*     │                      │       │
│     │  └────┬────────┘                      │       │
│     │       │                               │       │
│     ▼       ▼                               ▼       │
│  ┌──────────────────────────────────────────────┐   │
│  │            Service Layer (shared)            │   │
│  │  Transactions, Categories, Reports, Budgets, │   │
│  │  Recurring, Receipts, Assets, Portfolio,     │   │
│  │  FinancialData, Settings                     │   │
│  └────────────────────┬─────────────────────────┘   │
│                       ▼                             │
│  ┌──────────────────────────────────────────────┐   │
│  │           Drizzle ORM + SQLite               │   │
│  │           (better-sqlite3)                   │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Three entry points to the service layer:**
- **Server Components** call services directly during SSR (initial page data)
- **Client Components** call API routes (`/api/*`), which call services
- **AI assistants** call the MCP endpoint (`/api/mcp`), which calls services

No logic duplication — all paths converge on the same services → same DB.

## Access & Security

**Phase 1: Tailscale-only access.** No auth layer in the app initially.

- App binds to `0.0.0.0:<port>` but is only reachable via Tailscale network
- Works on all devices: desktop browser, iOS (Tailscale app), Android
- Optional safety net: middleware that verifies requests come from the Tailscale interface (`100.x.x.x` source IP)
- MCP endpoint is localhost-only — the AI assistant runs on the same host

**Why Tailscale-first:** Single user, personal VPS. Tailscale gives us mutual WireGuard authentication at the network level — good enough to start without building login flows.

**Future: app-level auth.** Keep auth concerns isolated (middleware/route guards), so we can slot in session-based or token-based auth when needed. **Note:** Once auth is added and pages call `cookies()`/`headers()`, Next.js will automatically treat them as dynamic — at that point, remove the `export const dynamic = "force-dynamic"` lines from page files.

## Database Schema

Schema defined in `src/lib/db/schema.ts` (Drizzle ORM). Migrations in `drizzle/`.

### Key design decisions

- **Money as plain decimals** (`real` columns, JS `number`). IEEE 754 doubles give ~15 significant digits — sufficient for any currency or exchange rate. `Math.round(x * 100) / 100` at service boundaries handles sub-cent float noise.
- **Hierarchical categories** via `parent_id` self-reference.
- **Soft-delete on budgets** (`deleted` flag) for inheritance — a deleted budget means "revert to default" for that month, not "no budget."
- **Receipts** group transactions from a single purchase. A receipt can span multiple categories.
- **Recurring templates** define schedule + template fields; generated transactions are normal, independently editable rows linked via `recurring_id`.
- **Settings** as a key-value store (timezone, API keys, preferences).
- **Unified price cache** (`market_prices`): exchange rates stored as prices (e.g., symbol='USD', currency='EUR', price=0.92 means 1 USD = 0.92 EUR).
- **Assets + lots model**: `assets` for metadata, `asset_lots` for buy/sell/deposit/withdrawal events (positive qty = buy, negative = sell), `asset_prices` for user-recorded or auto-fetched valuations.
- **FTS5** virtual table for full-text search on transaction descriptions, merchants, and notes. Kept in sync via triggers (see migrations).

**Price resolution order** (in `src/lib/services/price-resolver.ts`): user-recorded `asset_prices` → provider data in `market_prices` (via `symbolMap`) → lot cost basis → deposit identity (EUR deposits = €1.00).

**`updated_at` management:** No triggers — services are the single mutation path and set `updated_at` explicitly on every UPDATE.

**SQLite PRAGMAs** (set on every connection in `src/lib/db/index.ts`): WAL mode, foreign keys ON, 64MB cache, 5s busy timeout.

## MCP Tools (67 tools)

Tool definitions live in `src/lib/mcp/tools/` (one file per domain), plus `get_started` in `src/lib/mcp/register.ts`. See each file for exact schemas and descriptions.

### Getting Started (1 tool)
`get_started` — returns instructions, conventions, and onboarding flow. AI clients should call this first.

### Transactions (8 tools)
`create_transaction`, `create_transactions` (batch, with optional `receipt_id`), `get_transaction`, `list_transactions` (filter/paginate/search), `update_transaction`, `batch_update_transactions`, `delete_transaction`, `list_tags`

### Categories (7 tools)
`list_categories`, `get_category`, `create_category`, `update_category`, `delete_category`, `recategorize_transactions`, `merge_categories`

### Budgets (4 tools)
`set_budget`, `get_budget_status`, `delete_budget`, `reset_budgets`

### Recurring Transactions (6 tools)
`create_recurring`, `get_recurring`, `list_recurring`, `update_recurring`, `delete_recurring`, `generate_pending_recurring`

### Receipts (4 tools)
`get_receipt`, `list_receipts`, `list_unprocessed_receipts`, `delete_receipt`

### Reporting (6 tools)
`get_spending_summary`, `get_category_stats`, `get_trends`, `get_top_merchants`, `get_net_income`, `get_cash_balance`

### Portfolio Reports (6 tools)
`get_net_worth_history`, `get_asset_performance`, `get_allocation`, `get_currency_exposure`, `get_realized_pnl`, `get_asset_history`

### Assets (10 tools)
`create_asset`, `list_assets`, `get_asset`, `update_asset`, `delete_asset`, `buy_asset`, `sell_asset`, `record_price`, `get_portfolio`, `list_lots`

### Financial Data (5 tools)
`convert_currency`, `get_price`, `search_symbol`, `list_providers`, `set_api_key`

### Backups (3 tools)
`create_backup`, `list_backups`, `restore_backup`

### Onboarding (2 tools)
`set_opening_cash_balance`, `add_opening_asset`

### Settings (2 tools)
`get_timezone`, `set_timezone`

### Sample Data (1 tool)
`clear_sample_data`

### Escape Hatch (2 tools)
`get_db_schema`, `query` (read-only SQL)

## Scheduled Tasks & Recurring Transaction Engine

Three cron jobs run in-process via `node-cron`, started from `src/instrumentation.ts` → `src/lib/cron.ts`:

| Time | Job | Details |
|------|-----|---------|
| 02:00 | Recurring transaction generation | Creates pending transactions from active templates up to today |
| 03:00 | SQLite backup | `.backup` to `data/backups/`, keeps last 7 daily |
| 04:00 | Market price auto-fetch | For each asset with a `symbolMap`, fetches today's price from the linked provider |

**Why in-process cron:** Pinch is self-hosted (long-lived Node.js process, not serverless). `instrumentation.ts` runs exactly once on server start — perfect for scheduling. A `globalThis` singleton guard prevents duplicate jobs from dev-mode hot-reload.

**Recurring engine behavior:**
1. Templates define amount, description, category, frequency, schedule details, start/end date
2. Engine tracks `last_generated` per template
3. Runs daily via cron + on first request after startup via middleware + manually via `generate_pending_recurring` MCP tool
4. Generated transactions are normal rows linked via `recurring_id` — independently editable/deletable
5. Deactivating a template stops future generation but doesn't touch existing transactions

## MCP Integration Details

The MCP server runs inside Next.js as a **stateless** Streamable HTTP endpoint at `/api/mcp` (see `src/app/api/mcp/route.ts`).

**Key decisions:**
- **Stateless mode:** `sessionIdGenerator: undefined` — no session headers, no SSE resumption. Each POST creates a fresh server, handles the request, tears down. Fits Next.js route handlers perfectly.
- **JSON responses:** `enableJsonResponse: true` — plain JSON, no streaming needed for tool calls.
- **Server instructions:** The `McpServer` `instructions` field advertises the companion REST endpoint for receipt uploads. This is how AI clients discover that binary uploads go through REST, not MCP.

## Web UI Pages

### Dashboard (`/`)
- **KPI cards:** Total spend this month, vs last month (delta + percentage), top category, budget utilization percentage
- **Spending trend:** Area chart, last 6 months
- **Category breakdown:** Donut chart, current month
- **Recent transactions:** Last 10-20 entries with category badges
- **Budget alerts:** Categories approaching (>80%) or over budget
- **Upcoming recurring:** Next 5 recurring transactions due
- **Net worth card + sparkline:** Total net worth with 6-month mini area chart
- **Top movers:** Assets with biggest P&L change this month
- **Allocation mini-donut:** Portfolio allocation at a glance

### Transactions (`/transactions`)
Full transaction list with sortable columns, filter bar (date range, category, amount range, text search, type toggle), inline edit, bulk select, receipt/recurring indicator badges.

### Categories (`/categories`)
Tree view showing hierarchy, per-category spend + transaction count + budget status, CRUD, merge UI, click-through to filtered transactions.

### Assets (`/assets`)
Summary cards (net worth, invested, P&L, cash balance), performance table, allocation donut + currency exposure bar. Asset detail (`/assets/[id]`): value-over-time chart, lot history, price history, P&L breakdown.

### Cash Flow (`/reports/cash-flow`)
Date range picker, spending by category, trends, merchant breakdown, budget vs actual, income vs expenses. (`/reports` redirects here.)

### Portfolio (`/reports/portfolio`)
Net worth over time, allocation breakdown, performance ranking, realized vs unrealized P&L, transfer flow.

*Sidebar groups: **Track** (Transactions, Assets, Recurring), **Plan** (Categories, Budgets), **Reports** (Cash Flow, Portfolio).*

### Settings (`/settings`)
Timezone selector (required on first run — onboarding gate), API key management for financial data providers.

### Budgets (`/budgets`)
Monthly budgets per category, visual progress bars (green/yellow/red), copy from previous month, historical adherence chart.

### Recurring (`/recurring`)
Template list with description, amount, frequency, next occurrence, status. Create/edit form, toggle active/inactive, view generated transactions.

## Receipt Flow

Receipt images are binary — MCP tools accept only JSON. So uploads go through a **companion REST endpoint**:

1. `POST /api/receipts/upload` — multipart/form-data. Saves image to `data/receipts/YYYY-MM/`, creates DB row, returns `{ receipt_id }`.
2. MCP `create_transactions` accepts `receipt_id` to link line items.
3. `GET /api/receipts/[id]/image` — streams the image with correct `Content-Type`.

**AI workflow:** User sends receipt photo → AI extracts items via vision → uploads image via REST → calls `create_transactions` with line items + `receipt_id`. Each item categorized independently.

**Discovery:** AI clients learn about the REST endpoint via MCP server `instructions` field.

## API Conventions

### Error response contract

All API routes and MCP tools return a consistent error shape with `error` (message), `code` (`VALIDATION_ERROR | NOT_FOUND | CONFLICT | INTERNAL_ERROR`), and optional `details`. See `src/lib/api/helpers.ts` for the `errorResponse` helper.

### Pagination contract

All list endpoints: `limit` (default 50, max 200) + `offset` (default 0). Response envelope: `{ data, total, limit, offset, hasMore }`. Shared Zod schema in `src/lib/validators/common.ts`.

### Tags

Stored as JSON text arrays on transactions and recurring templates. Filter via `json_each()` in SQLite (OR logic). Dedicated `list_tags` tool for autocomplete. No separate tags table — intentionally simple.

## Currency

Pinch is **multi-currency**. Each instance picks an immutable **base currency** at onboarding (any ISO 4217 code, default EUR). All reports, budgets, cash balance, and net worth are denominated in the base. Transactions store both their native amount/currency and a denormalized `amount_base` computed at write time via the configured FX provider chain (Frankfurter → fawazahmed0). The base currency cannot be changed after setup — migrating between bases requires a fresh database. See the *Currency Conventions* section in `CLAUDE.md` for service-layer details.

## Data Storage

- **Database:** `data/pinch.db` (SQLite, gitignored)
- **Receipt images:** `data/receipts/YYYY-MM/receipt-{id}.{ext}` (gitignored)
- **Backups:** `data/backups/pinch-YYYY-MM-DD.db` (daily, last 7 kept)

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
│   ├── api/                     # Route helpers, service factories, OpenAPI spec
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

Each sprint is a self-contained chunk of work. Sprints are organized into two phases: **MVP** and **Full App**.

**Completed sprints (1-22):** Project scaffolding, database schema, validators, service layer (transactions, categories, reports, budgets, recurring), API routes, MCP server, scheduled tasks, app shell + dashboard, transactions page, common MCP read operations, categories page, budgets page, recurring page, reports page, receipts flow, financial data service (exchange rates + market prices), assets & net worth tracking (transfer type, asset lots, price snapshots, portfolio), portfolio reports backend (asset–market price linking via symbolMap, unified price resolver, portfolio report services — net worth history, asset performance, allocation, currency exposure, realized P&L, asset history), portfolio reports UI (reports sidebar with Cash Flow / Portfolio sub-pages, portfolio reports page, enhanced assets page with summary cards and charts, asset detail enhancements, dashboard net worth sparkline / top movers / allocation donut, onboarding tools and interactive tutorial), polish & hardening (dark mode, mobile-responsive fixes, error boundaries, streaming symbol search, more financial data providers, E2E Playwright tests, performance tuning, sample data clear flow, decimal amounts refactor — integer cents → real columns end-to-end).

---

### Sprint 23: Packaging & Auto-Updates
**Goal:** Make Pinch trivial to deploy and maintain for anyone (human or AI agent).

- [ ] Provide simple, robust packaging (e.g., Docker container or single install script)
- [ ] Build an auto-updater mechanism for easy rolling releases

---

### Sprint 25: Documentation & Project Files
**Goal:** Make this a proper public open-source project.

- [x] README.md — project overview, feature list, screenshots/demo, tech stack, quick start guide, usage instructions
- [x] LICENSE file — AGPL-3.0-or-later
- [x] CONTRIBUTING.md — dev setup, how to run tests, coding standards, PR workflow
- [x] API documentation — REST endpoints (Swagger at `/api-docs`) and MCP tools (`get_started` tool) referenced in README
- [x] Extend MCP `instructions` field: Added behavioral prompts for categorization, budget alerts, recurring suggestions, data quality
- [x] Verify .gitignore, .env.example, and any other dotfiles are in order

**Done when:** A developer can clone the repo, read the README, and get running. Project looks professional on GitHub.

---

### Sprint 26: Project Website
**Goal:** Create a public face for the project.

- [ ] Build a standalone project website (e.g., hosted on GitHub Pages) to serve as the main landing page and documentation hub
- [ ] Write definitive Quick Start installation instructions hosted on the website, specifically formatted for an AI agent (so a user can just drop the URL to their agent to deploy Pinch)
- [ ] Donation button / MCP instructions ("if user is saving lots of money...")

### Sprint 27: Multi-Currency
**Goal:** Make foreign currencies a first-class experience across the whole app — assets, transactions, reports — with a base currency chosen at onboarding (and immutable thereafter), and FX effects visible separately from underlying performance.

**Architecture decisions (locked before starting):**
- **Base currency is immutable.** Set once during onboarding alongside timezone. Displayed grayed-out in settings with a tooltip. Eliminates the entire "what if base currency changes" recomputation problem — a configured Pinch instance is a "EUR database" or a "USD database" for life. Migrating between base currencies would require a fresh DB.
- **Denormalize base-currency amounts on write.** Each transaction stores `amount` (native), `currency`, and `amount_base` (computed at write time via the price resolver). Reports become O(N) sums with no FX joins. The trade-off — a rate must be available at create time, and corrected rates don't propagate without an opt-in refresh — is a clear win when the base never changes.
- **Drop the EUR pivot in `market_prices`.** Store FX rates against the configured base directly (`symbol='USD', currency=<base>`). The existing `FrankfurterProvider` already supports arbitrary `from`/`to`, no provider rewrite needed.

**Foundation**
- [x] **Base currency setting** — `SettingsService.getBaseCurrency()` / `setBaseCurrency()`. `setBaseCurrency()` throws if already set (immutable). Settings UI shows the current base grayed-out with an explainer tooltip.
- [x] **Onboarding gate** — generalized `requireTimezone()` → `requireOnboarding()` (timezone + base currency); all 9 page callers updated. New "base currency" step inserted between timezone and cash in the settings wizard. Added `get_base_currency` / `set_base_currency` MCP tools and updated `INSTRUCTIONS` accordingly.
- [x] **`CurrencySchema` Zod validator** — ISO 4217 with `Intl.supportedValuesOf` validation, lives in `src/lib/validators/common.ts`.
- [x] **Currency selector component** — `src/components/settings/currency-picker.tsx`, popular currencies pinned, rest alphabetical, search + symbol display via Intl.
- [x] **Per-currency formatting** — `formatCurrency(amount, currency?)` defaulting to cached base, plus `roundToCurrency(amount, currency?)` using `Intl.NumberFormat` precision. `BaseCurrencyInit` mirrors the cache to the client.

**Financial data providers**
- [x] **De-EUR-ize the price resolver** — `BASE_CURRENCY` constant removed, deposit identity now keyed off `getBaseCurrency()`.
- [x] **Frankfurter with arbitrary base** — Frankfurter provider already supports any `from`/`to`; the resolver call sites use the configured base. Triangulation direction unit test added in `providers.test.ts`.
- [x] **`fawazahmed0/exchange-api` provider** — `FawazahmedProvider` registered after Frankfurter as the second free fallback (no key, CC0).
- [x] **Currency support validation at write time** — `FinancialDataService.assertCurrencySupported()` + the `convertToBase()` failure path in `TransactionService.create` reject creates whose currency no provider can resolve.
- [x] **Historical FX backfill** — `FinancialDataService.backfillTransactionRates()` runs from the 04:00 cron, and `convertToBase()` populates rates on-demand at create time.

**Transactions**
- [x] **Schema migration** — `drizzle/0008_eager_blue_blade.sql` adds `currency` and `amount_base` to `transactions` (plus `currency` to `recurring_transactions`) and backfills both from existing rows + the configured base currency.
- [x] **Service layer** — `TransactionService.create/createBatch/update/updateBatch` are now async and compute `amount_base` via the injected `FinancialDataService`. Read paths expose `{ amount, currency, amountBase }` everywhere.
- [x] **Validators + MCP tools** — write schemas accept optional `currency`; response schemas include `currency`/`amountBase`; MCP tool descriptions updated. Aggregation responses still return base-currency totals (top-level `currency` field is a follow-up polish item).
- [x] **`convert_currency` MCP tool** — `symbolMap` argument removed; routes through the default FX chain.
- [x] **Transactions UI** — currency picker added to the create/edit form; the table shows the native amount and surfaces a tooltip with the base equivalent for foreign-currency rows.
- [x] **Recurring transactions** — `currency` field on templates and `RecurringService.generateForTemplate` recomputes `amount_base` per generation date via the FX provider chain.

**Budgets**
- [x] **Budgets are base-currency only** — documented in CLAUDE.md; no schema change.
- [x] **`BudgetService.getForMonth()`** — flows through `ReportService.getBudgetStats`, which now sums `amount_base`.

**Cash balance & portfolio**
- [x] **`reports.cashBalance()`** — sums `amount_base`.
- [x] **`portfolio.netWorth()`** — `cashBalance + totalAssetValue` is safe in the single-currency case since `cashBalance` is base. See the **Known gap** below for mixed-currency portfolios.
- [x] **🐛 Convert `currentValue` to base currency in `AssetService.attachMetrics`** — fixed via path (b), the denormalization route. Migration `0009_nosy_serpent_society.sql` adds `price_per_unit_base` to `asset_lots`, snapshotted at lot creation in `AssetLotService.buy/sell/createOpeningLot`. `attachMetrics` now returns both native and base versions of `costBasis`, `currentValue`, and `pnl`; the base side uses `findCachedFxRate` (a sync `market_prices` lookup wrapping the same 7-day cache window the financial-data service already exposes). `PortfolioService.getPortfolio` and `TopMovers` now sum the `*Base` fields, so `cashBalance + totalAssetValue` is unit-consistent. `createOpeningLot` becomes async to thread the FX call through.

**Reports**
- [x] **All aggregations sum `amount_base`** — `spendingSummary`, `getCategoryStats`, `trends`, `topMerchants`, `netIncome`, `cashBalance`, and the includeTransfers branch all read the denormalized column.
- [x] **Top-level `currency` field on aggregation responses** — `spendingSummary`, `getCategoryStats`, `trends`, `topMerchants`, `netIncome`, `cashBalance`, and `getBudgetStats` all return a `currency` field labelled with the configured base. Array-returning methods (`getCategoryStats`, `trends`, `topMerchants`) now return `{ items|points|merchants, currency }`; callers updated end-to-end. New Zod wrappers `CategoryStatsResultSchema`, `TrendsResultSchema`, `TopMerchantsResultSchema` in `src/lib/validators/reports.ts`.
- [x] **Asset performance: separate FX vs price P&L** — `PortfolioReportService.getAssetPerformance()` now returns `costBasisBase`, `currentValueBase`, `pnlBase`, `pricePnlBase`, and `fxPnlBase`, sourced from the new per-lot `pricePerUnitBase` snapshot and a current-day FX lookup via `findCachedFxRate`. For base-currency assets `fxPnlBase = 0` and the existing display is unchanged; for foreign assets the table shows an "FX Effect" column with the breakdown in the cell tooltip.

**Assets**
- [x] **Symbol search: surface currency in results** — `SymbolSearchResult` got an optional `currency` field; populated by `alpha-vantage` (`8. currency`), `twelve-data` (`currency`), and all FX providers (`frankfurter`, `fawazahmed`, `ecb`, `open-exchange-rates`, `exchangerate-api`) where the symbol *is* the currency. Surfaced as a muted label in the symbol search dropdown next to each result. Finnhub and CoinGecko don't expose currency in their search responses, so they're left blank.
- [x] **Asset creation: auto-fill currency from symbol search** — `SymbolSearch` accepts an optional `onCurrencyHint` callback fired the first time the user picks a result. The asset form pre-fills the currency field but only when the user hasn't typed in it yet (`currencyDirty` guard), so cross-listed instruments like SHEL on LSE vs NYSE remain editable.
- [x] **Buy/sell dialog: show native + base side-by-side** — when `asset.currency !== baseCurrency`, the dialog calls `/api/financial/convert` whenever quantity/price/date changes and renders `Total ($1,000) / ≈ €920` plus the rate underneath. Cleared when the asset is base-currency or inputs are blank, so there's no flicker on the single-currency happy path.

**Sample data, tests, docs**
- [x] **Sample data** — seed and `makeTestDb()` populate `base_currency = "EUR"` so existing tests work unchanged. `makeTestDb({ baseCurrency, seedBaseCurrency })` for currency-aware tests.
- [x] **Test infrastructure** — `format.test.ts` covers per-currency precision (JPY 0, BHD 3); `providers.test.ts` covers Frankfurter triangulation direction; transaction/asset-lot tests use a mock FX provider chain to exercise foreign-currency `amount_base` computation.
- [x] **Sample data: seed one foreign-currency transaction** — `src/lib/db/seed/index.ts` now inserts a £4.50 "Airport coffee in London" tagged `travel`/`coffee` in the most recent month, with the GBP→EUR rate pre-cached in `market_prices` so the seed never hits the network.
- [x] **Multi-currency integration test** — `src/test/integration/multi-currency.test.ts` exercises the create→read→aggregate path: a USD transaction stores `currency='USD'` + `amountBase = amount × rate`; `getCategoryStats` rolls up the converted amount and labels the response with the base currency. A second test creates a USD asset and asserts `currentValueBase`, `costBasisBase`, and the FX/price P&L decomposition.
- [x] **OpenAPI spec** — transaction/recurring create/update bodies were already schema-driven and inherit the `currency` field automatically. The wrapped report response schemas (`CategoryStatsResultSchema`, `TrendsResultSchema`, `TopMerchantsResultSchema`) replace the bare arrays in `src/lib/api/openapi/reports.ts`, and `src/lib/api/openapi/settings.ts` adds `GET/PUT /api/settings/base-currency`.
- [x] **Docs** — `CLAUDE.md` Currency Conventions section rewritten; `plan.md` Currency section updated; MCP `INSTRUCTIONS` mention base currency in the onboarding flow.

**Done when:** A user can record a USD coffee purchase or add a USD-denominated asset and clearly see both native and base amounts at every step. All aggregations (transactions, budgets, cash balance, reports) roll up to the immutable base currency. FX effects are visible separately from underlying performance. Adding a transaction in a currency no configured provider can resolve fails with a clear error. The base currency cannot be changed after onboarding.

**Gotchas (resolved during the sprint — kept for context):**
1. ✓ **Migration backfill assumes existing rows are in the configured base.** `0008_eager_blue_blade.sql` reads the `base_currency` setting (falling back to `'EUR'`) and sets every existing row's `currency` to that, with `amount_base = amount`. Correct for any user who's been single-currency so far. Users who logged non-base cash flows against multi-currency assets pre-migration should review and correct manually — surfaced in the migration comment.
2. ✓ **`BASE_CURRENCY = "EUR"` was load-bearing in `price-resolver.ts`.** Replaced with `getBaseCurrency()`; deposit identity is now base-currency-driven.
3. ✓ **Frankfurter triangulation direction.** Unit test in `providers.test.ts` asserts the URL passes `from=USD&to=GBP` directly without pivoting through EUR.
4. ✓ **EUR/RUB suspended at ECB since 2022.** `FawazahmedProvider` registered as the second link in the default FX chain. If both fail, the create fails with a clear "currency not supported" error from `assertCurrencySupported()`.
5. ✓ **`market_prices` `(symbol, currency, date)` uniqueness.** No re-keying needed: existing EUR-base users keep their old rows; new bases write new rows. Verified.
6. ✓ **JPY/BHD decimals.** `roundToCurrency(amount, currency?)` in `src/lib/format.ts` uses `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`. Tests cover JPY (0), EUR/USD (2), BHD (3).

**Gotchas still relevant for follow-up work:**
1. **First write of a new currency blocks on a network call.** Frankfurter lookup happens synchronously inside `TransactionService.create`. Acceptable for now (background backfill via the 04:00 cron means subsequent writes are cached) but the create form should show a loading state when a non-base currency is selected.
2. **Stocks listed on multiple exchanges.** SHEL is GBP on LSE *and* USD on NYSE; many ADRs have the same property. The deferred "auto-fill currency from symbol search" item must pre-fill the field but **not lock it**.
3. Formatted currency amounts are getting clipped in charts.

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

- **CSV export:** Export any filtered transaction view as CSV.
- **CSV/OFX import:** Bank statement import. Service layer already structured for batch inserts. Add a parser + import UI/MCP tool when needed.
- **Attachments:** Beyond receipts — invoices, contracts. Generalize receipt storage to a generic attachments table.
- **App-level auth:** Session-based or token-based auth for shared access or public exposure. Keep auth concerns in middleware/route guards so this can be slotted in cleanly.
- **Shared access:** Multiple users or shared household access. Auth is a prerequisite.
