import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function ReportsPage(): React.ReactElement {
  return (
    <EmptyState
      icon={<BarChart3 />}
      title="Reports"
      description="Reports and analytics coming soon."
    />
  );
}
