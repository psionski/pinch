import { getBudgetService, getCategoryService } from "@/lib/api/services";
import { BudgetsClient } from "@/components/budgets/budgets-client";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetsPage(): React.ReactElement {
  const currentMonth = getCurrentMonth();
  const { items: budgetStatus, inheritedFrom } = getBudgetService().getForMonth({
    month: currentMonth,
  });
  const categories = getCategoryService().getAll();

  return (
    <BudgetsClient
      initialBudgetStatus={budgetStatus}
      initialInheritedFrom={inheritedFrom}
      initialCategories={categories}
      currentMonth={currentMonth}
    />
  );
}
