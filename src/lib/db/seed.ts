import { getDb } from "./index";
import { categories } from "./schema";

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

async function seed(): Promise<void> {
  const db = getDb();

  console.log("Seeding default categories...");

  for (const category of DEFAULT_CATEGORIES) {
    await db
      .insert(categories)
      .values(category)
      .onConflictDoNothing();
  }

  console.log(`Seeded ${DEFAULT_CATEGORIES.length} categories.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
