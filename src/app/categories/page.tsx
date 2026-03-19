import { getCategoryService, getReportService } from "@/lib/api/services";
import { CategoriesClient } from "@/components/categories/categories-client";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function CategoriesPage(): React.ReactElement {
  const categoryService = getCategoryService();
  const reportService = getReportService();
  const categories = categoryService.getAll();
  const { items: stats } = reportService.getBudgetStats({
    month: getCurrentMonth(),
    type: "expense",
    includeZeroSpend: true,
    includeUncategorized: false,
  });

  return <CategoriesClient initialCategories={categories} initialStats={stats} />;
}
