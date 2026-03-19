import { getReportService, getCategoryService } from "@/lib/api/services";
import { ReportsClient, type ReportsData } from "@/components/reports/reports-client";

function getDefaultDateRange(): {
  dateFrom: string;
  dateTo: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

function getPreviousPeriod(dateFrom: string, dateTo: string): { prevFrom: string; prevTo: string } {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  const toIso = (d: Date): string => d.toISOString().slice(0, 10);
  return { prevFrom: toIso(prevFrom), prevTo: toIso(prevTo) };
}

export default function ReportsPage(): React.ReactElement {
  const reportService = getReportService();
  const categoryService = getCategoryService();

  const { dateFrom, dateTo } = getDefaultDateRange();
  const { prevFrom, prevTo } = getPreviousPeriod(dateFrom, dateTo);

  const balance = reportService.netBalance({ dateFrom, dateTo });
  const incomeTrend = reportService.trends({ months: 6, type: "income" });
  const expenseTrend = reportService.trends({ months: 6, type: "expense" });
  const summary = reportService.spendingSummary({
    dateFrom,
    dateTo,
    groupBy: "category",
    type: "expense",
    compareDateFrom: prevFrom,
    compareDateTo: prevTo,
  });
  const topMerchants = reportService.topMerchants({
    dateFrom,
    dateTo,
    type: "expense",
    limit: 10,
  });
  const categories = categoryService.getAll();

  const initialData: ReportsData = {
    balance,
    incomeTrend,
    expenseTrend,
    spendingTrend: expenseTrend,
    summary,
    topMerchants,
  };

  return (
    <ReportsClient
      initialData={initialData}
      initialDateRange={{ dateFrom, dateTo }}
      categories={categories}
    />
  );
}
