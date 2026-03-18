// ─── Category definitions ────────────────────────────────────────────────────

export const PARENT_CATEGORIES = [
  { name: "Food & Drink", icon: "🍴", color: "#fb7185" },
  { name: "Housing", icon: "🏠", color: "#60a5fa" },
  { name: "Transport", icon: "🚗", color: "#f97316" },
  { name: "Entertainment", icon: "🎬", color: "#a78bfa" },
  { name: "Health", icon: "❤️", color: "#f43f5e" },
  { name: "Shopping", icon: "🛍️", color: "#e879f9" },
  { name: "Income", icon: "💰", color: "#34d399" },
  { name: "Other", icon: "📦", color: "#94a3b8" },
];

export const CHILD_CATEGORIES: Array<{
  name: string;
  icon: string;
  color: string;
  parentName: string;
}> = [
  { name: "Groceries", icon: "🛒", color: "#4ade80", parentName: "Food & Drink" },
  { name: "Dining", icon: "🍽️", color: "#fb923c", parentName: "Food & Drink" },
  { name: "Coffee", icon: "☕", color: "#a16207", parentName: "Food & Drink" },
  { name: "Rent", icon: "🔑", color: "#3b82f6", parentName: "Housing" },
  { name: "Utilities", icon: "💡", color: "#facc15", parentName: "Housing" },
  { name: "Subscriptions", icon: "📱", color: "#38bdf8", parentName: "Entertainment" },
];

// ─── Merchant / description pools ────────────────────────────────────────────

export const COFFEE_SHOPS = [
  "Costa Coffee",
  "Starbucks",
  "Café Nero",
  "The Coffee House",
  "Café Central",
];
export const COFFEE_ORDERS = ["Flat white", "Cappuccino", "Americano", "Latte", "Espresso"];

export const GROCERY_STORES = ["Lidl", "Aldi", "Rewe", "Kaufland", "Edeka"];

export const LUNCH_SPOTS = [
  "Pret A Manger",
  "Subway",
  "Burger King",
  "Nando's",
  "Wagamama",
  "Leon",
  "Five Guys",
];
export const DINNER_SPOTS = [
  "Pizza Express",
  "La Piazza",
  "Wagamama",
  "The Ivy Café",
  "Bella Italia",
  "Zizzi",
  "Dishoom",
  "Nando's",
];

export const TRANSPORT_MERCHANTS = ["BVG", "Uber", "Deutsche Bahn", "FlixBus"];

export const SHOPPING_MERCHANTS = [
  "Amazon",
  "Zara",
  "H&M",
  "Decathlon",
  "MediaMarkt",
  "IKEA",
  "Primark",
  "Uniqlo",
];
export const SHOPPING_DESCS = [
  "Online order",
  "Clothing",
  "Home essentials",
  "Sports gear",
  "Electronics",
  "Household items",
  "Books",
];

export const HEALTH_MERCHANTS = ["dm", "Rossmann", "Apotheke am Ring", "DocMorris"];
export const HEALTH_DESCS = [
  "Pharmacy purchase",
  "Vitamins & supplements",
  "Prescription",
  "First aid supplies",
  "Skincare",
];

export const ENTERTAINMENT_MERCHANTS = [
  "Cinema City",
  "Steam",
  "Eventbrite",
  "Airbnb Experiences",
  "Bowling World",
];
export const ENTERTAINMENT_DESCS = [
  "Movie tickets",
  "Game purchase",
  "Event tickets",
  "Weekend activity",
  "Concert",
];
