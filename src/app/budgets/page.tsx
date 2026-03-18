import { getBudgetService, getCategoryService } from "@/lib/api/services";
import { BudgetsClient } from "@/components/budgets/budgets-client";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetsPage(): React.ReactElement {
  const currentMonth = getCurrentMonth();
  const budgetStatus = getBudgetService().getForMonth({ month: currentMonth });
  const categories = getCategoryService().getAll();

  return (
    <BudgetsClient
      initialBudgetStatus={budgetStatus}
      initialCategories={categories}
      currentMonth={currentMonth}
    />
  );
}
