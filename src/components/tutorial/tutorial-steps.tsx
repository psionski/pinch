import type { Step } from "react-joyride";

export interface TutorialStep extends Step {
  page: string;
  navigateTo?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────
  {
    target: '[data-tutorial="dashboard-title"]',
    content:
      "Welcome to Pinch! This is your dashboard \u2014 a snapshot of your finances at a glance. " +
      "Let\u2019s take a quick tour to show you around.",
    placement: "bottom",
    skipBeacon: true,
    page: "/",
  },
  {
    target: '[data-tutorial="sidebar"]',
    content:
      "This is the sidebar. Use it to navigate between sections: " +
      "Transactions, Recurring, Budgets, Categories, Assets, and Reports.",
    placement: "right",
    skipBeacon: true,
    page: "/",
  },
  {
    target: '[data-tutorial="kpi-cards"]',
    content:
      "These cards show your key metrics for the current month: income, spending, " +
      "savings rate, and budget health.",
    placement: "bottom",
    skipBeacon: true,
    page: "/",
  },
  {
    target: '[data-tutorial="spending-section"]',
    content:
      "The spending section shows your expense trends over time and a category breakdown " +
      "so you can see where your money goes.",
    placement: "top",
    skipBeacon: true,
    page: "/",
  },
  {
    target: '[data-tutorial="nav-transactions"]',
    content: "Now let\u2019s look at your transactions. Click Transactions to continue.",
    placement: "right",
    skipBeacon: true,
    blockTargetInteraction: false,
    page: "/",
    navigateTo: "/transactions",
  },

  // ── Transactions ───────────────────────────────────────────────────────
  {
    target: '[data-tutorial="transactions-header"]',
    content:
      "This is the Transactions page. Here you can view, add, edit, and delete all your transactions.",
    placement: "bottom",
    skipBeacon: true,
    page: "/transactions",
  },
  {
    target: '[data-tutorial="add-transaction-btn"]',
    content:
      "Click this button to add a new transaction. Try it out \u2014 this is sample data, " +
      "so feel free to experiment. You can clear everything later from Settings.",
    placement: "bottom",
    skipBeacon: true,
    blockTargetInteraction: false,
    page: "/transactions",
  },
  {
    target: '[data-tutorial="transaction-filters"]',
    content:
      "Use these filters to search and narrow down transactions by date, category, " +
      "amount, type, and more.",
    placement: "bottom",
    skipBeacon: true,
    page: "/transactions",
  },
  {
    target: '[data-tutorial="nav-categories"]',
    content: "Next, let\u2019s see how categories work. Click Categories to continue.",
    placement: "right",
    skipBeacon: true,
    blockTargetInteraction: false,
    page: "/transactions",
    navigateTo: "/categories",
  },

  // ── Categories ─────────────────────────────────────────────────────────
  {
    target: '[data-tutorial="categories-header"]',
    content:
      "Categories organize your transactions. They support nesting \u2014 " +
      'for example, "Coffee" can be a subcategory of "Food & Drink".',
    placement: "bottom",
    skipBeacon: true,
    page: "/categories",
  },
  {
    target: '[data-tutorial="category-tree"]',
    content:
      "This tree view shows all your categories with their spending totals. " +
      "You can edit, merge, or delete categories from here.",
    placement: "top",
    skipBeacon: true,
    page: "/categories",
  },
  {
    target: '[data-tutorial="nav-budgets"]',
    content: "Now let\u2019s check your budgets. Click Budgets to continue.",
    placement: "right",
    skipBeacon: true,
    blockTargetInteraction: false,
    page: "/categories",
    navigateTo: "/budgets",
  },

  // ── Budgets ────────────────────────────────────────────────────────────
  {
    target: '[data-tutorial="budgets-header"]',
    content:
      "Budgets let you set spending limits per category for each month. " +
      "They inherit forward, so you only set them once.",
    placement: "bottom",
    skipBeacon: true,
    page: "/budgets",
  },
  {
    target: '[data-tutorial="budget-table"]',
    content:
      "This table shows your budget vs actual spending for each category. " +
      "The progress bars turn red when you\u2019re over budget.",
    placement: "top",
    skipBeacon: true,
    page: "/budgets",
  },

  // ── MCP hint ───────────────────────────────────────────────────────────
  {
    target: "body",
    placement: "center",
    skipBeacon: true,
    page: "/budgets",
    content: "", // Content is set dynamically in the overlay to include the origin URL
    data: { isMcpHint: true },
  },
];
