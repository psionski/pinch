import { getPortfolioService, getPortfolioReportService } from "@/lib/api/services";
import {
  PortfolioReportsClient,
  type PortfolioReportsData,
} from "@/components/portfolio/portfolio-reports-client";
import { getCurrentMonthInfo } from "@/lib/date-ranges";

const DEFAULT_WINDOW = "6m" as const;

export default function PortfolioReportsPage(): React.ReactElement {
  const reportService = getPortfolioReportService();
  const portfolio = getPortfolioService().getPortfolio();
  const { currentMonth } = getCurrentMonthInfo();

  const netWorth = reportService.getNetWorthTimeSeries(DEFAULT_WINDOW, "monthly");
  const performance = reportService.getAssetPerformance();
  const allocation = reportService.getAllocation();
  const currencyExposure = reportService.getCurrencyExposure();
  const realizedPnl = reportService.getRealizedPnL();
  const transferSummary = reportService.getTransferSummary(currentMonth);

  const initialData: PortfolioReportsData = {
    netWorth,
    performance,
    allocation,
    currencyExposure,
    realizedPnl,
    transferSummary,
    unrealizedPnl: portfolio.pnl,
  };

  return (
    <PortfolioReportsClient
      initialData={initialData}
      initialWindow={DEFAULT_WINDOW}
      currentMonth={currentMonth}
    />
  );
}
