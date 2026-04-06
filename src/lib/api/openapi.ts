import { createDocument } from "zod-openapi";

import { transactionPaths } from "./openapi/transactions";
import { categoryPaths } from "./openapi/categories";
import { reportPaths } from "./openapi/reports";
import { budgetPaths } from "./openapi/budgets";
import { recurringPaths } from "./openapi/recurring";
import { receiptPaths } from "./openapi/receipts";
import { financialPaths } from "./openapi/financial";
import { assetPaths } from "./openapi/assets";
import { portfolioReportPaths } from "./openapi/portfolio-reports";
import { settingsPaths } from "./openapi/settings";

// ─── Document ───────────────────────────────────────────────────────────────

export function generateOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "Pinch API",
      version: "1.0.0",
      description:
        "Personal finance tracker API. " +
        "Transfer transaction amounts are signed: negative = cash out (asset purchase), positive = cash in (asset sale).",
    },
    tags: [
      { name: "Transactions", description: "Transaction CRUD and listing" },
      { name: "Categories", description: "Category management, recategorize, and merge" },
      { name: "Reports", description: "Spending reports, trends, and breakdowns" },
      { name: "Budgets", description: "Monthly budget management" },
      { name: "Recurring", description: "Recurring transaction templates" },
      { name: "Receipts", description: "Receipt management and image serving" },
      { name: "Financial", description: "Exchange rates, currency conversion, and market prices" },
      {
        name: "Assets",
        description: "Asset and portfolio tracking (savings, investments, crypto)",
      },
      { name: "Settings", description: "App settings (timezone, etc.)" },
      { name: "Backups", description: "Database backup and restore" },
    ],
    paths: {
      ...transactionPaths,
      ...categoryPaths,
      ...reportPaths,
      ...budgetPaths,
      ...recurringPaths,
      ...receiptPaths,
      ...financialPaths,
      ...assetPaths,
      ...portfolioReportPaths,
      ...settingsPaths,
    },
  });
}
