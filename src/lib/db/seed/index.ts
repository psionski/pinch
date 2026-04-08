import { eq, sql, isNotNull } from "drizzle-orm";
import { getDb } from "../index";
import {
  assets,
  assetLots,
  assetPrices,
  budgets,
  categories,
  marketPrices,
  recurringTransactions,
  settings,
  transactions,
} from "../schema";
import { PARENT_CATEGORIES, CHILD_CATEGORIES } from "./data";
import { generateMonth, type TxInput } from "./transactions";
import { generateBudgets } from "./budgets";
import { generateRecurringTemplates } from "./recurring";
import { generateAssets } from "./assets";
import { Temporal } from "@js-temporal/polyfill";
import { isoDate } from "./rng";
import { logger, seedLogger } from "@/lib/logger";

async function seed(): Promise<void> {
  const db = getDb();

  // Abort if database already has data
  const existingCategories = await db.select().from(categories);
  const existingTransactions = await db.select({ id: transactions.id }).from(transactions).limit(1);
  if (existingCategories.length > 0 || existingTransactions.length > 0) {
    seedLogger.error(
      "Database is not empty. Delete the database file and run again.\n" +
        "  rm data/pinch.db && npm run db:seed"
    );
    logger.flush();
    process.exit(1);
  }

  // ── Categories ──────────────────────────────────────────────────────────
  seedLogger.info("Seeding categories...");

  for (const cat of PARENT_CATEGORIES) {
    await db.insert(categories).values(cat).onConflictDoNothing();
  }

  const parentRows = await db.select().from(categories);
  const parentIdMap: Record<string, number> = {};
  for (const c of parentRows) parentIdMap[c.name] = c.id;

  for (const child of CHILD_CATEGORIES) {
    const parentId = parentIdMap[child.parentName];
    await db
      .insert(categories)
      .values({ name: child.name, icon: child.icon, color: child.color, parentId })
      .onConflictDoNothing();
  }

  const totalCats = PARENT_CATEGORIES.length + CHILD_CATEGORIES.length;
  seedLogger.info(`  ${totalCats} categories ready (${CHILD_CATEGORIES.length} nested).`);

  const cats = await db.select().from(categories);
  const catIds: Record<string, number> = {};
  for (const c of cats) catIds[c.name] = c.id;

  // ── Date range (12 months ending with current month) ──────────────────
  const today = Temporal.Now.plainDateISO();
  const todayYear = today.year;
  const todayMonth = today.month;
  const todayDay = today.day;

  const months: Array<{ year: number; month: number; lastDay: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const ym = Temporal.PlainYearMonth.from({ year: todayYear, month: todayMonth }).subtract({
      months: i,
    });
    const lastDay = i === 0 ? todayDay : ym.daysInMonth;
    months.push({ year: ym.year, month: ym.month, lastDay });
  }

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const rangeLabel =
    `${isoDate(firstMonth.year, firstMonth.month, 1).slice(0, 7)} – ` +
    `${isoDate(lastMonth.year, lastMonth.month, 1).slice(0, 7)}`;

  // ── Recurring templates (before transactions, so we can link them) ────
  seedLogger.info("Creating recurring transaction templates...");

  const recStart = isoDate(firstMonth.year, firstMonth.month, 1);
  const todayStr = isoDate(todayYear, todayMonth, todayDay);
  const templates = generateRecurringTemplates(catIds, recStart, todayStr);

  const recurringIds: Record<string, number> = {};
  for (const tmpl of templates) {
    const [row] = await db
      .insert(recurringTransactions)
      .values(tmpl)
      .returning({ id: recurringTransactions.id });
    recurringIds[tmpl.description] = row.id;
  }
  seedLogger.info(`  ${templates.length} recurring templates created.`);

  // ── Transactions ──────────────────────────────────────────────────────
  seedLogger.info(`Generating 12 months of transactions (${rangeLabel})...`);

  let balance = 2000; // €2 000 — previous month's salary leftovers
  const allTxs: TxInput[] = [];

  // Opening balance — the day before the first generated month
  const preYm = Temporal.PlainYearMonth.from({
    year: firstMonth.year,
    month: firstMonth.month,
  }).subtract({ months: 1 });
  const openingDate = isoDate(preYm.year, preYm.month, preYm.daysInMonth);

  allTxs.push({
    amount: balance,
    type: "income",
    description: "Previous month balance",
    categoryId: catIds.Income,
    date: openingDate,
    tags: ["opening-balance"],
  });

  for (const { year, month, lastDay } of months) {
    const result = generateMonth(year, month, lastDay, catIds, balance, recurringIds);
    allTxs.push(...result.txs);
    balance = result.balance;
    seedLogger.info(
      `  ${year}-${String(month).padStart(2, "0")}: ${result.txs.length} transactions`
    );
  }

  seedLogger.info(`Inserting ${allTxs.length} transactions...`);
  // Sample data is fully denominated in EUR, which matches the configured base
  // currency for the seed (set below). amount_base mirrors amount.
  const rows = allTxs.map((tx) => ({
    ...tx,
    currency: "EUR",
    amountBase: tx.amount,
    tags: JSON.stringify(tx.tags),
    recurringId: tx.recurringId ?? null,
  }));

  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(transactions).values(rows.slice(i, i + BATCH));
  }

  // ── One foreign-currency demo transaction ──────────────────────────────────
  // Surfaces the multi-currency UI tooltip on a fresh sample-data DB without
  // requiring the user to create a foreign-currency transaction by hand. The
  // FX rate is pre-cached in `market_prices` so the seed never depends on a
  // live network call. Anchored to the most recent month so it shows up in the
  // dashboard's "this month" view.
  const fcDate = isoDate(lastMonth.year, lastMonth.month, Math.min(12, lastMonth.lastDay));
  const fcRate = 1.18; // 1 GBP ≈ 1.18 EUR — illustrative, not live
  const fcNative = 4.5; // £4.50 airport coffee
  const fcBase = Math.round(fcNative * fcRate * 100) / 100;
  await db.insert(marketPrices).values({
    symbol: "GBP",
    currency: "EUR",
    price: fcRate,
    date: fcDate,
    provider: "frankfurter",
  });
  await db.insert(transactions).values({
    amount: fcNative,
    currency: "GBP",
    amountBase: fcBase,
    type: "expense",
    description: "Airport coffee in London",
    merchant: "Heathrow Costa",
    categoryId: catIds.Coffee,
    date: fcDate,
    tags: JSON.stringify(["travel", "coffee"]),
  });
  seedLogger.info(`  Added 1 GBP demo transaction (£${fcNative} ≈ €${fcBase.toFixed(2)}).`);

  // ── Budgets ─────────────────────────────────────────────────────────────
  seedLogger.info("Generating budgets...");
  const budgetRows = generateBudgets(allTxs, catIds, months);
  for (const row of budgetRows) {
    await db.insert(budgets).values(row);
  }
  seedLogger.info(`  ${budgetRows.length} budget entries across ${months.length} months.`);

  // ── Assets & Portfolio ──────────────────────────────────────────────────────
  seedLogger.info("Generating portfolio assets...");
  const { assets: assetSeeds, marketPrices: mpSeeds } = generateAssets(months);

  let totalLots = 0;
  for (const seed of assetSeeds) {
    const [assetRow] = await db.insert(assets).values(seed.asset).returning({ id: assets.id });

    for (const lot of seed.lots) {
      const totalValue = Math.round(Math.abs(lot.quantity) * lot.pricePerUnit * 100) / 100;
      const signed = lot.quantity >= 0 ? -totalValue : totalValue;
      const [txRow] = await db
        .insert(transactions)
        .values({
          amount: signed,
          // Sample-data lots are denominated in their asset currency, which is
          // EUR for the seed (single-currency demo). The base-currency
          // equivalent is identical.
          currency: seed.asset.currency ?? "EUR",
          amountBase: signed,
          type: "transfer",
          description: lot.description,
          date: lot.date,
          notes: lot.notes ?? null,
          tags: JSON.stringify(["portfolio"]),
        })
        .returning({ id: transactions.id });

      await db.insert(assetLots).values({
        assetId: assetRow.id,
        quantity: lot.quantity,
        pricePerUnit: lot.pricePerUnit,
        // Sample data is single-currency, so per-unit base = per-unit native.
        // Without this the column falls through to its DEFAULT of 0 and every
        // seeded asset reports a costBasisBase of 0, which makes pnlBase look
        // like the entire current value is profit.
        pricePerUnitBase: lot.pricePerUnit,
        date: lot.date,
        transactionId: txRow.id,
        notes: lot.notes ?? null,
      });

      await db.insert(assetPrices).values({
        assetId: assetRow.id,
        pricePerUnit: lot.pricePerUnit,
        recordedAt: `${lot.date}T12:00:00`,
      });

      totalLots++;
    }

    seedLogger.info(`  ${seed.asset.name}: ${seed.lots.length} lots`);
  }

  for (let i = 0; i < mpSeeds.length; i += BATCH) {
    await db.insert(marketPrices).values(mpSeeds.slice(i, i + BATCH));
  }
  seedLogger.info(`  ${mpSeeds.length} market price points, ${totalLots} asset lots total.`);

  // ── Multi-currency demo data ───────────────────────────────────────────
  // Surfaces the sprint 27 multi-currency feature set on a fresh seed:
  //   - Apple Inc. (USD investment, 2 lots at different FX rates) drives
  //     the portfolio performance table's FX Effect column and the asset
  //     detail's "≈ €..." subtitle on Cost Basis / Current Value.
  //   - USD Travel Fund (USD deposit, 1 lot) exercises the deposit
  //     dialog's foreign-currency preview path.
  //   - "London co-working" (GBP recurring, monthly) populates 6 months
  //     of foreign-currency expenses with month-by-month FX drift.
  // All FX rates are pre-cached in market_prices so the seed never
  // depends on a live network call.
  seedLogger.info("Adding multi-currency demo data...");

  // ── Apple Inc. (USD investment) ────────────────────────────────────────
  // Two lots at different USD→EUR rates create a visible FX P&L
  // contribution on top of the underlying price gain.
  const appleLot1Month = months[2]; // ~9 months ago
  const appleLot2Month = months[7]; // ~4 months ago
  const appleLot1Date = isoDate(appleLot1Month.year, appleLot1Month.month, 15);
  const appleLot2Date = isoDate(appleLot2Month.year, appleLot2Month.month, 10);
  const appleLot1Rate = 0.95;
  const appleLot2Rate = 0.93;
  const todayUsdRate = 0.91;

  await db.insert(marketPrices).values([
    { symbol: "USD", currency: "EUR", price: appleLot1Rate, date: appleLot1Date, provider: "frankfurter" },
    { symbol: "USD", currency: "EUR", price: appleLot2Rate, date: appleLot2Date, provider: "frankfurter" },
    { symbol: "USD", currency: "EUR", price: todayUsdRate, date: todayStr, provider: "frankfurter" },
  ]);

  const [appleAsset] = await db
    .insert(assets)
    .values({
      name: "Apple Inc.",
      type: "investment",
      currency: "USD",
      symbolMap: JSON.stringify({ "alpha-vantage": "AAPL" }),
      icon: "🍎",
      color: "#94a3b8",
    })
    .returning({ id: assets.id });

  const appleLots = [
    { quantity: 10, pricePerUnit: 150, date: appleLot1Date, rate: appleLot1Rate },
    { quantity: 5, pricePerUnit: 165, date: appleLot2Date, rate: appleLot2Rate },
  ];

  for (const lot of appleLots) {
    const totalNative = lot.quantity * lot.pricePerUnit;
    const totalBase = Math.round(totalNative * lot.rate * 100) / 100;
    const [txRow] = await db
      .insert(transactions)
      .values({
        amount: -totalNative,
        currency: "USD",
        amountBase: -totalBase,
        type: "transfer",
        description: `Buy ${lot.quantity} Apple Inc. @ ${lot.pricePerUnit.toFixed(2)} USD`,
        date: lot.date,
        tags: JSON.stringify(["portfolio"]),
      })
      .returning({ id: transactions.id });

    await db.insert(assetLots).values({
      assetId: appleAsset.id,
      quantity: lot.quantity,
      pricePerUnit: lot.pricePerUnit,
      // Snapshotted at lot creation — exactly what AssetLotService.buy()
      // would compute via toBase() at write time.
      pricePerUnitBase: Math.round(lot.pricePerUnit * lot.rate * 10000) / 10000,
      date: lot.date,
      transactionId: txRow.id,
    });

    await db.insert(assetPrices).values({
      assetId: appleAsset.id,
      pricePerUnit: lot.pricePerUnit,
      recordedAt: `${lot.date}T12:00:00`,
    });
  }

  // Current Apple price snapshot — simulates the user clicking "Set Price"
  // (or the daily cron caching a fresh quote) so the asset detail's
  // "Current Value" card shows a value newer than the most recent lot.
  // Without this, the price-resolver step 2 (user price) would return the
  // lot2 price ($165) and currentValue would be stuck at the cost basis.
  await db.insert(assetPrices).values({
    assetId: appleAsset.id,
    pricePerUnit: 180,
    recordedAt: `${todayStr}T12:00:00`,
  });

  // ── USD Travel Fund (USD deposit) ──────────────────────────────────────
  const [travelAsset] = await db
    .insert(assets)
    .values({
      name: "USD Travel Fund",
      type: "deposit",
      currency: "USD",
      icon: "✈️",
      color: "#60a5fa",
    })
    .returning({ id: assets.id });

  const travelDepositDate = appleLot2Date;
  const travelDepositAmount = 800;
  const travelDepositBase = Math.round(travelDepositAmount * appleLot2Rate * 100) / 100;
  const [travelTx] = await db
    .insert(transactions)
    .values({
      amount: -travelDepositAmount,
      currency: "USD",
      amountBase: -travelDepositBase,
      type: "transfer",
      // Custom description (as if the user typed it). The service would
      // otherwise auto-generate "Deposit 800 USD Travel Fund @ 1.00 USD"
      // which reads awkwardly because the asset name contains "USD".
      description: "Initial USD travel funds",
      date: travelDepositDate,
      tags: JSON.stringify(["portfolio"]),
    })
    .returning({ id: transactions.id });

  await db.insert(assetLots).values({
    assetId: travelAsset.id,
    quantity: travelDepositAmount,
    // Deposits are always pricePerUnit=1 by definition (the quantity
    // carries the foreign-currency amount). The base-side per-unit value
    // is the FX rate at deposit time — same value the service would
    // store via toBase() / pricePerUnitBase = totalBase/quantity.
    pricePerUnit: 1,
    pricePerUnitBase: appleLot2Rate,
    date: travelDepositDate,
    transactionId: travelTx.id,
  });

  // Mirror AssetLotService.buy()'s recordPriceSnapshot — every lot
  // creation produces a corresponding asset_prices row. The existing
  // seed does this for the EUR Savings Account too; without it the
  // asset detail price chart shows no data points and `attachMetrics`'s
  // user-price lookup misses entirely.
  await db.insert(assetPrices).values({
    assetId: travelAsset.id,
    pricePerUnit: 1,
    recordedAt: `${travelDepositDate}T12:00:00`,
  });

  // ── London co-working (GBP recurring) ──────────────────────────────────
  // Monthly £150, generated for the last 6 months at slightly different
  // GBP→EUR rates each month. Each generated transaction stores its own
  // amount_base — that's the whole point of recomputing FX per generation.
  const londonAmount = 150;
  const gbpMonths = months.slice(-6);
  const gbpRates = [1.16, 1.17, 1.18, 1.17, 1.16, 1.18];
  const londonStartDate = isoDate(gbpMonths[0].year, gbpMonths[0].month, 1);

  // Pre-cache one GBP→EUR rate per generation date. The existing airport
  // coffee row uses a different day-of-month, so no unique-index collision.
  for (let i = 0; i < gbpMonths.length; i++) {
    const m = gbpMonths[i];
    const date = isoDate(m.year, m.month, 1);
    await db
      .insert(marketPrices)
      .values({ symbol: "GBP", currency: "EUR", price: gbpRates[i], date, provider: "frankfurter" })
      .onConflictDoNothing();
  }

  // Tags live on the template and propagate to every generated row via
  // RecurringService.generateForTemplate(`tags: r.tags`). Setting them on
  // the template AND the generated rows below keeps the seed consistent
  // with what the service would actually produce.
  const londonTags = JSON.stringify(["work", "travel"]);

  const [londonRecurring] = await db
    .insert(recurringTransactions)
    .values({
      amount: londonAmount,
      currency: "GBP",
      type: "expense",
      description: "London co-working",
      merchant: "Workspace London",
      categoryId: catIds.Subscriptions,
      frequency: "monthly",
      dayOfMonth: 1,
      startDate: londonStartDate,
      // Set to today (matches the existing-template convention in
      // generateRecurringTemplates). The next-occurrence calculation is
      // unaffected — `computeNextOccurrence` reads only the template
      // schedule and `isoToday()`, not `lastGenerated` — and the on-startup
      // generation engine uses lastGenerated only as a "don't re-emit
      // before this" cursor, which a today sentinel satisfies.
      lastGenerated: todayStr,
      tags: londonTags,
    })
    .returning({ id: recurringTransactions.id });

  for (let i = 0; i < gbpMonths.length; i++) {
    const m = gbpMonths[i];
    const date = isoDate(m.year, m.month, 1);
    const amountBase = Math.round(londonAmount * gbpRates[i] * 100) / 100;
    await db.insert(transactions).values({
      amount: londonAmount,
      currency: "GBP",
      amountBase,
      type: "expense",
      description: "London co-working",
      merchant: "Workspace London",
      categoryId: catIds.Subscriptions,
      date,
      recurringId: londonRecurring.id,
      tags: londonTags,
    });
  }

  seedLogger.info(
    `  Apple Inc. (USD investment, 2 lots), USD Travel Fund (USD deposit), London co-working (GBP recurring, ${gbpMonths.length} months).`
  );

  // ── Reconcile recurring `lastGenerated` ────────────────────────────────
  // The template helpers set `lastGenerated = todayStr` as a sentinel
  // meaning "the seed has produced everything up to today, don't re-emit".
  // The actual service convention is `lastGenerated = dates[dates.length-1]`
  // — the date of the most recently emitted occurrence. Both sentinels
  // produce identical next-occurrence behavior (computeNextOccurrence
  // reads only the schedule and isoToday()), but the user-visible
  // "last generated" value should match what the service would write.
  // Walk every template, find the max date among its linked transactions,
  // and update the column.
  seedLogger.info("Reconciling recurring template `lastGenerated` dates...");
  const linkedDates = await db
    .select({
      recurringId: transactions.recurringId,
      lastDate: sql<string>`max(${transactions.date})`.mapWith(String),
    })
    .from(transactions)
    .where(isNotNull(transactions.recurringId))
    .groupBy(transactions.recurringId);
  for (const row of linkedDates) {
    if (row.recurringId == null) continue;
    await db
      .update(recurringTransactions)
      .set({ lastGenerated: row.lastDate })
      .where(eq(recurringTransactions.id, row.recurringId));
  }
  seedLogger.info(`  Updated ${linkedDates.length} templates.`);

  // ── Settings (timezone + base currency + tutorial flag) ────────────────
  seedLogger.info("Configuring settings...");
  await db.insert(settings).values({ key: "timezone", value: "Europe/Amsterdam" });
  await db.insert(settings).values({ key: "base_currency", value: "EUR" });
  await db.insert(settings).values({ key: "tutorial", value: "true" });
  await db.insert(settings).values({ key: "sample_data", value: "true" });
  seedLogger.info("  Timezone: Europe/Amsterdam, base currency: EUR, tutorial: enabled.");

  // ── Summary ─────────────────────────────────────────────────────────────
  const income = allTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = allTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  seedLogger.info(`Done.`);
  seedLogger.info(`  Total income:   €${income.toFixed(2)}`);
  seedLogger.info(`  Total expenses: €${expenses.toFixed(2)}`);
  seedLogger.info(`  Final balance:  €${balance.toFixed(2)}`);
}

seed().catch((err) => {
  seedLogger.error({ err }, "Seed failed");
  logger.flush();
  process.exit(1);
});
