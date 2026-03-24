import type { Step } from "react-joyride";

export interface TutorialStepData {
  /** This step's "Next" opens a dialog; clicking the target also opens it */
  opensDialog?: boolean;
  /** This step targets an element inside an open dialog */
  insideDialog?: boolean;
  /** MCP hint step — content is injected dynamically */
  isMcpHint?: boolean;
}

export interface TutorialStep extends Step {
  /** Which pathname this step belongs to */
  page: string;
  /** When clicking Next, navigate to this path (for sidebar-link steps) */
  navigateTo?: string;
  data?: TutorialStepData;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────
  {
    target: '[data-tutorial="dashboard-title"]',
    content:
      "Welcome to Pinch! This is your dashboard — a snapshot of your finances at a glance. " +
      "Let's take a quick tour to show you around.",
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
    content: "Now let's look at your transactions. Click Transactions to continue.",
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
    targetWaitTimeout: 3000,
    page: "/transactions",
  },
  {
    target: '[data-tutorial="add-transaction-btn"]',
    content:
      "This is how you add a new transaction. Click the button or click Next to see the form.",
    placement: "bottom",
    skipBeacon: true,
    blockTargetInteraction: false,
    page: "/transactions",
    data: { opensDialog: true },
  },
  {
    target: '[data-tutorial="transaction-dialog"]',
    content:
      "This is the transaction form. Pick a type (expense or income), enter an amount, " +
      "description, merchant, and category. This is sample data, so feel free to " +
      "experiment after the tour — you can clear everything later from Settings. " +
      "Click Next when you're ready to continue.",
    placement: "left",
    skipBeacon: true,
    page: "/transactions",
    data: { insideDialog: true },
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
    content: "Next, let's see how categories work. Click Categories to continue.",
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
      "Categories organize your transactions. They support nesting — " +
      'for example, "Coffee" can be a subcategory of "Food & Drink".',
    placement: "bottom",
    skipBeacon: true,
    targetWaitTimeout: 3000,
    page: "/categories",
  },
  {
    target: '[data-tutorial="categories-header"]',
    spotlightTarget: '[data-tutorial="category-tree"]',
    content:
      "This tree view shows all your categories with their spending totals. " +
      "You can edit, merge, or delete categories from here.",
    placement: "bottom",
    skipBeacon: true,
    page: "/categories",
  },
  {
    target: '[data-tutorial="nav-budgets"]',
    content: "Now let's check your budgets. Click Budgets to continue.",
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
    targetWaitTimeout: 3000,
    page: "/budgets",
  },
  {
    target: '[data-tutorial="budget-table"]',
    content:
      "This table shows your budget vs actual spending for each category. " +
      "The progress bars go from green to yellow to red as you approach the limit.",
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
