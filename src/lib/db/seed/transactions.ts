import { pick, rand, chance, isoDate, daysInMonth, isWeekend } from "./rng";
import {
  COFFEE_SHOPS,
  COFFEE_ORDERS,
  GROCERY_STORES,
  LUNCH_SPOTS,
  DINNER_SPOTS,
  TRANSPORT_MERCHANTS,
  SHOPPING_MERCHANTS,
  SHOPPING_DESCS,
  HEALTH_MERCHANTS,
  HEALTH_DESCS,
  ENTERTAINMENT_MERCHANTS,
  ENTERTAINMENT_DESCS,
} from "./data";

export interface TxInput {
  amount: number;
  type: "income" | "expense";
  description: string;
  merchant?: string;
  categoryId: number;
  date: string;
  tags: string[];
  recurringId?: number;
}

export function generateMonth(
  year: number,
  month: number,
  endDay: number,
  catIds: Record<string, number>,
  startBalance: number,
  recurringIds?: Record<string, number>
): { txs: TxInput[]; balance: number } {
  const txs: TxInput[] = [];
  let bal = startBalance;

  const recId = (desc: string): number | undefined => recurringIds?.[desc];

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
        amount: 750,
        type: "expense",
        description: "Monthly rent",
        merchant: "Landlord",
        categoryId: catIds.Rent,
        date,
        tags: ["housing", "rent"],
        recurringId: recId("Monthly rent"),
      });
      tryAdd({
        amount: 15.99,
        type: "expense",
        description: "Netflix Standard",
        merchant: "Netflix",
        categoryId: catIds.Subscriptions,
        date,
        tags: ["subscription", "streaming"],
        recurringId: recId("Netflix Standard"),
      });
      tryAdd({
        amount: 8.99,
        type: "expense",
        description: "Amazon Prime",
        merchant: "Amazon",
        categoryId: catIds.Subscriptions,
        date,
        tags: ["subscription"],
        recurringId: recId("Amazon Prime"),
      });
    }

    if (day === 5) {
      tryAdd({
        amount: 9.99,
        type: "expense",
        description: "Spotify Premium",
        merchant: "Spotify",
        categoryId: catIds.Subscriptions,
        date,
        tags: ["subscription", "music"],
        recurringId: recId("Spotify Premium"),
      });
    }

    if (day === 10) {
      tryAdd({
        amount: 0.99,
        type: "expense",
        description: "iCloud+ 50GB",
        merchant: "Apple",
        categoryId: catIds.Subscriptions,
        date,
        tags: ["subscription"],
        recurringId: recId("iCloud+ 50GB"),
      });
    }

    if (day === 15) {
      tryAdd({
        amount: 29.99,
        type: "expense",
        description: "Internet bill",
        merchant: "Telekom",
        categoryId: catIds.Utilities,
        date,
        tags: ["bills", "internet"],
        recurringId: recId("Internet bill"),
      });
    }

    if (day === 20) {
      tryAdd({
        amount: rand(4500, 5800) / 100,
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
        amount: 2800,
        type: "income",
        description: "Monthly salary",
        merchant: "Employer",
        categoryId: catIds.Income,
        date,
        tags: ["salary"],
        recurringId: recId("Monthly salary"),
      });
    }

    // ── Groceries — one trip every 5–8 days ───────────────────────────────

    if (day - lastGroceryDay >= rand(5, 8)) {
      tryAdd({
        amount: rand(3500, 9500) / 100,
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
        amount: rand(280, 450) / 100,
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
        amount: rand(900, 1800) / 100,
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
        amount: rand(1800, 5500) / 100,
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
          ? 2.9
          : merchant === "Uber"
            ? rand(800, 2500) / 100
            : merchant === "Deutsche Bahn"
              ? rand(1500, 8500) / 100
              : rand(1200, 3500) / 100; // FlixBus
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
        amount: rand(1200, 4500) / 100,
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
        amount: rand(1500, 14000) / 100,
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
        amount: rand(500, 3500) / 100,
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
