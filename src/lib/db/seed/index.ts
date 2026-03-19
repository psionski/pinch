import { getDb } from "../index";
import { budgets, categories, recurringTransactions, transactions } from "../schema";
import { PARENT_CATEGORIES, CHILD_CATEGORIES } from "./data";
import { generateMonth, type TxInput } from "./transactions";
import { generateBudgets } from "./budgets";
import { generateRecurringTemplates } from "./recurring";
import { daysInMonth, isoDate } from "./rng";

async function seed(): Promise<void> {
  const db = getDb();

  // Abort if database already has data
  const existingCategories = await db.select().from(categories);
  const existingTransactions = await db.select({ id: transactions.id }).from(transactions).limit(1);
  if (existingCategories.length > 0 || existingTransactions.length > 0) {
    console.error(
      "Error: Database is not empty. Delete the database file and run migrations before seeding.\n" +
        "  rm data/pinch.db && npm run db:migrate && npx tsx src/lib/db/seed.ts"
    );
    process.exit(1);
  }

  // ── Categories ──────────────────────────────────────────────────────────
  console.log("Seeding categories...");

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
  console.log(`  ${totalCats} categories ready (${CHILD_CATEGORIES.length} nested).`);

  const cats = await db.select().from(categories);
  const catIds: Record<string, number> = {};
  for (const c of cats) catIds[c.name] = c.id;

  // ── Date range (4 months ending with current month) ───────────────────
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();

  const months: Array<{ year: number; month: number; lastDay: number }> = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(todayYear, todayMonth - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const lastDay = i === 0 ? todayDay : daysInMonth(y, m);
    months.push({ year: y, month: m, lastDay });
  }

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  const rangeLabel =
    `${isoDate(firstMonth.year, firstMonth.month, 1).slice(0, 7)} – ` +
    `${isoDate(lastMonth.year, lastMonth.month, 1).slice(0, 7)}`;

  // ── Recurring templates (before transactions, so we can link them) ────
  console.log("Creating recurring transaction templates...");

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
  console.log(`  ${templates.length} recurring templates created.`);

  // ── Transactions ──────────────────────────────────────────────────────
  console.log(`Generating 4 months of transactions (${rangeLabel})...`);

  let balance = 200000; // €2 000 — previous month's salary leftovers
  const allTxs: TxInput[] = [];

  // Opening balance — the day before the first generated month
  const preMonth = new Date(firstMonth.year, firstMonth.month - 2, 1);
  const preLastDay = daysInMonth(preMonth.getFullYear(), preMonth.getMonth() + 1);
  const openingDate = isoDate(preMonth.getFullYear(), preMonth.getMonth() + 1, preLastDay);

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
    console.log(`  ${year}-${String(month).padStart(2, "0")}: ${result.txs.length} transactions`);
  }

  console.log(`Inserting ${allTxs.length} transactions...`);
  const rows = allTxs.map((tx) => ({
    ...tx,
    tags: JSON.stringify(tx.tags),
    recurringId: tx.recurringId ?? null,
  }));

  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(transactions).values(rows.slice(i, i + BATCH));
  }

  // ── Budgets ─────────────────────────────────────────────────────────────
  console.log("Generating budgets...");
  const budgetRows = generateBudgets(allTxs, catIds, months);
  for (const row of budgetRows) {
    await db.insert(budgets).values(row);
  }
  console.log(`  ${budgetRows.length} budget entries across ${months.length} months.`);

  // ── Summary ─────────────────────────────────────────────────────────────
  const income = allTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = allTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  console.log(`Done.`);
  console.log(`  Total income:   €${(income / 100).toFixed(2)}`);
  console.log(`  Total expenses: €${(expenses / 100).toFixed(2)}`);
  console.log(`  Final balance:  €${(balance / 100).toFixed(2)}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
