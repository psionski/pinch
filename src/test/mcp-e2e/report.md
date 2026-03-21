# MCP Tool UX Review

Six simulated AI agent workflows were run against the live Pinch MCP server. Each agent saw the tools for the first time and attempted a realistic end-to-end task, evaluating discoverability, description clarity, cross-tool guidance, and naming consistency. This document consolidates the findings.

## Workflows Tested

| # | Workflow | Tools Exercised |
|---|----------|----------------|
| 1 | Weekly expense entry (3 items) | `list_categories`, `create_transactions`, `delete_transaction` |
| 2 | Recurring bill setup (monthly + weekly) | `list_categories`, `create_recurring`, `list_recurring`, `generate_pending_recurring`, `delete_recurring` |
| 3 | Monthly budget check | `get_budget_status`, `get_category_stats`, `get_spending_summary`, `get_trends` |
| 4 | Investment purchase + portfolio review | `search_symbol`, `list_assets`, `create_asset`, `buy_asset`, `get_portfolio`, `get_allocation`, `get_asset_performance`, `delete_asset` |
| 5 | Foreign currency travel expenses | `convert_currency`, `list_categories`, `create_transactions`, `delete_transaction` |
| 6 | Category merge + recategorize | `list_categories`, `create_category`, `merge_categories`, `recategorize`, `batch_update_transactions` |

---

## Bugs Found

### BUG-1: Self-merge deletes category (Critical)
`merge_categories(sourceCategoryId=X, targetCategoryId=X)` returns `{"merged": true}` and **deletes the category**. All transactions in it lose their category. No validation prevents `source === target`.
- **Found in:** Workflow 6
- **Fix:** Add `.refine()` to `MergeCategoriesSchema` rejecting `sourceCategoryId === targetCategoryId`.

### BUG-2: Merging nonexistent source silently succeeds (High)
`merge_categories(sourceCategoryId=9999, targetCategoryId=9)` returns `{"merged": true}`. The `DELETE` on a nonexistent row is a no-op, so the transaction commits. An agent believes the merge happened.
- **Found in:** Workflow 6
- **Fix:** Verify both categories exist before running the merge transaction.

### BUG-3: Nonexistent target leaks raw SQLite error (High)
`merge_categories(sourceCategoryId=9, targetCategoryId=9999)` returns `FOREIGN KEY constraint failed` — an unhandled database error.
- **Found in:** Workflow 6
- **Fix:** Catch FK errors and return a descriptive message: "Target category 9999 not found."

### BUG-4: `delete_transaction` rejects single integer ID (Medium)
The description says "Pass a single id or an array of ids." Passing `id: 247` (integer) fails with a validation error. Only `id: [247]` (array) works.
- **Found in:** Workflows 4, 2
- **Fix:** Fix the validator/transport layer so the `anyOf: [integer, array]` union works correctly for single values.

### BUG-5: Data inconsistency between `get_portfolio` and `get_allocation` (High)
SPX shows `currentValue: 32000` in `get_portfolio` but `currentValue: 2000` in `get_allocation` and `get_asset_performance`. Allocation percentages differ between the tools. Net worth calculations are therefore unreliable depending on which tool is called.
- **Found in:** Workflow 4
- **Fix:** Ensure all portfolio tools use the same `currentValue` calculation.

### BUG-6: `record_price` references nonexistent tool `get_market_price` (Low)
Description says "Use get_market_price first to fetch the latest price" — but the actual tool is called `get_price`.
- **Found in:** Workflow 4
- **Fix:** Update description to reference `get_price`.

---

## Description & Naming Issues

### DESC-1: No cross-tool guidance for category lookup (Medium)
`create_transaction`, `create_transactions`, and `create_recurring` all accept `categoryId` but none mention `list_categories`. Compare with `create_asset` which explicitly says "first call search_symbol." An agent might skip categorization entirely.
- **Found in:** Workflows 1, 2
- **Suggestion:** Add "Use `list_categories` to find valid categoryId values" to transaction and recurring tool descriptions.

### DESC-2: Amount-in-cents not documented on `create_recurring` (High)
`create_transaction` says "Amounts are in cents (e.g. 1210 = €12.10)" in its own description. `create_recurring` does not — it relies solely on the server-level `INSTRUCTIONS`. Getting this wrong means amounts are off by 100x.
- **Found in:** Workflow 2
- **Suggestion:** Add the cents reminder to every tool that accepts an `amount` parameter.

### DESC-3: `convert_currency` amount description inconsistency (Medium)
The tool description says `"amount (cents, e.g. 1599 = $15.99)"` but the parameter schema says `"Amount in cents to convert (e.g. 1599 = €15.99)"`. Dollar sign vs euro sign. It should clarify: "Amount in cents of the **source** currency."
- **Found in:** Workflow 5

### DESC-4: `merchantPattern` matching semantics undocumented (High)
`recategorize` performs case-insensitive substring matching (`LIKE '%pattern%'`), but the description doesn't mention this. "Caf" matches "Cafe Central" AND "The Ivy Cafe". This is dangerous — an agent can't predict the blast radius.
- **Found in:** Workflow 6
- **Suggestion:** Document: "Case-insensitive substring match (e.g., 'Caf' matches 'Cafe Central' and 'The Ivy Cafe')."

### DESC-5: `startDate` semantics ambiguous on `create_recurring` (Medium)
Does `startDate` mean "when the subscription started in real life" or "date of first generated transaction"? Past dates cause backdated transactions on next cron run. Not documented.
- **Found in:** Workflow 2
- **Suggestion:** Add: "First occurrence date. Past dates will generate backdated transactions on next cron run."

### DESC-6: `search_symbol` fails silently for unconfigured providers (High)
Returns "No symbols found" with no mention that Alpha Vantage (stocks/ETFs) isn't configured. The agent hits a dead end with no actionable guidance. VWCE — the most popular European ETF — returns nothing.
- **Found in:** Workflow 4
- **Suggestion:** Include provider status context in "no results" errors: "No symbols found. Stock/ETF search requires Alpha Vantage (not configured). Active providers: coingecko."

### DESC-7: `merge_categories` response lacks counts (Medium)
Returns only `{"merged": true}`. Should include `transactionsMoved`, `budgetsTransferred`, `sourceCategoryName`, `targetCategoryName` so the agent can confirm the operation to the user.
- **Found in:** Workflow 6

### DESC-8: `description` vs `merchant` field semantics unclear (Low)
`create_transaction` has both fields but doesn't explain the distinction. Agents produce inconsistent data: some put "Coffee at Starbucks" in description, others put "Coffee" in description and "Starbucks" in merchant.
- **Found in:** Workflow 1
- **Suggestion:** Add brief guidance: `description` = "What was purchased", `merchant` = "Where it was purchased."

### DESC-9: Naming inconsistency between `merge_categories` and `recategorize` (Low)
`merge_categories` follows `verb_noun` pattern; `recategorize` is just a verb. For tools used together in a workflow, `recategorize_transactions` or `move_transactions` would be more consistent.
- **Found in:** Workflow 6

### DESC-10: No parameter descriptions on most fields (Low-Medium)
Most parameters across recurring and transaction tools have no `description` — just type constraints. `categoryId`, `merchant`, `tags`, `notes`, `endDate` all lack descriptions. Compare with `delete_transaction` where `id` has `"description": "Single transaction ID or array of IDs"`.
- **Found in:** Workflow 2

---

## Structural & Design Issues

### DESIGN-1: `recategorize` is globally destructive with no preview (High)
Moves ALL matching transactions across the entire database. No `dryRun` or `preview` parameter. During testing, it accidentally moved 3 real user transactions into a test category. The description says "Bulk-move" but doesn't warn about global scope.
- **Found in:** Workflow 6
- **Suggestion:** Add a `dryRun: boolean` parameter that returns the count/list of affected transactions without modifying them.

### DESIGN-2: Report tool overlap — `get_spending_summary` vs `get_category_stats` (Medium)
When grouped by category, these return nearly identical data. An agent can't tell which to use. The distinction (hierarchy rollups + UI metadata vs. flexible grouping + comparison periods) is buried.
- **Found in:** Workflow 3
- **Suggestion:** Clarify in descriptions. `get_spending_summary`: "Best for comparing periods or viewing by merchant." `get_category_stats`: "Best for per-category breakdowns with hierarchy and percentages."

### DESIGN-3: `get_budget_status` hides unbudgeted high-spend categories (Medium)
Only returns budgeted categories. If the user spends €750/month on rent with no budget, `get_budget_status` says nothing. An agent answering "am I overspending?" may give a misleadingly rosy answer.
- **Found in:** Workflow 3
- **Suggestion:** Add an optional `includeUnbudgeted` flag or summary field for total unbudgeted spending.

### DESIGN-4: No structured field for original foreign currency amounts (Medium)
Transactions have no `originalAmount`, `originalCurrency`, or `exchangeRate` fields. Agents must serialize this into `notes` as free text, making it unqueryable.
- **Found in:** Workflow 5
- **Suggestion:** Add optional `originalAmount`, `originalCurrency`, `exchangeRate` fields to the transaction schema.

### DESIGN-5: `delete_asset` orphans transactions with no cleanup guidance (Medium)
Description correctly says "linked transfer transactions are kept" but doesn't explain how to find/clean them up. If the agent didn't store the transaction ID from `buy_asset`, there's no way to find orphaned transactions for a deleted asset.
- **Found in:** Workflow 4
- **Suggestion:** Return orphaned transaction IDs in the delete response, or add a `deleteTransactions: true` option.

### DESIGN-6: `date` is required on `create_transaction` with no default (Low-Medium)
For the most common case ("I just bought X"), the user means today. Requiring an explicit date adds friction to every single expense entry.
- **Found in:** Workflow 1
- **Suggestion:** Default to today when omitted.

### DESIGN-7: Date format inconsistency across report tools (Low)
`get_budget_status` uses `month` (YYYY-MM). `get_spending_summary` uses `dateFrom`/`dateTo` (YYYY-MM-DD). `get_category_stats` accepts both. `get_trends` uses `months: N` (trailing count). An agent must use different strategies per tool.
- **Found in:** Workflow 3
- **Suggestion:** Standardize to accept both `month` and `dateFrom`/`dateTo` where it makes sense.

### DESIGN-8: No subcategory handling documented for `merge_categories` (Medium)
The description mentions transactions and budgets but says nothing about subcategories. If the source has children, behavior is undefined from the agent's perspective.
- **Found in:** Workflow 6

### DESIGN-9: Server `INSTRUCTIONS` has no fallback guidance for `search_symbol` failures (Medium)
Instructions say "use search_symbol... then pass it as symbolMap to create_asset" as if it always succeeds. No guidance for the manual path (create without symbolMap, use `record_price` manually).
- **Found in:** Workflow 4
- **Suggestion:** Add: "If search_symbol returns no results, create the asset without symbolMap — it won't have automatic price tracking. Use record_price to update prices manually."

---

## What Works Well

These strengths should be preserved:

1. **Batch tools exist where needed.** `create_transactions` (plural) for multi-entry, `batch_update_transactions`, and array-accepting `delete_transaction` cover real workflows.

2. **Cents convention is well-documented** in `INSTRUCTIONS` and on `create_transaction`/`buy_asset` descriptions with clear examples.

3. **`get_`/`list_` naming convention** is consistent and intuitive — `list_` for CRUD listing, `get_` for reports/analytics. Agents can quickly find what they need.

4. **`convert_currency` cross-references its use case.** The description says "Primary use case: receipt in foreign currency → EUR for transaction entry" — the best example of cross-tool guidance in the whole toolset.

5. **`create_asset` workflow is well-documented.** The description walks through the search_symbol → symbolMap → create_asset flow with examples for different asset types. This should be the model for other multi-step workflows.

6. **`get_budget_status` response has `isOver` boolean.** An agent can directly answer "am I overspending?" with a simple filter. The response shape is designed for agents, not just humans.

7. **Sensible defaults.** `type` defaults to `expense` on transactions. `currency` defaults to `EUR` on assets. These match the most common cases.

8. **`get_category_stats` cross-references `get_budget_status`.** "Use get_budget_status for budget tracking" — a good "see also" hint. Should be applied more broadly.

---

## Priority Summary

### Do First (Bugs + High-Impact)
| ID | Issue | Type |
|----|-------|------|
| BUG-1 | Self-merge deletes category | Bug |
| BUG-2 | Nonexistent source merge silently succeeds | Bug |
| BUG-3 | Raw SQLite error on nonexistent target | Bug |
| BUG-4 | `delete_transaction` rejects single integer | Bug |
| BUG-5 | Portfolio data inconsistency | Bug |
| DESIGN-1 | `recategorize` global destructive, no preview | Safety |
| DESC-4 | `merchantPattern` matching undocumented | Safety |

### Do Next (Description Improvements)
| ID | Issue | Type |
|----|-------|------|
| DESC-1 | Add cross-tool guidance for category lookup | Description |
| DESC-2 | Add cents reminder to all `amount` tools | Description |
| DESC-5 | Document `startDate` semantics on recurring | Description |
| DESC-6 | Include provider status in search_symbol errors | Description |
| DESC-7 | Enrich `merge_categories` response with counts | Description |
| DESIGN-9 | Add fallback guidance in INSTRUCTIONS | Description |
| BUG-6 | Fix `record_price` reference to `get_market_price` | Description |

### Nice to Have
| ID | Issue | Type |
|----|-------|------|
| DESIGN-2 | Clarify report tool overlap in descriptions | Description |
| DESIGN-3 | `get_budget_status` unbudgeted categories flag | Feature |
| DESIGN-4 | Original currency fields on transactions | Feature |
| DESIGN-6 | Default `date` to today | Feature |
| DESC-3 | Fix `convert_currency` EUR/USD inconsistency | Description |
| DESC-8 | Clarify description vs merchant fields | Description |
| DESC-9 | Naming consistency: `recategorize` | Naming |
| DESC-10 | Add parameter descriptions to all fields | Description |
| DESIGN-5 | Cleanup guidance for `delete_asset` | Description |
| DESIGN-7 | Date format standardization across reports | Feature |
| DESIGN-8 | Document subcategory handling for merge | Description |
