# E2E Tests (Playwright) — Implementation Plan

## Context

Sprint 22 includes adding E2E tests for browser UI flows. The app currently has Vitest unit + integration tests but no Playwright setup. E2E tests should cover realistic user workflows — from first-time onboarding through daily finance tracking — ensuring the full stack (UI → API → SQLite) works end-to-end.

## 1. Installation & Configuration

### Dependencies
```bash
npm install -D @playwright/test cross-env
npx playwright install chromium
```

Only Chromium initially — single-user app, cross-browser adds little value now.

### `playwright.config.ts` (project root)
- `baseURL`: `http://localhost:4001` (avoids conflict with dev server on 4000)
- `testDir`: `e2e/ui`
- `webServer`: starts Next.js with test DB via `cross-env DATABASE_URL=./data/test-e2e.db next dev -p 4001`
- Two projects with dependency ordering:
  - `onboarding` — runs first on fresh DB
  - `main` — depends on `onboarding`, assumes timezone set + tutorial disabled
- `use.trace: 'on-first-retry'`

### npm scripts
```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

## 2. Database Strategy

**Separate DB file, UI-driven seeding.**

- `DATABASE_URL=./data/test-e2e.db` isolates E2E from production data
- `getDb()` auto-runs migrations on first call — no separate migration step needed (`src/lib/db/index.ts`)
- `DB_PATH` is read at module load time (line 11), so setting the env var before `next dev` starts is sufficient

### Global setup (`e2e/ui/global-setup.ts`)
1. Delete `./data/test-e2e.db` if it exists (fresh start every run)
2. Playwright's `webServer` starts Next.js, which auto-creates DB + runs migrations on first request

### Global teardown (`e2e/ui/global-teardown.ts`)
1. Delete `./data/test-e2e.db`

### Per-suite data
- All data is created through the UI, the same way a real user would — no API-based seeding
- Suites run serially (shared DB), and each builds on data created by previous suites or creates its own via UI actions
- The `onboarding` suite runs first on a pristine DB (no timezone, no tutorial setting)
- The onboarding tests themselves set timezone and skip the tutorial as part of their actions — no explicit `afterAll` needed. The DB is naturally in the right state for `main` suites.
- If `onboarding` fails, `main` won't run (Playwright project dependency) — this is correct behavior, not a problem to work around

## 3. Tutorial & Onboarding Handling

**All done through the UI — no API shortcuts.**

- `onboarding.spec.ts` tests the full first-time flow on a fresh DB: set timezone via the settings page UI, walk through or skip the tutorial via Joyride buttons
- `main` suites don't need to handle timezone/tutorial — the DB already has them configured from the onboarding tests (Playwright project dependency guarantees ordering)
- The `InteractiveTour` component reads `initialTutorial` from server-rendered layout props, so after the onboarding suite skips/completes the tour, subsequent page loads won't show it

## 4. File Structure

```
e2e/
├── mcp/                          # Existing (unchanged)
├── ui/
│   ├── plan.md                   # This file
│   ├── global-setup.ts           # Delete old test DB
│   ├── global-teardown.ts        # Clean up test DB
│   ├── fixtures.ts               # Custom Playwright fixtures (if needed)
│   ├── helpers.ts                # Reusable UI action helpers (create via UI, navigate, assert)
│   ├── onboarding.spec.ts        # Suite 1: First-time setup + tutorial
│   ├── transactions.spec.ts      # Suite 2: Transaction CRUD + filters
│   ├── categories.spec.ts        # Suite 3: Category management
│   ├── budgets.spec.ts           # Suite 4: Budget workflow
│   ├── recurring.spec.ts         # Suite 5: Recurring transactions
│   ├── assets.spec.ts            # Suite 6: Portfolio & assets
│   ├── reports.spec.ts           # Suite 7: Report pages
│   └── navigation.spec.ts        # Suite 8: Sidebar nav + responsiveness
playwright.config.ts
```

## 5. Test Helpers (`e2e/ui/helpers.ts`)

UI action helpers that encapsulate common multi-step flows (used by tests that need data as a precondition, not as the thing being tested):

```ts
// Navigation
navigateTo(page, route)                          // Click sidebar link, wait for page load

// Data creation via UI
createCategoryViaUI(page, { name, parent?, icon?, color? })
createTransactionViaUI(page, { amount, type, description, category?, date? })
createBudgetViaUI(page, { category, amount })
createRecurringViaUI(page, { description, amount, frequency, category? })
createAssetViaUI(page, { name, type, currency? })

// Assertions
expectToastMessage(page, text)                   // Verify success/error toast
expectTableRowCount(page, count)                 // Verify visible rows
```

These are thin wrappers over real UI interactions (fill form, click submit, wait for response) — not API calls.

## 6. Custom Fixtures (`e2e/ui/fixtures.ts`)

Extend Playwright's `test` — kept minimal since data is created through the UI, not injected:
- No API fixtures or seeded data fixtures
- May add page-object-style fixtures later if tests get verbose

## 7. Test Suites

### Suite 1: Onboarding (`onboarding.spec.ts`) — runs on fresh DB
| Test | What it verifies |
|------|-----------------|
| Redirects `/` → `/settings` when no timezone | Timezone gate works |
| Settings page shows timezone selector | First-run UI renders |
| Setting timezone unlocks the app | Can navigate to `/` after saving |
| Tutorial overlay appears after setup | Joyride starts when `tutorial=true` |
| Tutorial can be skipped | Skip button works, setting updated |
| Tutorial walks through all steps | Navigation between pages via tour steps |

### Suite 2: Transactions (`transactions.spec.ts`)
| Test | What it verifies |
|------|-----------------|
| Add expense transaction | Form → table, amount formatting |
| Add income transaction | Type toggle, income styling |
| Edit a transaction | Inline edit, amount update |
| Delete a transaction | Confirmation dialog, removal |
| Filter by date range | Date picker, filtered results |
| Filter by category | Dropdown filter |
| Filter by type (income/expense) | Type toggle filter |
| Search by description text | Text search |
| Transaction appears on dashboard | Cross-page data consistency |

### Suite 3: Categories (`categories.spec.ts`)
| Test | What it verifies |
|------|-----------------|
| Create parent category | Form, tree view |
| Create child category | Hierarchy nesting |
| Edit category (rename) | Update in tree |
| Category shows transaction count | Stats badge |
| Delete category | Removal, transactions become uncategorized |
| Merge two categories | Source deleted, transactions moved |

### Suite 4: Budgets (`budgets.spec.ts`)
| Test | What it verifies |
|------|-----------------|
| Create budget for a category | Form, row appears |
| Progress reflects spending | Bar % matches seeded transactions |
| Over-budget warning styling | Visual indicator (red/warning) |
| Navigate between months | Month arrows, data changes |
| Dashboard budget alerts | Cross-page: over-budget shows on `/` |

### Suite 5: Recurring (`recurring.spec.ts`)
| Test | What it verifies |
|------|-----------------|
| Create monthly recurring | Form, list entry |
| Toggle active/inactive | Visual state change |
| Edit recurring details | Amount update |
| Delete recurring | Confirmation, removal |

### Suite 6: Assets (`assets.spec.ts`)
| Test | What it verifies |
|------|-----------------|
| Create deposit asset | Form, appears in list |
| Deposit money | Balance updates |
| Create investment asset | Different type |
| Record buy transaction | Lot appears, portfolio updates |
| Dashboard net worth | Cross-page: net worth card shows value |

### Suite 7: Reports (`reports.spec.ts`)
| Test | What it verifies |
|------|-----------------|
| Cash flow report loads | Page renders, charts present |
| Date range selector | Content updates on range change |
| Portfolio report loads | Net worth chart renders |
| Allocation breakdown | Section renders with data |

### Suite 8: Navigation (`navigation.spec.ts`)
| Test | What it verifies |
|------|-----------------|
| Sidebar links navigate correctly | All 9 nav items → correct URLs |
| Sidebar collapse/expand | Width changes on toggle |
| Mobile viewport layout | Sidebar hidden, content full-width |
| Mobile sidebar opens as overlay | Hamburger menu works |

## 8. Implementation Order

1. Install deps, create `playwright.config.ts`
2. `global-setup.ts` + `global-teardown.ts`
3. `helpers.ts` (UI action helpers)
4. `onboarding.spec.ts` — validates setup pipeline works, leaves DB ready for other suites
5. `navigation.spec.ts` — simple, validates all pages load
6. `transactions.spec.ts` — core CRUD (creates categories via UI as precondition)
7. `categories.spec.ts`
8. `budgets.spec.ts` (creates category + transactions via UI first)
9. `recurring.spec.ts`
10. `assets.spec.ts`
11. `reports.spec.ts` (relies on data created by earlier suites)

## 9. Verification

- `npx playwright test` — all suites pass
- `npx playwright test --ui` — visual debugging works
- Confirm test DB is created at `./data/test-e2e.db` during run and cleaned up after
- Confirm no interference with `./data/pinch.db`
- Run `npx tsc --noEmit`, `npm run check`, `npm test` — no regressions

## Key Files to Modify/Create

| File | Action |
|------|--------|
| `package.json` | Add deps + scripts |
| `playwright.config.ts` | Create |
| `e2e/ui/global-setup.ts` | Create |
| `e2e/ui/global-teardown.ts` | Create |
| `e2e/ui/helpers.ts` | Create |
| `e2e/ui/fixtures.ts` | Create |
| `e2e/ui/*.spec.ts` (8 files) | Create |
| `.gitignore` | Add Playwright artifacts (`test-results/`, `playwright-report/`) |
