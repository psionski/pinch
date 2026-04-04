import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ── Building Blocks ──

function PageHeaderSkeleton({
  title,
  buttons = 1,
}: {
  title?: string;
  buttons?: number;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {title ? (
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      ) : (
        <Skeleton className="h-9 w-40" />
      )}
      {buttons > 0 && (
        <div className="flex items-center gap-2">
          {Array.from({ length: buttons }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

function TableHeaderSkeleton({ columns }: { columns: number }): React.ReactElement {
  return (
    <thead>
      <tr className="border-b">
        {Array.from({ length: columns }, (_, i) => (
          <th key={i} className="px-4 py-3">
            <Skeleton className="h-3 w-16" />
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TableRowSkeleton({
  columns,
  widths,
}: {
  columns: number;
  widths?: string[];
}): React.ReactElement {
  const defaultWidths = ["w-20", "w-32", "w-24", "w-16", "w-20"];
  return (
    <tr className="border-b">
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-4 ${widths?.[i] ?? defaultWidths[i % defaultWidths.length]}`} />
        </td>
      ))}
    </tr>
  );
}

function TableSkeleton({
  rows = 5,
  columns = 5,
  widths,
}: {
  rows?: number;
  columns?: number;
  widths?: string[];
}): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full">
        <TableHeaderSkeleton columns={columns} />
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRowSkeleton key={i} columns={columns} widths={widths} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartCardSkeleton(): React.ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  );
}

function MetricCardSkeleton(): React.ReactElement {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4 rounded" />
      </CardHeader>
      <CardContent className="space-y-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-36" />
      </CardContent>
    </Card>
  );
}

// ── Page-Level Skeletons ──

/** Dashboard: KPI cards + charts + alerts + portfolio + recent transactions */
export function DashboardSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-44" />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Spending charts */}
      <section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
      </section>

      {/* Budget alerts + upcoming recurring */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-3 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-2 w-24 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Portfolio row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Card size="sm">
            <CardContent className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-28" />
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mx-auto size-32 rounded-full" />
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="mt-1 h-3 w-40" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Transactions: header + filter bar + table */
export function TransactionsPageSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton title="Transactions" buttons={2} />

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 min-w-0 flex-1 rounded-md sm:min-w-[200px]" />
          <Skeleton className="hidden h-9 w-[120px] sm:block" />
          <Skeleton className="hidden h-9 w-[160px] sm:block" />
        </div>
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-8 w-[150px]" />
          <Skeleton className="h-3 w-4" />
          <Skeleton className="h-8 w-[150px]" />
          <Skeleton className="ml-4 h-3 w-12" />
          <Skeleton className="h-8 w-[100px]" />
          <Skeleton className="h-3 w-4" />
          <Skeleton className="h-8 w-[100px]" />
        </div>
      </div>

      {/* Table: checkbox, date, description, merchant, category, amount, actions */}
      <div>
        <TableSkeleton
          rows={8}
          columns={7}
          widths={["w-4", "w-20", "w-40", "w-24", "w-20", "w-16", "w-8"]}
        />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Budgets: header + month nav + budget rows */
export function BudgetsPageSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton title="Budgets" buttons={1} />

      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="size-8 rounded-md" />
      </div>

      {/* Budget table: category, progress, spent, budget, remaining, status, actions */}
      <div>
        <TableSkeleton
          rows={5}
          columns={7}
          widths={["w-24", "w-32", "w-16", "w-16", "w-16", "w-16", "w-8"]}
        />
      </div>
    </div>
  );
}

/** Categories: header + category tree table */
export function CategoriesPageSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton title="Categories" buttons={1} />

      {/* Category tree table: name, transactions, this month, budget, actions */}
      <div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full">
            <TableHeaderSkeleton columns={5} />
            <tbody>
              {/* Simulate tree with varying indent levels */}
              {[0, 1, 1, 0, 1, 2, 0, 1].map((depth, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-2" style={{ paddingLeft: `${depth * 24 + 8}px` }}>
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="size-4" />
                      <Skeleton className="size-3 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </td>
                  <td className="hidden px-4 py-2 text-right md:table-cell">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Skeleton className="ml-auto h-4 w-16" />
                  </td>
                  <td className="hidden px-4 py-2 md:table-cell">
                    <Skeleton className="h-2 w-20 rounded-full" />
                  </td>
                  <td className="w-[50px] px-4 py-2">
                    <Skeleton className="size-8" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Recurring: header + table */
export function RecurringPageSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton title="Recurring Transactions" buttons={1} />

      {/* Recurring table: description, amount, category, frequency, next, status, actions */}
      <TableSkeleton
        rows={5}
        columns={7}
        widths={["w-32", "w-16", "w-20", "w-16", "w-20", "w-16", "w-8"]}
      />
    </div>
  );
}

/** Assets: header + summary cards + asset cards grid */
export function AssetsPageSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Assets</h1>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {["Net Worth", "Cash Balance", "Total Invested", "Total P&L"].map((label) => (
          <Card key={label} size="sm">
            <CardContent className="space-y-1">
              <span className="text-muted-foreground text-xs">{label}</span>
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Asset cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="size-5 rounded" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Asset detail: back link + header + metrics + chart + lots table */
export function AssetDetailSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Back link + title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="size-9" />
        </div>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {["Holdings", "Cost Basis", "Current Value", "P&L"].map((label) => (
          <Card key={label} size="sm">
            <CardContent className="space-y-1">
              <span className="text-muted-foreground text-xs">{label}</span>
              <Skeleton className="h-7 w-24" />
              {label === "P&L" && <Skeleton className="h-3 w-32" />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <ChartCardSkeleton />

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <span className="text-base font-medium">Transaction History</span>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={4} columns={5} widths={["w-20", "w-16", "w-16", "w-20", "w-16"]} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Cash flow report: header + date filter + charts + table */
export function CashFlowReportSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Cash Flow Report</h1>
      </div>

      {/* Date range presets */}
      <div className="flex flex-wrap gap-1.5">
        {["This Month", "Last 3 Months", "Last 6 Months", "Year to Date", "Custom"].map((label) => (
          <Skeleton
            key={label}
            className="h-8 rounded-md"
            style={{ width: `${label.length * 8 + 24}px` }}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      {/* Merchant table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={5} columns={3} widths={["w-32", "w-16", "w-20"]} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Portfolio report: header + window buttons + charts + table */
export function PortfolioReportSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Portfolio Report</h1>
      </div>

      {/* Window selector buttons */}
      <div className="flex flex-wrap gap-2">
        {["3m", "6m", "12m", "YTD", "All"].map((label) => (
          <Skeleton key={label} className="h-8 w-14 rounded-md" />
        ))}
      </div>

      {/* Net worth chart */}
      <ChartCardSkeleton />

      {/* Allocation + currency exposure */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      {/* Performance table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={4} columns={5} widths={["w-28", "w-16", "w-16", "w-16", "w-20"]} />
        </CardContent>
      </Card>

      {/* P&L summary */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-20" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Settings: timezone section + placeholder sections */
export function SettingsPageSkeleton(): React.ReactElement {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Timezone section */}
      <Card>
        <CardHeader>
          <span className="text-base font-medium">Timezone</span>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-9 w-16" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
