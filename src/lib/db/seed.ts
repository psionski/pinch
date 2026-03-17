import { getDb } from "./index";
import { categories, transactions } from "./schema";

const DEFAULT_CATEGORIES = [
  { name: "Groceries", icon: "🛒", color: "#4ade80" },
  { name: "Rent", icon: "🏠", color: "#60a5fa" },
  { name: "Utilities", icon: "💡", color: "#facc15" },
  { name: "Transport", icon: "🚗", color: "#f97316" },
  { name: "Entertainment", icon: "🎬", color: "#a78bfa" },
  { name: "Dining", icon: "🍽️", color: "#fb7185" },
  { name: "Health", icon: "❤️", color: "#f43f5e" },
  { name: "Shopping", icon: "🛍️", color: "#e879f9" },
  { name: "Subscriptions", icon: "📱", color: "#38bdf8" },
  { name: "Income", icon: "💰", color: "#34d399" },
  { name: "Other", icon: "📦", color: "#94a3b8" },
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

const LUNCH_SPOTS = ["Pret A Manger", "Subway", "Burger King", "Nando's", "Wagamama", "Leon", "Five Guys"];
const DINNER_SPOTS = ["Pizza Express", "La Piazza", "Wagamama", "The Ivy Café", "Bella Italia", "Zizzi", "Dishoom", "Nando's"];

const TRANSPORT_MERCHANTS = ["BVG", "Uber", "Deutsche Bahn", "FlixBus"];

const SHOPPING_MERCHANTS = ["Amazon", "Zara", "H&M", "Decathlon", "MediaMarkt", "IKEA", "Primark", "Uniqlo"];
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
const HEALTH_DESCS = ["Pharmacy purchase", "Vitamins & supplements", "Prescription", "First aid supplies", "Skincare"];

const ENTERTAINMENT_MERCHANTS = ["Cinema City", "Steam", "Eventbrite", "Airbnb Experiences", "Bowling World"];
const ENTERTAINMENT_DESCS = ["Movie tickets", "Game purchase", "Event tickets", "Weekend activity", "Concert"];

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
      tryAdd({ amount: 75000, type: "expense", description: "Monthly rent", merchant: "Landlord", categoryId: catIds.Rent, date, tags: ["housing", "rent"] });
      tryAdd({ amount: 1599, type: "expense", description: "Netflix Standard", merchant: "Netflix", categoryId: catIds.Subscriptions, date, tags: ["subscription", "streaming"] });
      tryAdd({ amount: 899, type: "expense", description: "Amazon Prime", merchant: "Amazon", categoryId: catIds.Subscriptions, date, tags: ["subscription"] });
    }

    if (day === 5) {
      tryAdd({ amount: 999, type: "expense", description: "Spotify Premium", merchant: "Spotify", categoryId: catIds.Subscriptions, date, tags: ["subscription", "music"] });
    }

    if (day === 10) {
      tryAdd({ amount: 99, type: "expense", description: "iCloud+ 50GB", merchant: "Apple", categoryId: catIds.Subscriptions, date, tags: ["subscription"] });
    }

    if (day === 15) {
      tryAdd({ amount: 2999, type: "expense", description: "Internet bill", merchant: "Telekom", categoryId: catIds.Utilities, date, tags: ["bills", "internet"] });
    }

    if (day === 20) {
      tryAdd({ amount: rand(4500, 5800), type: "expense", description: "Electricity bill", merchant: "Vattenfall", categoryId: catIds.Utilities, date, tags: ["bills", "electricity"] });
    }

    if (day === 25) {
      tryAdd({ amount: 200000, type: "income", description: "Monthly salary", merchant: "Employer", categoryId: catIds.Income, date, tags: ["salary"] });
    }

    // ── Groceries — one trip every 5–8 days ───────────────────────────────

    if (day - lastGroceryDay >= rand(5, 8)) {
      tryAdd({ amount: rand(3500, 9500), type: "expense", description: "Grocery run", merchant: pick(GROCERY_STORES), categoryId: catIds.Groceries, date, tags: ["groceries"] });
      lastGroceryDay = day;
    }

    // ── Stochastic daily events ───────────────────────────────────────────

    // Coffee
    if (chance(weekend ? 0.40 : 0.55)) {
      tryAdd({ amount: rand(280, 450), type: "expense", description: pick(COFFEE_ORDERS), merchant: pick(COFFEE_SHOPS), categoryId: catIds.Dining, date, tags: ["coffee"] });
    }

    // Lunch
    if (chance(weekend ? 0.20 : 0.35)) {
      tryAdd({ amount: rand(900, 1800), type: "expense", description: "Lunch", merchant: pick(LUNCH_SPOTS), categoryId: catIds.Dining, date, tags: ["lunch"] });
    }

    // Dinner out
    if (chance(weekend ? 0.30 : 0.15)) {
      tryAdd({ amount: rand(1800, 5500), type: "expense", description: "Dinner", merchant: pick(DINNER_SPOTS), categoryId: catIds.Dining, date, tags: ["dining"] });
    }

    // Transport
    if (chance(weekend ? 0.20 : 0.60)) {
      const merchant = pick(TRANSPORT_MERCHANTS);
      const amount =
        merchant === "BVG" ? 290 :
        merchant === "Uber" ? rand(800, 2500) :
        merchant === "Deutsche Bahn" ? rand(1500, 8500) :
        rand(1200, 3500); // FlixBus
      tryAdd({ amount, type: "expense", description: "Travel", merchant, categoryId: catIds.Transport, date, tags: ["transport"] });
    }

    // Entertainment
    if (chance(weekend ? 0.18 : 0.06)) {
      tryAdd({ amount: rand(1200, 4500), type: "expense", description: pick(ENTERTAINMENT_DESCS), merchant: pick(ENTERTAINMENT_MERCHANTS), categoryId: catIds.Entertainment, date, tags: ["entertainment"] });
    }

    // Shopping
    if (chance(0.09)) {
      tryAdd({ amount: rand(1500, 14000), type: "expense", description: pick(SHOPPING_DESCS), merchant: pick(SHOPPING_MERCHANTS), categoryId: catIds.Shopping, date, tags: ["shopping"] });
    }

    // Health / pharmacy
    if (chance(0.04)) {
      tryAdd({ amount: rand(500, 3500), type: "expense", description: pick(HEALTH_DESCS), merchant: pick(HEALTH_MERCHANTS), categoryId: catIds.Health, date, tags: ["health"] });
    }
  }

  return { txs, balance: bal };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  const db = getDb();

  console.log("Seeding categories...");
  for (const cat of DEFAULT_CATEGORIES) {
    await db.insert(categories).values(cat).onConflictDoNothing();
  }
  console.log(`  ${DEFAULT_CATEGORIES.length} categories ready.`);

  const cats = await db.select().from(categories);
  const catIds: Record<string, number> = {};
  for (const c of cats) catIds[c.name] = c.id;

  console.log("Clearing existing transactions...");
  await db.delete(transactions);

  console.log("Generating 3 months of transactions (Jan–Mar 2026)...");

  const months = [
    { year: 2026, month: 1, lastDay: 31 },
    { year: 2026, month: 2, lastDay: 28 },
    { year: 2026, month: 3, lastDay: 17 }, // up to today
  ];

  let balance = 200000; // start with €2 000 (previous month's salary)
  const allTxs: TxInput[] = [];

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
