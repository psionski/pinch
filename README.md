# Pinch

AI-powered personal finance tracker. Track spending, scan receipts, manage budgets — with an MCP interface for AI-driven data entry and analysis.

## Features

- **Dashboard** — KPI cards, spending trends, category breakdown, budget alerts, upcoming recurring transactions
- **Transactions** — Full CRUD with filtering, bulk operations, inline editing
- **Categories** — Hierarchical categories with icons, colors, merge/reparent support
- **Reports** — Spending by category, merchant breakdowns, budget vs actual, income vs expenses
- **Budgets** — Monthly budgets per category with visual progress tracking
- **Recurring transactions** — Templates for automatic transaction generation (subscriptions, salaries, etc.)
- **MCP server** — AI assistant can add transactions, scan receipts, run reports, manage budgets via [Model Context Protocol](https://modelcontextprotocol.io/)
- **Receipt scanning** — Upload receipt images; AI extracts and links line items automatically

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Charts | Tremor |
| Database | SQLite via better-sqlite3 |
| ORM | Drizzle ORM + Drizzle Kit |
| Validation | Zod |
| MCP | @modelcontextprotocol/sdk |

## Prerequisites

- Node.js 20+
- npm

## Setup

```bash
# Clone the repo
git clone https://github.com/psionski/pinch.git
cd pinch

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed

# Start the dev server
npm run dev
```

Open [http://localhost:4000](http://localhost:4000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 4000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Drizzle migrations from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm test` | Run tests |

## MCP Integration

Pinch exposes an MCP endpoint at `/api/mcp` for AI assistants. Connect any MCP-compatible client (e.g. Claude Desktop, [OpenClaw](https://github.com/openclaw/openclaw)) to this URL.

**Available MCP tools:**

- **Transactions:** `add_transaction`, `add_transactions`, `update_transaction`, `delete_transaction`, `list_transactions`
- **Categories:** `list_categories`, `create_category`, `update_category`, `recategorize`, `merge_categories`
- **Reporting:** `spending_summary`, `category_breakdown`, `trends`, `top_merchants`
- **Budgets:** `set_budget`, `get_budget_status`
- **Recurring:** `create_recurring`, `list_recurring`, `update_recurring`, `delete_recurring`, `generate_recurring`
- **Escape hatch:** `query` — read-only SQL for ad-hoc analysis

**Receipt upload flow:**
1. `POST /api/receipts/upload` — multipart/form-data with `image` field (+ optional `merchant`, `date`, `total`, `raw_text`)
2. Returns `{ receipt_id }`
3. Pass `receipt_id` to `add_transactions` to link line items to the receipt

All monetary amounts are integers in cents (e.g. `1210` = €12.10).

## Access & Security

Pinch is designed for self-hosted, single-user use. The recommended setup is to run it behind [Tailscale](https://tailscale.com/) — no additional auth layer is required, as Tailscale provides mutual WireGuard authentication at the network level.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
