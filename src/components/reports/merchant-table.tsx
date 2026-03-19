"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { TopMerchant } from "@/lib/validators/reports";

interface MerchantTableProps {
  data: TopMerchant[];
}

export function MerchantTable({ data }: MerchantTableProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Merchants</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Avg Transaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.merchant}>
                  <TableCell className="font-medium">{m.merchant}</TableCell>
                  <TableCell className="text-right">{formatCurrency(m.total)}</TableCell>
                  <TableCell className="text-right">{m.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(m.avgAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">
            No merchant data for this period.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
