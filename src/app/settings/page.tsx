export const dynamic = "force-dynamic";

import { getSettingsService } from "@/lib/api/services";
import { listBackups } from "@/lib/services/backup";
import { SettingsClient } from "@/components/settings/settings-client";

export default function SettingsPage(): React.ReactElement {
  const timezone = getSettingsService().getTimezone();
  const backups = listBackups();

  return <SettingsClient initialTimezone={timezone} initialBackups={backups} />;
}
