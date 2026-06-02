"use client";

import { useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createForecastVersionAction } from "@/features/planning/actions";
import type { PlanningPermissions } from "@/features/planning/load-planning-workspace";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { ForecastRollupsResult } from "@/lib/planning/queries/load-forecast-rollups";
import type { ForecastVersion } from "@/lib/planning/types/forecast";
import type { BudgetRollupNode } from "@/lib/planning/budgets/budget-rollups";
import { devLog } from "@/lib/platform/logger";

type ForecastSectionProps = {
  fiscalYear: number;
  forecasts: ForecastVersion[];
  forecastRollups: ForecastRollupsResult | null;
  budgetGlobal: BudgetRollupNode | null;
  permissions: PlanningPermissions;
  selectedForecastId: string | null;
  selectedVersionId: string | null;
};

export function ForecastSection({
  fiscalYear,
  forecasts,
  forecastRollups,
  budgetGlobal,
  permissions,
  selectedForecastId,
  selectedVersionId,
}: ForecastSectionProps) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  const global = forecastRollups?.global;
  const clientNodes = forecastRollups?.nodes ?? [];

  const createForecast = () => {
    startTransition(async () => {
      const result = await createForecastVersionAction({
        name: name || `FY${fiscalYear} Rolling forecast`,
        fiscalYear,
        currencyCode: budgetGlobal?.currency.primary_currency ?? "USD",
        budgetVersionId: selectedVersionId ?? undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Forecast version created.");
      setName("");
      if (process.env.NODE_ENV === "development") {
        devLog("[forecast-dashboard] created via UI", result.forecastId);
      }
    });
  };

  const format = (n: number, ctx = global?.currency) =>
    formatAnalyticsAmount(n, ctx ?? {
      primary_currency: "USD",
      is_mixed_currency: false,
      currencies: ["USD"],
      mixed_label: null,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Forecasting</h3>
          <p className="text-sm text-muted-foreground">
            Rolling forecast vs budget and actual (centralized rollups).
          </p>
        </div>
        {permissions.canForecast ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">New forecast name</Label>
              <Input
                className="h-9 w-48"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rolling forecast"
              />
            </div>
            <Button type="button" size="sm" disabled={isPending} onClick={createForecast}>
              <PlusIcon className="size-4" aria-hidden />
              Create forecast
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Forecast revenue</p>
          <p className="text-lg font-semibold">
            {format(global?.metrics.revenue_budget ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Forecast GP</p>
          <p className="text-lg font-semibold">
            {format(global?.metrics.gp_budget ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Forecast vs budget</p>
          <p className="text-lg font-semibold">
            {format(
              (global?.metrics.revenue_budget ?? 0) -
                (budgetGlobal?.metrics.revenue_budget ?? 0)
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Collections forecast</p>
          <p className="text-lg font-semibold">
            {format(global?.metrics.collections_budget ?? 0)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border">
        <p className="border-b border-border px-4 py-2 text-sm font-medium">
          Forecast versions
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>FY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No forecast versions yet.
                </TableCell>
              </TableRow>
            ) : (
              forecasts.map((f) => (
                <TableRow
                  key={f.id}
                  className={f.id === selectedForecastId ? "bg-muted/40" : undefined}
                >
                  <TableCell className="font-mono text-xs">{f.document_number}</TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell>{f.status}</TableCell>
                  <TableCell>{f.fiscal_year}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-2xl border border-border">
        <p className="border-b border-border px-4 py-2 text-sm font-medium">
          Forecast vs budget (by client)
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Forecast</TableHead>
              <TableHead className="text-right">Budget slice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientNodes.slice(0, 20).map((node) => (
              <TableRow key={node.key}>
                <TableCell>{node.label}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {format(node.metrics.revenue_budget, node.currency)}
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  Compare via filters
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
