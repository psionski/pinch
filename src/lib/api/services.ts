import { getDb } from "@/lib/db";
import { TransactionService } from "@/lib/services/transactions";
import { CategoryService } from "@/lib/services/categories";
import { ReportService } from "@/lib/services/reports";
import { BudgetService } from "@/lib/services/budgets";
import { RecurringService } from "@/lib/services/recurring";
import { ReceiptService } from "@/lib/services/receipts";
import { SettingsService } from "@/lib/services/settings";
import { FinancialDataService } from "@/lib/services/financial-data";

export function getTransactionService(): TransactionService {
  return new TransactionService(getDb());
}

export function getCategoryService(): CategoryService {
  return new CategoryService(getDb());
}

export function getReportService(): ReportService {
  return new ReportService(getDb());
}

export function getBudgetService(): BudgetService {
  const db = getDb();
  return new BudgetService(db, new ReportService(db));
}

export function getRecurringService(): RecurringService {
  return new RecurringService(getDb());
}

export function getReceiptService(): ReceiptService {
  return new ReceiptService(getDb());
}

export function getSettingsService(): SettingsService {
  return new SettingsService(getDb());
}

export function getFinancialDataService(): FinancialDataService {
  const db = getDb();
  return new FinancialDataService(db, new SettingsService(db));
}
