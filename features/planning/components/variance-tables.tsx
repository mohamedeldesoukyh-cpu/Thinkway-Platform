"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { VarianceAnalysis } from "@/lib/planning/types/variance";
import { cn } from "@/lib/utils";

type VarianceTablesProps = {
  topPositive: VarianceAnalysis[];
  topNegative: VarianceAnalysis[];
  clientVariance: VarianceAnalysis[];
  brandVariance: VarianceAnalysis[];
  countryVariance: VarianceAnalysis[];
  global: VarianceAnalysis | null;
};

type VarianceMetric = keyof Pick<
  VarianceAnalysis["variance_amount"],
  "revenue" | "gp" | "collections"
>;

function VarianceTable({
  title,
  rows,
  metric = "revenue",
}: {
  title: string;
  rows: VarianceAnalysis[];
  metric?: VarianceMetric;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border p-4">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-2 text-xs text-muted-foreground">No variance data.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border">
      <p className="border-b border-border px-4 py-2 text-sm font-medium">{title}</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Entity</TableHead>
            <TableHead className="text-right">Budget</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead className="text-right">%</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const amount = row.variance_amount[metric];
            const pct = row.variance_percent[metric as keyof VarianceAnalysis["variance_percent"]];
            const format = (n: number) =>
              formatAnalyticsAmount(n, row.currency, { decimals: 0 });

            return (
              <TableRow key={row.key}>
                <TableCell className="max-w-[180px] truncate">{row.label}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {format(row.budget.revenue_budget)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {format(row.actual.revenue)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono text-xs",
                    amount >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {format(amount)}
                </TableCell>
                <TableCell className="text-right text-xs">{pct.toFixed(1)}%</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function VarianceTables({
  topPositive,
  topNegative,
  clientVariance,
  brandVariance,
  countryVariance,
  global,
}: VarianceTablesProps) {
  return (
    <div className="space-y-4">
      {global ? (
        <div className="grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Budget vs actual</p>
            <p className="text-sm font-medium">
              Revenue variance{" "}
              <span
                className={cn(
                  global.variance_amount.revenue >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                )}
              >
                {formatAnalyticsAmount(
                  global.variance_amount.revenue,
                  global.currency
                )}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GP variance</p>
            <p className="text-sm font-medium">
              {formatAnalyticsAmount(global.variance_amount.gp, global.currency)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collections variance</p>
            <p className="text-sm font-medium">
              {formatAnalyticsAmount(
                global.variance_amount.collections,
                global.currency
              )}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <VarianceTable title="Largest positive variance" rows={topPositive} />
        <VarianceTable title="Largest negative variance" rows={topNegative} />
        <VarianceTable title="Client variance" rows={clientVariance} />
        <VarianceTable title="Brand variance" rows={brandVariance} />
        <VarianceTable title="Country variance" rows={countryVariance} />
      </div>
    </div>
  );
}
