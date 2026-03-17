import { ArrowLeftRight } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function TransactionsPage(): React.ReactElement {
  return (
    <EmptyState
      icon={<ArrowLeftRight />}
      title="Transactions"
      description="Transaction management coming soon."
    />
  );
}
