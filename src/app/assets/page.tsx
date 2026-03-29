export const dynamic = "force-dynamic";

import { requireTimezone } from "@/lib/api/require-timezone";
import { getAssetService, getPortfolioService } from "@/lib/api/services";
import { AssetsClient } from "@/components/assets/assets-client";

export default function AssetsPage(): React.ReactElement {
  requireTimezone();
  const assets = getAssetService().list();
  const portfolio = getPortfolioService().getPortfolio();

  return <AssetsClient initialAssets={assets} portfolio={portfolio} />;
}
