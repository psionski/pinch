# 🪙 Pinch

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
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts (via shadcn/ui) |
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

# (Optional) Seed with sample data (recommended for new users)
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
| `npm run db:seed` | Seed database with 3 months of realistic sample data |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm run check` | Lint + format check (ESLint + Prettier) |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format:fix` | Auto-format all files |
| `npm test` | Run tests |

## MCP Integration

Pinch exposes an MCP endpoint at `/api/mcp`. The transport is [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http) (stateless).

**MCP endpoint:** `http://<host>:4000/api/mcp`

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "pinch": {
      "url": "http://localhost:4000/api/mcp"
    }
  }
}
```

#### Other MCP clients

Use transport type `streamable-http` pointing at `http://<host>:4000/api/mcp`. Tool schemas and the receipt upload flow are advertised by the server on connect.

## REST API

The full REST API is documented with Swagger UI at `http://<host>:4000/api-docs`. The raw OpenAPI spec (JSON) is available at `http://<host>:4000/api/openapi`.

## Access & Security

Pinch is designed for self-hosted, single-user use. The recommended setup is to run it behind [Tailscale](https://tailscale.com/) — no additional auth layer is required, as Tailscale provides mutual WireGuard authentication at the network level.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
