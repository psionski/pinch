export const dynamic = "force-dynamic";

import { requireTimezone } from "@/lib/api/require-timezone";
import {
  getAssetService,
  getPortfolioService,
  getPortfolioReportService,
} from "@/lib/api/services";
import { AssetsClient } from "@/components/assets/assets-client";

export default function AssetsPage(): React.ReactElement {
  requireTimezone();
  const assets = getAssetService().list();
  const portfolio = getPortfolioService().getPortfolio();
  const reportService = getPortfolioReportService();
  const performance = reportService.getAssetPerformance();
  const allocation = reportService.getAllocation();
  const currencyExposure = reportService.getCurrencyExposure();

  return (
    <AssetsClient
      initialAssets={assets}
      portfolio={portfolio}
      performance={performance}
      allocation={allocation}
      currencyExposure={currencyExposure}
    />
  );
}
