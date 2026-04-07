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
