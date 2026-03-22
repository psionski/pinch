# MCP Asset Tools — E2E UX Review

Six sequential agent workflows tested the full asset management tool surface against a live dev server with seeded data (Savings Account, Bitcoin, MSCI World ETF).

## Workflows Executed

| # | Workflow | Key Tools Tested |
|---|----------|-----------------|
| 1 | ETF Investment Lifecycle | search_symbol, create_asset, buy_asset, record_price, sell_asset, get_realized_pnl, list_lots |
| 2 | Crypto Portfolio (DCA) | search_symbol, create_asset, buy_asset, get_price, record_price, get_allocation, get_currency_exposure, get_asset_performance |
| 3 | EUR Savings Deposit | create_asset (deposit), buy_asset (EUR convention), sell_asset (withdrawal), get_portfolio, get_allocation |
| 4 | Foreign Currency Deposit (USD) | search_symbol, create_asset (USD), buy_asset, get_price, record_price, get_currency_exposure, get_portfolio |
| 5 | Multi-Asset Portfolio Analysis | get_portfolio, get_allocation, get_asset_performance, get_net_worth_history, get_realized_pnl, get_currency_exposure, get_asset_history |
| 6 | Edge Cases & Error Handling | update_asset, buy_asset (invalid params), sell_asset (oversell), record_price (deleted asset), get_asset_history (window: all), delete_asset |

---

## Critical Issues

### 1. Price source inconsistency between CRUD and reporting tools
**Severity: Critical** — Workflows 4, 5

CRUD tools (`list_assets`, `get_asset`, `get_portfolio`) use `latestPrice` from the last transaction/lot. Reporting tools (`get_allocation`, `get_asset_performance`, `get_net_worth_history`) use the price history table (market-fetched prices). This produces materially different values for the same asset at the same moment.

Example from workflow 5:
- `get_portfolio` reports Bitcoin value: **74,700** (cents), netWorth: **22,734**
- `get_net_worth_history` last data point: total **2,811**
- `get_asset_performance` reports Bitcoin value: **54,641**

This is an 8x discrepancy in net worth that would destroy user trust.

**Fix:** Unify price sources — either always use the latest price record from the price history table, or clearly document and label which price source each tool uses.

### 2. Foreign currency costBasis/PnL bug
**Severity: Critical** — Workflow 4

For non-EUR assets, `costBasis` is stored in native currency cents but `currentValue` is computed in EUR cents after `record_price`. PnL subtraction mixes currencies, producing nonsensical results.

Example: $10,000 deposit → costBasis=1,000,000 (USD cents). After recording exchange rate (0.87): currentValue=870,000 (EUR cents). PnL=-130,000 (**fake -13% loss**). Actual EUR cost was ~€8,390, so real PnL should be ~+€264 (a gain).

**Fix:** Convert costBasis to EUR at the exchange rate on the buy date, OR always convert both sides to the same currency before computing PnL.

### 3. `search_symbol` doesn't return forex results
**Severity: High** — Workflow 4

`create_asset` description says: "For foreign currency deposits, use search_symbol with the currency code (e.g. 'USD')." But `search_symbol("USD")` only queries CoinGecko and returns crypto stablecoins. The `frankfurter` and `ecb` exchange-rate providers are not searched.

**Fix:** Include exchange-rate providers in `search_symbol` results for currency code queries. Return entries like `{ provider: "frankfurter", symbol: "USD", name: "US Dollar", type: "exchange-rate" }`.

---

## Bugs

### 4. `record_price` description references non-existent tool
**Severity: Medium** — Workflows 1, 2, 4

Description says: "Use get_market_price first to fetch the latest price." The actual tool is `get_price`. Stale reference.

**Fix:** Change `get_market_price` → `get_price` in the description.

### 5. `record_price` on deleted asset leaks DB error
**Severity: Medium** — Workflow 6

Returns `"FOREIGN KEY constraint failed"` instead of `"Asset 9 not found"`. Every other endpoint returns a user-friendly not-found message.

**Fix:** Add asset existence check in the `recordPrice` service method before the DB insert.

### 6. `get_asset_history` with `window: "all"` starts from year 2000
**Severity: Medium** — Workflows 3, 6

Generates ~1,365 weekly data points (92-97KB response) starting from 2000-01-01 regardless of when the asset was created. Most entries have quantity=0, value=0.

**Fix:** Start the "all" window from `MIN(lots.date)` or `asset.createdAt`.

### 7. Floating point display noise
**Severity: Low** — Workflows 2, 5

Bitcoin holdings display as `0.009000000000000001` instead of `0.009`. IEEE 754 artifact leaking into user-facing responses.

**Fix:** Round `currentHoldings` to 8-10 decimal places before returning.

---

## Description & Naming Issues

### 8. `buy_asset`/`sell_asset` — no guidance for non-EUR currencies
**Severity: High** — Workflow 4

The EUR deposit convention (pricePerUnit=100) is well-documented. But for USD or other currency deposits, there's no guidance on what `pricePerUnit` means (native currency cents? EUR cents?). This leads to incorrect data entry.

**Fix:** Add to `buy_asset`: "For foreign currency deposits (e.g. USD), pricePerUnit=100 represents 1 unit of the deposit's native currency."

### 9. `sell_asset` — missing EUR deposit convention reminder
**Severity: Low** — Workflow 3

`buy_asset` has a prominent EUR deposit section. `sell_asset` doesn't mention it. An agent could use the wrong pricePerUnit for withdrawals.

**Fix:** Add brief EUR deposit note to `sell_asset`.

### 10. No cross-references between reporting tools
**Severity: Low** — Workflow 5

`get_portfolio`, `get_allocation`, `get_asset_performance`, `get_net_worth_history`, `get_realized_pnl`, `get_currency_exposure` — six reporting tools with no cross-references in their descriptions. Hard to know which to use without reading all six.

**Fix:** Add to `get_portfolio`: "This is the main overview. For detailed breakdowns, see get_allocation, get_asset_performance, get_net_worth_history, get_realized_pnl, get_currency_exposure."

### 11. `list_lots` for non-existent asset returns empty array
**Severity: Low** — Workflow 6

Returns `[]` instead of "Asset X not found", inconsistent with all other endpoints. Ambiguous — could mean "asset exists but has no lots."

**Fix:** Check asset existence and return not-found error.

---

## Feature Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| No `delete_lot` / `update_lot` | Medium | Can't correct a data entry error on a single lot without deleting the entire asset |
| No bulk `buy_asset` | Medium | DCA with 48+ periodic buys requires 48 tool calls. A batch variant would help. |
| No `refresh_prices` | Medium | Must call `get_price` + `record_price` per asset. A single tool using each asset's symbolMap would streamline this. |
| No `assetId` filter on `list_transactions` | Low | After `delete_asset`, finding orphaned transfer transactions requires knowing IDs from `list_lots` beforehand |
| `delete_asset` has no `deleteTransactions` option | Low | Cleanup requires separate transaction deletion |
| No interest/dividend recording convention | Low | Savings accounts earn interest but there's no guidance on how to record it |
| `get_currency_exposure` only looks at denomination | Low | Crypto and global ETFs show as 100% EUR since `currency=EUR`, not reflecting underlying exposure |
| No unrealized PnL per-lot breakdown | Low | `get_realized_pnl` exists but no per-lot unrealized equivalent |

---

## What Works Well

- **Tool naming is intuitive and consistent.** The `verb_noun` pattern (`create_asset`, `buy_asset`, `get_portfolio`) is easy to discover without documentation.
- **`buy_asset` EUR deposit guidance is excellent.** The `IMPORTANT` callout with concrete examples (quantity=5000, pricePerUnit=100 for €5,000) is the gold standard for parameter documentation.
- **`create_asset` → `search_symbol` → `buy_asset` pipeline is well-documented.** Each tool's description references the next step in the chain.
- **Atomic buy/sell operations.** `buy_asset` and `sell_asset` creating both lot + transaction atomically is the right design, clearly documented.
- **Validation is comprehensive.** All invalid inputs are caught at schema or service level with clear messages (except the `record_price` FK bug).
- **`get_portfolio` as a one-stop overview** is well-designed — assets, cash, net worth, allocation in one call.
- **`get_asset_performance`** providing annualized return and days held is genuinely useful for comparing assets bought at different times.
- **`get_asset_history`** combining lots + price timeline in one response is elegant for chart rendering.
- **Error messages are specific and actionable** — "Insufficient holdings: have 2, selling 3" is exemplary.

---

## Priority Summary

| Priority | Count | Items |
|----------|-------|-------|
| **P0 — Critical** | 2 | Price source inconsistency (#1), Foreign currency PnL bug (#2) |
| **P1 — High** | 2 | search_symbol forex gap (#3), non-EUR buy_asset docs (#8) |
| **P2 — Medium** | 4 | record_price stale reference (#4), record_price FK error (#5), get_asset_history epoch bug (#6), missing delete_lot/update_lot |
| **P3 — Low** | 5 | Float display (#7), sell_asset EUR note (#9), cross-references (#10), list_lots consistency (#11), bulk buy |
