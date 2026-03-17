import {
  getReportService,
  getBudgetService,
  getTransactionService,
  getCategoryService,
} from "@/lib/api/services";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SpendingTrendChart } from "@/components/dashboard/spending-trend-chart";
import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

function getCurrentMonth(): { monthStart: string; monthEnd: string; currentMonth: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonth = `${year}-${String(month).padStart(2, "0")}`;
  const monthStart = `${currentMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;
  return { monthStart, monthEnd, currentMonth };
}

function getPreviousMonth(currentMonth: string): { prevMonthStart: string; prevMonthEnd: string } {
  const [year, month] = currentMonth.split("-").map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  const prevMonthStart = `${prevMonthStr}-01`;
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
  const prevMonthEnd = `${prevMonthStr}-${String(prevLastDay).padStart(2, "0")}`;
  return { prevMonthStart, prevMonthEnd };
}

export default function DashboardPage(): React.ReactElement {
  const reportService = getReportService();
  const budgetService = getBudgetService();
  const transactionService = getTransactionService();
  const categoryService = getCategoryService();

  const { monthStart, monthEnd, currentMonth } = getCurrentMonth();
  const { prevMonthStart, prevMonthEnd } = getPreviousMonth(currentMonth);

  const summary = reportService.spendingSummary({
    dateFrom: monthStart,
    dateTo: monthEnd,
    groupBy: "category",
    type: "expense",
    compareDateFrom: prevMonthStart,
    compareDateTo: prevMonthEnd,
  });

  const breakdown = reportService.categoryBreakdown({
    dateFrom: monthStart,
    dateTo: monthEnd,
    type: "expense",
  });

  const trends = reportService.trends({ months: 6, type: "expense" });

  const budgetStatus = budgetService.getForMonth({ month: currentMonth });

  const recentTx = transactionService.list({
    limit: 15,
    offset: 0,
    sortBy: "date",
    sortOrder: "desc",
  });

  const allCategories = categoryService.getAll();
  const categoryMap = new Map<number, CategoryWithCountResponse>(
    allCategories.map((c) => [c.id, c])
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <KpiCards summary={summary} budgetStatus={budgetStatus} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpendingTrendChart data={trends} />
        <CategoryDonutChart data={breakdown} />
      </div>

      <RecentTransactions transactions={recentTx.data} categories={categoryMap} />
    </div>
  );
}
