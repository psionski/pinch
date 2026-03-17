import { Repeat } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function RecurringPage(): React.ReactElement {
  return (
    <EmptyState
      icon={<Repeat />}
      title="Recurring"
      description="Recurring transaction management coming soon."
    />
  );
}
