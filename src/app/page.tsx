import {
  getReportService,
  getBudgetService,
  getTransactionService,
  getCategoryService,
  getRecurringService,
  getPortfolioService,
} from "@/lib/api/services";
import { getCurrentMonthInfo, getPreviousMonthRange } from "@/lib/date-ranges";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SpendingTrendChart } from "@/components/charts/spending-trend-chart";
import { CategoryDonutChart } from "@/components/charts/category-donut-chart";
import { BudgetAlerts } from "@/components/dashboard/budget-alerts";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { UpcomingRecurring } from "@/components/dashboard/upcoming-recurring";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

export default function DashboardPage(): React.ReactElement {
  const reportService = getReportService();
  const budgetService = getBudgetService();
  const transactionService = getTransactionService();
  const categoryService = getCategoryService();

  const { monthStart, monthEnd, currentMonth, monthLabel } = getCurrentMonthInfo();
  const { prevMonthStart, prevMonthEnd } = getPreviousMonthRange(currentMonth);

  const summary = reportService.spendingSummary({
    dateFrom: monthStart,
    dateTo: monthEnd,
    groupBy: "category",
    type: "expense",
    compareDateFrom: prevMonthStart,
    compareDateTo: prevMonthEnd,
  });

  const breakdown = reportService.getCategoryStats({
    dateFrom: monthStart,
    dateTo: monthEnd,
    type: "expense",
    includeZeroSpend: false,
    includeUncategorized: true,
  });

  const trends = reportService.trends({ months: 6, type: "expense" });

  const { items: budgetStatus } = budgetService.getForMonth({ month: currentMonth });

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

  const portfolio = getPortfolioService().getPortfolio();

  const allRecurring = getRecurringService().list();
  const upcomingRecurring = allRecurring
    .filter((r) => r.isActive === 1 && r.nextOccurrence !== null)
    .sort((a, b) => a.nextOccurrence!.localeCompare(b.nextOccurrence!))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>

      <KpiCards summary={summary} budgetStatus={budgetStatus} />

      <NetWorthCard portfolio={portfolio} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpendingTrendChart data={trends} />
        <CategoryDonutChart data={breakdown} monthLabel={monthLabel} />
      </div>

      <BudgetAlerts budgetStatus={budgetStatus} />

      <UpcomingRecurring items={upcomingRecurring} />

      <RecentTransactions transactions={recentTx.data} categories={categoryMap} />
    </div>
  );
}
