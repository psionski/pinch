export const dynamic = "force-dynamic";

import { getSettingsService } from "@/lib/api/services";
import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage(): React.ReactElement {
  const timezone = getSettingsService().getTimezone();

  return <SettingsClient initialTimezone={timezone} />;
}
