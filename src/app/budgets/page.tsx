import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function BudgetsPage(): React.ReactElement {
  return (
    <EmptyState icon={<Wallet />} title="Budgets" description="Budget tracking coming soon." />
  );
}
