export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getTransactionService, getCategoryService } from "@/lib/api/services";
import { TransactionsClient } from "@/components/transactions/transactions-client";

function TransactionsContent(): React.ReactElement {
  const transactionService = getTransactionService();
  const categoryService = getCategoryService();

  const initialData = transactionService.list({
    limit: 50,
    offset: 0,
    sortBy: "date",
    sortOrder: "desc",
  });

  const categories = categoryService.getAll();

  return <TransactionsClient initialData={initialData} categories={categories} />;
}

export default function TransactionsPage(): React.ReactElement {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  );
}
