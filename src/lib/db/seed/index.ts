import { getDb } from "../index";
import { budgets, categories, transactions } from "../schema";
import { PARENT_CATEGORIES, CHILD_CATEGORIES } from "./data";
import { generateMonth, type TxInput } from "./transactions";
import { generateBudgets } from "./budgets";

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

  // ── Transactions ────────────────────────────────────────────────────────
  console.log("Generating 4 months of transactions (Dec 2025 – Mar 2026)...");

  const months = [
    { year: 2025, month: 12, lastDay: 31 },
    { year: 2026, month: 1, lastDay: 31 },
    { year: 2026, month: 2, lastDay: 28 },
    { year: 2026, month: 3, lastDay: 18 }, // up to today
  ];

  let balance = 200000; // €2 000 — previous month's salary leftovers
  const allTxs: TxInput[] = [];

  // Opening balance — makes the starting amount visible in the DB
  allTxs.push({
    amount: balance,
    type: "income",
    description: "Previous month balance",
    categoryId: catIds.Income,
    date: "2025-11-30",
    tags: ["opening-balance"],
  });

  for (const { year, month, lastDay } of months) {
    const result = generateMonth(year, month, lastDay, catIds, balance);
    allTxs.push(...result.txs);
    balance = result.balance;
    console.log(`  ${year}-${String(month).padStart(2, "0")}: ${result.txs.length} transactions`);
  }

  console.log(`Inserting ${allTxs.length} transactions...`);
  const rows = allTxs.map((tx) => ({ ...tx, tags: JSON.stringify(tx.tags) }));

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
