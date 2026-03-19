import { getDb } from "@/lib/db";
import { TransactionService } from "@/lib/services/transactions";
import { CategoryService } from "@/lib/services/categories";
import { ReportService } from "@/lib/services/reports";
import { BudgetService } from "@/lib/services/budgets";
import { RecurringService } from "@/lib/services/recurring";

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
