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

### Date/Time Conventions

The app has a single **user-configured timezone** stored in the `settings` table (key `"timezone"`, IANA identifier like `"Europe/Amsterdam"`). This timezone is the source of truth for what "today" and "this month" mean.

**Storage:**
- Calendar dates are stored as `YYYY-MM-DD` strings — civil dates, not UTC dates.
- Timestamps (`createdAt`, `updatedAt`, `recordedAt`) are stored as ISO 8601 UTC (e.g. `2026-03-21T14:30:00.000Z`). SQLite `datetime('now')` defaults produce UTC.

**Boundaries — convert at the edges:**
- **Input:** When computing "today" or "current month", use `isoToday()` / `getCurrentMonth()` from `src/lib/date-ranges.ts` — these use the app timezone internally. When accepting timestamps from API/MCP input, use `localToUtc()` to convert to UTC before storage.
- **Output:** Calendar dates (`YYYY-MM-DD`) are already civil dates and need no conversion. Timestamps are converted from UTC to local time via `utcToLocal()` in service parse functions, so all API/MCP consumers receive timestamps in the user's timezone.

**Temporal API** — all date/time code uses `@js-temporal/polyfill` (TC39 Stage 4 polyfill). Do **not** use the legacy `Date` object for date math, formatting, or timezone conversion. Use the appropriate Temporal type:
- `Temporal.PlainDate` — calendar dates (`YYYY-MM-DD`): parsing, arithmetic, comparisons, formatting.
- `Temporal.PlainYearMonth` — month-level operations: `daysInMonth`, month arithmetic, formatting.
- `Temporal.Instant` — exact moments in time (UTC): timestamp conversion, epoch math.
- `Temporal.ZonedDateTime` — intermediate type for UTC↔local conversion (via `toZonedDateTimeISO(tz)` / `toZonedDateTime(tz)`).
- `Temporal.Now` — current time: `Temporal.Now.plainDateISO(tz)` for today's date, `Temporal.Now.instant()` for current UTC instant.
- Legacy `Date` is acceptable only for epoch-millisecond arithmetic (e.g. cache TTL via `Date.now()`) where Temporal adds no value.

**Date utilities** (`src/lib/date-ranges.ts`):
- `utcToLocal()`, `localToUtc()` — timestamp conversion between UTC storage and user's timezone.
- `isoToday()`, `getCurrentMonth()`, `getCurrentMonthInfo()`, `computePresetRange()`, `windowToDateRange()` — all timezone-aware via cached setting.
- `offsetDate()`, `daysBetween()`, `generateDatePoints()`, `computeCompareRange()` — pure date math on `YYYY-MM-DD` strings, timezone-agnostic.
- `clearTimezoneCache()` — call after changing the timezone setting.
- Don't create local date helpers in other files. Use these shared utilities.

**Settings infrastructure:**
- `SettingsService.getTimezone()` returns `string | null` (`null` = not configured).
- `SettingsService.setTimezone(tz)` validates the IANA identifier and stores it.
- MCP tools: `get_timezone`, `set_timezone`.
- API: `GET/PUT /api/settings/timezone`.
- Onboarding gate: each page calls `requireTimezone()` from `src/lib/api/require-timezone.ts` — redirects to `/settings` if timezone is not configured. Server startup initializes the timezone via `instrumentation.ts`.

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
- **Regression tests:** When fixing a bug, optionally write a test that reproduces the bug first (or alongside the fix). The test should fail without the fix and pass with it.

### E2E Testing & Debugging

You can run `npm run dev` to start the dev server, then use the **Pinch MCP tools** to perform end-to-end testing against the running app (create transactions, check budgets, verify portfolio reports, etc.). This is the primary way to validate features and debug issues beyond unit tests.

- Start the server: `npm run dev`
- Use Pinch MCP tools to interact with the app (create data, query reports, verify behavior)
- Add temporary logging (`financialLogger.debug`, etc.) to trace issues — read the server output to see logs. It refreshes automatically when in `dev` mode.
- Clean up debug logging before committing - but only if you think the debug log message is unlikely to be needed again.

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
