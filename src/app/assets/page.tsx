import { getAssetService } from "@/lib/api/services";
import { AssetsClient } from "@/components/assets/assets-client";

export default function AssetsPage(): React.ReactElement {
  const assets = getAssetService().list();
  return <AssetsClient initialAssets={assets} />;
}
