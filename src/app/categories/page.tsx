import { Tags } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export default function CategoriesPage(): React.ReactElement {
  return (
    <EmptyState icon={<Tags />} title="Categories" description="Category management coming soon." />
  );
}
