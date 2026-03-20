# CLAUDE.md — Project Instructions for Pinch

## Project Overview

Pinch is an AI-powered personal finance tracker. Web dashboard (Next.js 16) + MCP server for AI-driven data entry/analysis. Single-user (for now), self-hosted, SQLite-backed. Default currency EUR — avoid hardcoding currency assumptions deep in logic.

See `plan.md` for full architecture, schema, and roadmap.

## Tech Stack

- **Framework:** Next.js 16 (App Router) — full-stack React + API routes + MCP endpoint
- **Language:** TypeScript (strict mode) — end-to-end type safety
- **Styling:** Tailwind CSS 4 + shadcn/ui + Recharts (via shadcn/ui charts)
- **Database:** SQLite via better-sqlite3, Drizzle ORM, Drizzle Kit migrations
- **Validation:** Zod — shared schemas across API, MCP, and forms
- **MCP:** @modelcontextprotocol/sdk (Streamable HTTP transport)

## Documentation Lookup

**Always use Context7 MCP to look up library documentation before writing code that depends on a library.** Do not guess or rely on potentially outdated training data for API surfaces. This applies to all dependencies — Next.js, Drizzle, shadcn/ui, Recharts, Zod, MCP SDK, Tailwind, etc.

Workflow:

1. `resolve-library-id` to get the Context7-compatible library ID
2. `query-docs` with your specific question
3. Write code based on the actual current API

## Code Quality Standards

### TypeScript

- Strict mode is non-negotiable. No `any` types — use `unknown` and narrow, or define proper types.
- Prefer `interface` for object shapes, `type` for unions/intersections/utilities.
- All function signatures must have explicit return types for exported/public functions.
- Use Zod schemas as the single source of truth for validation, then infer TypeScript types from them (`z.infer<typeof schema>`).

### Architecture

- **Service layer is the single source of truth for business logic.** API routes and MCP tools are thin wrappers that validate input (Zod), call services, and format output. No business logic in routes or tool handlers.
- **No logic duplication.** If both an API route and an MCP tool need the same operation, it lives in the service layer.
- Keep modules focused and small. One service per domain (transactions, categories, reports, budgets, recurring).
- **Service instances:** Use factory functions from `src/lib/api/services.ts` (e.g. `getBudgetService()`). Don't construct services directly outside tests.
- Shared validators in `src/lib/validators/` — used by API routes, MCP tools, and frontend forms.
- **API route helpers:** Use `parseBody`, `parseSearchParams`, `isErrorResponse`, `errorResponse` from `src/lib/api/helpers.ts`. Don't write manual JSON parsing or error responses in routes.

### Database

- All schema changes go through Drizzle Kit migrations. Never modify the DB manually.
- Set SQLite PRAGMAs on every connection (WAL mode, foreign keys ON, etc. — see plan.md).
- Use Drizzle's query builder for type-safe queries. Raw SQL only for the `query` escape hatch MCP tool (read-only).

### Error Handling

- Validate at system boundaries (API input, MCP tool input, user-submitted forms). Trust internal code.
- Return structured error responses from API routes (consistent shape with `error` field).
- Don't over-catch. Let unexpected errors propagate to the framework's error handler.

### Components & UI

- Use shadcn/ui components as the base. Don't reinvent accessible primitives.
- Recharts (via shadcn/ui chart primitives) for charts and dashboard widgets.
- Components should be composable and focused. No god-components.
- Server Components by default; only use `"use client"` when you need interactivity or browser APIs.
- **Page pattern:** Server component fetches initial data via service layer, passes to a `"use client"` wrapper (e.g. `BudgetsClient`) as `initialData` props. Client component owns state, mutations, and dialogs.
- **Domain components** go in `src/components/{domain}/` (e.g. `src/components/budgets/`). Dashboard widgets go in `src/components/dashboard/`.

## Definition of Done

**Work is not complete until all three of these pass with zero errors:**

1. **Type check:** `npx tsc --noEmit`
2. **Lint + format:** `npm run check`
3. **Tests:** `npm test`

Run all three before considering any task finished. Do not move on if any fails.

Documentation and unit tests are part of the deliverable (read the relevant sections for details).

## Testing

- **All tests live in `src/test/`** — not colocated with source. Never create `__tests__/` directories next to source files.
- **Naming:** `{domain}.service.test.ts` for service tests, `{domain}.test.ts` for other tests.
- **DB helper:** Use `makeTestDb()` from `src/test/helpers.ts` for in-memory SQLite setup. Never create your own DB setup in tests.
- **Write tests for all service layer logic.** Services are the core of the app — they must be tested.
- **Test with a real SQLite database** (in-memory via `makeTestDb()`), not mocks. The ORM and DB behavior are part of what we're validating.
- Use Vitest as the test runner. Service tests use `// @vitest-environment node` at the top.
- Test the contract: given these inputs, expect these outputs/side effects. Don't test implementation details.
- API routes: test via integration tests that hit the route handlers with real requests.
- MCP tools: test via their service layer calls (tools are thin wrappers, so testing services covers the logic).

## Style & Conventions

- File naming: kebab-case for files, PascalCase for components.
- Imports: use `@/` path alias for `src/`.
- Prefer named exports over default exports.
- Keep files under ~300 lines. If longer, split into focused modules.
- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/) — e.g. `feat: add transaction service`, `fix: handle null category on delete`, `chore: update drizzle config`. Use imperative mood in the description.
- **Branching:** Gitflow — `main` is production, `develop` is the integration branch. Feature branches off `develop` (`feature/...`), release branches (`release/...`), hotfixes off `main` (`hotfix/...`).

## Documentation

This is intended to be a public open-source project. Maintain documentation accordingly:

- **README.md** — project overview, screenshots, features, setup/install instructions, usage guide, tech stack, contributing guidelines. Keep it up to date as features land.
- **plan.md** — the project plan and sprint tracker. The plan.md will give you context about this project. Read it and keep it up to date.
- **API docs** — document REST API endpoints (Swagger, from [openapi.ts](src\lib\api\openapi.ts)) and MCP tools (in their tool descriptions).
- **When adding a new API endpoint**, also: add it to OpenAPI spec (`src/lib/api/openapi.ts`), add a corresponding MCP tool if the AI should be able to call it (`src/lib/mcp/tools/`), and add/update validators (`src/lib/validators/`).
- Keep docs concise and practical. Don't write walls of text — developers should be able to get running in under 5 minutes.
- Update docs when adding or changing user-facing features. Don't let docs drift from reality.

## What NOT to Do

- Don't over-engineer for hypothetical futures. Build what's needed now.
- Don't add comments that restate what the code already says. Only comment non-obvious "why".
- Don't create wrapper abstractions for things used in one place.
