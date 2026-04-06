# Contributing to Pinch

## Getting Started

```bash
git clone https://github.com/psionski/pinch.git
cd pinch
npm install
cp .env.example .env
npm run dev
```

The dev server starts on [http://localhost:4000](http://localhost:4000) with hot-reload.

## Project Structure

```
src/
├── app/              # Next.js pages + API routes + MCP endpoint
├── components/       # React components (per-domain dirs + ui/)
├── lib/
│   ├── services/     # Business logic (one service per domain)
│   ├── validators/   # Zod schemas (shared by API, MCP, forms)
│   ├── mcp/          # MCP server + tool definitions
│   ├── api/          # Route helpers, service factories, OpenAPI spec
│   ├── db/           # Drizzle schema, connection, seed
│   └── providers/    # Financial data providers
├── test/             # All tests (NOT colocated with source)
e2e/                  # Playwright E2E tests
drizzle/              # Generated migrations
```

## Key Principles

- **Service layer is the single source of truth.** API routes and MCP tools are thin wrappers — validate input, call service, format output.
- **Zod schemas** are the source of truth for validation. TypeScript types are inferred from them via `z.infer<>`.
- **No logic duplication.** If two entry points need the same operation, it lives in the service layer.
- **TypeScript strict mode.** No `any` types.

## Database

Schema lives in `src/lib/db/schema.ts`. All changes go through Drizzle Kit migrations:

```bash
# After editing schema.ts:
npm run db:generate   # Generate migration SQL
npm run db:migrate    # Apply it
```

Never modify the database manually. Use `npm run db:studio` to browse data.

## Tests

Tests live in `src/test/` — never colocated with source files.

```bash
npm test              # Unit + integration tests (Vitest)
npm run test:e2e      # Browser E2E tests (Playwright)
```

- **Naming:** `{domain}.service.test.ts` for service tests, `{domain}.api.test.ts` for API route tests
- **DB:** Use `makeTestDb()` from `src/test/helpers.ts` for in-memory SQLite. No mocks for the database.
- **Focus:** Test the service layer — that's where the business logic lives.

## Code Quality

Before submitting, both must pass with zero errors:

```bash
npm run check         # Typecheck (tsc) + lint (ESLint) + format (Prettier)
npm test              # Unit + integration tests
```

## Style

- **Files:** kebab-case (e.g. `asset-service.ts`). Components are PascalCase (e.g. `BudgetCard.tsx`).
- **Imports:** Use `@/` path alias for `src/`.
- **Exports:** Named exports, not default.
- **Line length:** Keep files under ~400 lines. Split if longer.
- **Comments:** Only when the "why" isn't obvious from the code.

## Adding Features

When adding a new feature, you'll typically touch:

1. **Service** (`src/lib/services/`) — business logic
2. **Validator** (`src/lib/validators/`) — Zod schemas for input/output
3. **API route** (`src/app/api/`) — REST endpoint (thin wrapper around service)
4. **MCP tool** (`src/lib/mcp/tools/`) — tool definition (thin wrapper around service)
5. **OpenAPI spec** (`src/lib/api/openapi.ts`) — document the REST endpoint
6. **Tests** (`src/test/`) — service layer tests at minimum
7. **UI** (`src/components/`, `src/app/`) — if user-facing

## Pull Requests

- One focused change per PR.
- Descriptive title, brief summary of what and why.
- All checks must pass (typecheck, lint, format, tests).
- Screenshots for UI changes.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0](LICENSE).
