import { getDb } from "./index";
import { budgets, categories, transactions } from "./schema";

// Parent categories (no parentId)
const PARENT_CATEGORIES = [
  { name: "Food & Drink", icon: "🍴", color: "#fb7185" },
  { name: "Housing", icon: "🏠", color: "#60a5fa" },
  { name: "Transport", icon: "🚗", color: "#f97316" },
  { name: "Entertainment", icon: "🎬", color: "#a78bfa" },
  { name: "Health", icon: "❤️", color: "#f43f5e" },
  { name: "Shopping", icon: "🛍️", color: "#e879f9" },
  { name: "Income", icon: "💰", color: "#34d399" },
  { name: "Other", icon: "📦", color: "#94a3b8" },
];

// Child categories — parentName is used to look up the parent ID after insert
const CHILD_CATEGORIES: Array<{ name: string; icon: string; color: string; parentName: string }> = [
  { name: "Groceries", icon: "🛒", color: "#4ade80", parentName: "Food & Drink" },
  { name: "Dining", icon: "🍽️", color: "#fb923c", parentName: "Food & Drink" },
  { name: "Coffee", icon: "☕", color: "#a16207", parentName: "Food & Drink" },
  { name: "Rent", icon: "🔑", color: "#3b82f6", parentName: "Housing" },
  { name: "Utilities", icon: "💡", color: "#facc15", parentName: "Housing" },
  { name: "Subscriptions", icon: "📱", color: "#38bdf8", parentName: "Entertainment" },
];

// ─── Seeded PRNG (mulberry32) — consistent data across runs ──────────────────

function mulberry32(seed: number): () => number {
  let s = seed;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rand(min: number, max: number): number {
  return Math.round(min + rng() * (max - min));
}

function chance(p: number): boolean {
  return rng() < p;
}

// ─── Merchant / description pools ────────────────────────────────────────────

const COFFEE_SHOPS = ["Costa Coffee", "Starbucks", "Café Nero", "The Coffee House", "Café Central"];
const COFFEE_ORDERS = ["Flat white", "Cappuccino", "Americano", "Latte", "Espresso"];

const GROCERY_STORES = ["Lidl", "Aldi", "Rewe", "Kaufland", "Edeka"];

const LUNCH_SPOTS = [
  "Pret A Manger",
  "Subway",
  "Burger King",
  "Nando's",
  "Wagamama",
  "Leon",
  "Five Guys",
];
const DINNER_SPOTS = [
  "Pizza Express",
  "La Piazza",
  "Wagamama",
  "The Ivy Café",
  "Bella Italia",
  "Zizzi",
  "Dishoom",
  "Nando's",
];

const TRANSPORT_MERCHANTS = ["BVG", "Uber", "Deutsche Bahn", "FlixBus"];

const SHOPPING_MERCHANTS = [
  "Amazon",
  "Zara",
  "H&M",
  "Decathlon",
  "MediaMarkt",
  "IKEA",
  "Primark",
  "Uniqlo",
];
const SHOPPING_DESCS = [
  "Online order",
  "Clothing",
  "Home essentials",
  "Sports gear",
  "Electronics",
  "Household items",
  "Books",
];

const HEALTH_MERCHANTS = ["dm", "Rossmann", "Apotheke am Ring", "DocMorris"];
const HEALTH_DESCS = [
  "Pharmacy purchase",
  "Vitamins & supplements",
  "Prescription",
  "First aid supplies",
  "Skincare",
];

const ENTERTAINMENT_MERCHANTS = [
  "Cinema City",
  "Steam",
  "Eventbrite",
  "Airbnb Experiences",
  "Bowling World",
];
const ENTERTAINMENT_DESCS = [
  "Movie tickets",
  "Game purchase",
  "Event tickets",
  "Weekend activity",
  "Concert",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface TxInput {
  amount: number;
  type: "income" | "expense";
  description: string;
  merchant?: string;
  categoryId: number;
  date: string;
  tags: string[];
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

// ─── Per-month generator ──────────────────────────────────────────────────────

function generateMonth(
  year: number,
  month: number,
  endDay: number,
  catIds: Record<string, number>,
  startBalance: number
): { txs: TxInput[]; balance: number } {
  const txs: TxInput[] = [];
  let bal = startBalance;

  const tryAdd = (tx: TxInput): void => {
    if (tx.type === "expense" && bal < tx.amount) return; // never go negative
    txs.push(tx);
    bal += tx.type === "income" ? tx.amount : -tx.amount;
  };

  const totalDays = Math.min(daysInMonth(year, month), endDay);
  let lastGroceryDay = -8;

  for (let day = 1; day <= totalDays; day++) {
    const date = isoDate(year, month, day);
    const weekend = isWeekend(year, month, day);

    // ── Fixed monthly events ──────────────────────────────────────────────

    if (day === 1) {
      tryAdd({
        amount: 75000,
        type: "expense",
        description: "Monthly rent",
        merchant: "Landlord",
        categoryId: catIds.Rent,
        date,
        tags: ["housing", "rent"],
      });
      tryAdd({
        amount: 1599,
        type: "expense",
        description: "Netflix Standard",
        merchant: "Netflix",
        categoryId: catIds.Subscriptions,
        date,
        tags: ["subscription", "streaming"],
      });
      tryAdd({
        amount: 899,
        type: "expense",
        description: "Amazon Prime",
        merchant: "Amazon",
        categoryId: catIds.Subscriptions,
        date,
        tags: ["subscription"],
      });
    }

    if (day === 5) {
      tryAdd({
        amount: 999,
        type: "expense",
        description: "Spotify Premium",
        merchant: "Spotify",
        categoryId: catIds.Subscriptions,
        date,
        tags: ["subscription", "music"],
      });
    }

    if (day === 10) {
      tryAdd({
        amount: 99,
        type: "expense",
        description: "iCloud+ 50GB",
        merchant: "Apple",
        categoryId: catIds.Subscriptions,
        date,
        tags: ["subscription"],
      });
    }

    if (day === 15) {
      tryAdd({
        amount: 2999,
        type: "expense",
        description: "Internet bill",
        merchant: "Telekom",
        categoryId: catIds.Utilities,
        date,
        tags: ["bills", "internet"],
      });
    }

    if (day === 20) {
      tryAdd({
        amount: rand(4500, 5800),
        type: "expense",
        description: "Electricity bill",
        merchant: "Vattenfall",
        categoryId: catIds.Utilities,
        date,
        tags: ["bills", "electricity"],
      });
    }

    if (day === 25) {
      tryAdd({
        amount: 200000,
        type: "income",
        description: "Monthly salary",
        merchant: "Employer",
        categoryId: catIds.Income,
        date,
        tags: ["salary"],
      });
    }

    // ── Groceries — one trip every 5–8 days ───────────────────────────────

    if (day - lastGroceryDay >= rand(5, 8)) {
      tryAdd({
        amount: rand(3500, 9500),
        type: "expense",
        description: "Grocery run",
        merchant: pick(GROCERY_STORES),
        categoryId: catIds.Groceries,
        date,
        tags: ["groceries"],
      });
      lastGroceryDay = day;
    }

    // ── Stochastic daily events ───────────────────────────────────────────

    // Coffee
    if (chance(weekend ? 0.4 : 0.55)) {
      tryAdd({
        amount: rand(280, 450),
        type: "expense",
        description: pick(COFFEE_ORDERS),
        merchant: pick(COFFEE_SHOPS),
        categoryId: catIds.Coffee,
        date,
        tags: ["coffee"],
      });
    }

    // Lunch
    if (chance(weekend ? 0.2 : 0.35)) {
      tryAdd({
        amount: rand(900, 1800),
        type: "expense",
        description: "Lunch",
        merchant: pick(LUNCH_SPOTS),
        categoryId: catIds.Dining,
        date,
        tags: ["lunch"],
      });
    }

    // Dinner out
    if (chance(weekend ? 0.3 : 0.15)) {
      tryAdd({
        amount: rand(1800, 5500),
        type: "expense",
        description: "Dinner",
        merchant: pick(DINNER_SPOTS),
        categoryId: catIds.Dining,
        date,
        tags: ["dining"],
      });
    }

    // Transport
    if (chance(weekend ? 0.2 : 0.6)) {
      const merchant = pick(TRANSPORT_MERCHANTS);
      const amount =
        merchant === "BVG"
          ? 290
          : merchant === "Uber"
            ? rand(800, 2500)
            : merchant === "Deutsche Bahn"
              ? rand(1500, 8500)
              : rand(1200, 3500); // FlixBus
      tryAdd({
        amount,
        type: "expense",
        description: "Travel",
        merchant,
        categoryId: catIds.Transport,
        date,
        tags: ["transport"],
      });
    }

    // Entertainment
    if (chance(weekend ? 0.18 : 0.06)) {
      tryAdd({
        amount: rand(1200, 4500),
        type: "expense",
        description: pick(ENTERTAINMENT_DESCS),
        merchant: pick(ENTERTAINMENT_MERCHANTS),
        categoryId: catIds.Entertainment,
        date,
        tags: ["entertainment"],
      });
    }

    // Shopping
    if (chance(0.09)) {
      tryAdd({
        amount: rand(1500, 14000),
        type: "expense",
        description: pick(SHOPPING_DESCS),
        merchant: pick(SHOPPING_MERCHANTS),
        categoryId: catIds.Shopping,
        date,
        tags: ["shopping"],
      });
    }

    // Health / pharmacy
    if (chance(0.04)) {
      tryAdd({
        amount: rand(500, 3500),
        type: "expense",
        description: pick(HEALTH_DESCS),
        merchant: pick(HEALTH_MERCHANTS),
        categoryId: catIds.Health,
        date,
        tags: ["health"],
      });
    }
  }

  return { txs, balance: bal };
}

// ─── Budget generation ───────────────────────────────────────────────────────

interface BudgetRow {
  categoryId: number;
  month: string;
  amount: number;
}

/** Round cents up to the nearest €25. */
function roundTo25(cents: number): number {
  const euros = cents / 100;
  return Math.ceil(euros / 25) * 25 * 100;
}

/**
 * Generate realistic budgets based on actual generated spend.
 *
 * Budgeted categories (with sub-budgets where natural):
 * - Food & Drink (parent) + Dining (child) + Coffee (child)
 * - Entertainment (parent) + Subscriptions (child)
 * - Shopping
 */
function generateBudgets(
  allTxs: TxInput[],
  catIds: Record<string, number>,
  months: Array<{ year: number; month: number }>
): BudgetRow[] {
  // Build parent → children map for rollup
  const childrenOf: Record<string, string[]> = {};
  for (const child of CHILD_CATEGORIES) {
    const siblings = childrenOf[child.parentName] ?? [];
    siblings.push(child.name);
    childrenOf[child.parentName] = siblings;
  }

  // Sum expense spend per category name per YYYY-MM
  const spendByCatMonth = new Map<string, number>();
  for (const tx of allTxs) {
    if (tx.type !== "expense") continue;
    const month = tx.date.slice(0, 7); // YYYY-MM
    // Find category name from ID
    const catName = Object.entries(catIds).find(([, id]) => id === tx.categoryId)?.[0];
    if (!catName) continue;
    const key = `${catName}|${month}`;
    spendByCatMonth.set(key, (spendByCatMonth.get(key) ?? 0) + tx.amount);
  }

  // Compute rollup spend: parent includes own + all children
  function rollupSpend(catName: string, month: string): number {
    let total = spendByCatMonth.get(`${catName}|${month}`) ?? 0;
    const children = childrenOf[catName];
    if (children) {
      for (const child of children) {
        total += spendByCatMonth.get(`${child}|${month}`) ?? 0;
      }
    }
    return total;
  }

  // Categories that get budgets: [name, isParentRollup]
  const budgetedCategories: Array<{ name: string; rollup: boolean }> = [
    { name: "Food & Drink", rollup: true },
    { name: "Dining", rollup: false },
    { name: "Coffee", rollup: false },
    { name: "Entertainment", rollup: true },
    { name: "Subscriptions", rollup: false },
    { name: "Shopping", rollup: false },
  ];

  const rows: BudgetRow[] = [];
  const monthStrs = months.map((m) => `${m.year}-${String(m.month).padStart(2, "0")}`);

  for (const { name, rollup } of budgetedCategories) {
    // Compute spend per month
    const monthlySpend = monthStrs.map((m) =>
      rollup ? rollupSpend(name, m) : (spendByCatMonth.get(`${name}|${m}`) ?? 0)
    );

    // Average across all months
    const avg = monthlySpend.reduce((a, b) => a + b, 0) / monthlySpend.length;
    const baseBudget = roundTo25(avg);

    for (const monthStr of monthStrs) {
      // December gets a ~20% uplift for Food & Drink and Entertainment (holiday season)
      const isDecember = monthStr.endsWith("-12");
      const isHolidayCategory =
        name === "Food & Drink" || name === "Dining" || name === "Entertainment";
      const amount = isDecember && isHolidayCategory ? roundTo25(baseBudget * 1.2) : baseBudget;

      rows.push({
        categoryId: catIds[name],
        month: monthStr,
        amount,
      });
    }
  }

  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

  console.log("Seeding categories...");

  // Insert parents first
  for (const cat of PARENT_CATEGORIES) {
    await db.insert(categories).values(cat).onConflictDoNothing();
  }

  // Build parent name → id map
  const parentRows = await db.select().from(categories);
  const parentIdMap: Record<string, number> = {};
  for (const c of parentRows) parentIdMap[c.name] = c.id;

  // Insert children with parentId
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

  // ── Budgets ──────────────────────────────────────────────────────────────
  console.log("Generating budgets...");
  const budgetRows = generateBudgets(allTxs, catIds, months);
  for (const row of budgetRows) {
    await db.insert(budgets).values(row);
  }
  console.log(`  ${budgetRows.length} budget entries across ${months.length} months.`);

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
