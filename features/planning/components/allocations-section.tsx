"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveBudgetAllocationAction } from "@/features/planning/actions";
import type { PlanningPermissions } from "@/features/planning/load-planning-workspace";
import { formatAnalyticsAmount } from "@/lib/analytics/currency/engine";
import type { BudgetAllocation } from "@/lib/planning/types/budget";
import { devLog } from "@/lib/platform/logger";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type AllocationsSectionProps = {
  allocations: BudgetAllocation[];
  permissions: PlanningPermissions;
  defaultLineId?: string;
  currencyCode?: string;
};

const ALLOCATION_TYPES = [
  { value: "fixed", label: "Fixed amount" },
  { value: "percent", label: "Percentage" },
] as const;

const TARGET_DIMENSIONS = [
  { value: "campaign", label: "Campaign" },
  { value: "team", label: "Team" },
  { value: "client", label: "Client" },
  { value: "brand", label: "Brand" },
] as const;

function buildAllocationColumns(
  currency: {
    primary_currency: string;
    is_mixed_currency: boolean;
    currencies: string[];
    mixed_label: string | null;
  }
): OperationalConfigurableColumnDef<BudgetAllocation>[] {
  return [
    {
      id: "line",
      label: "Line",
      monoCell: true,
      renderCell: (row) => `${row.budget_line_id.slice(0, 8)}…`,
    },
    {
      id: "type",
      label: "Type",
      renderCell: (row) => row.allocation_type,
    },
    {
      id: "target",
      label: "Target",
      renderCell: (row) =>
        `${row.target_dimension}${row.target_id ? ` · ${row.target_id.slice(0, 8)}` : ""}`,
    },
    {
      id: "amount",
      label: "Amount",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (row) => formatAnalyticsAmount(row.allocated_amount, currency),
    },
    {
      id: "percent",
      label: "%",
      headerClassName: "text-right",
      amountCell: true,
      cellClassName: "text-muted-foreground",
      renderCell: (row) =>
        row.allocation_percent != null ? `${row.allocation_percent}%` : "—",
    },
  ];
}

export function AllocationsSection({
  allocations,
  permissions,
  defaultLineId,
  currencyCode = "USD",
}: AllocationsSectionProps) {
  const [lineId, setLineId] = useState(defaultLineId ?? "");
  const [allocationType, setAllocationType] = useState("fixed");
  const [targetDimension, setTargetDimension] = useState("campaign");
  const [amount, setAmount] = useState("0");
  const [percent, setPercent] = useState("");
  const [isPending, startTransition] = useTransition();

  const totalAllocated = allocations.reduce(
    (sum, row) => sum + Number(row.allocated_amount),
    0
  );
  const currency = useMemo(
    () => ({
      primary_currency: currencyCode,
      is_mixed_currency: false,
      currencies: [currencyCode],
      mixed_label: null,
    }),
    [currencyCode]
  );

  const columns = useMemo(() => buildAllocationColumns(currency), [currency]);
  const columnMetas = useMemo(() => getOperationalTableColumnMetas(columns), [columns]);

  const save = () => {
    if (!lineId.trim()) {
      toast.error("Budget line ID is required to save an allocation.");
      return;
    }
    startTransition(async () => {
      const result = await saveBudgetAllocationAction({
        budgetLineId: lineId.trim(),
        allocationType,
        targetDimension,
        allocatedAmount: Number.parseFloat(amount) || 0,
        allocationPercent: percent ? Number.parseFloat(percent) : undefined,
        currencyCode,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Allocation saved.");
      if (process.env.NODE_ENV === "development") {
        devLog("[budget-allocation] UI save", { lineId, targetDimension });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold">Budget allocations</h3>
        <p className="text-sm text-muted-foreground">
          Split budgets across campaigns, teams, and dimensions using fixed or percentage rules.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total allocated</p>
          <p className="text-lg font-semibold">
            {formatAnalyticsAmount(totalAllocated, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Allocation rows</p>
          <p className="text-lg font-semibold">{allocations.length}</p>
        </div>
        <div className="rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Percent rules</p>
          <p className="text-lg font-semibold">
            {allocations.filter((a) => a.allocation_percent != null).length}
          </p>
        </div>
      </div>

      {permissions.canWrite ? (
        <div className="rounded-2xl border border-border p-4">
          <p className="mb-3 text-sm font-medium">New allocation</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-1">
              <Label className="text-xs">Budget line ID</Label>
              <Input
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                placeholder="UUID from budget line"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Type</Label>
              <Select value={allocationType} onValueChange={setAllocationType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLOCATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Target dimension</Label>
              <Select value={targetDimension} onValueChange={setTargetDimension}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_DIMENSIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Amount</Label>
              <Input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Percent (optional)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-3"
            size="sm"
            disabled={isPending}
            onClick={save}
          >
            Save allocation
          </Button>
        </div>
      ) : null}

      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.planningBudgetAllocations}
        columns={columns}
        rows={allocations}
        filterAccessors={{
          line: (row) => row.budget_line_id,
          type: (row) => row.allocation_type,
          target: (row) => row.target_dimension ?? row.target_id,
          amount: (row) => row.allocated_amount,
          percent: (row) => row.allocation_percent,
        }}
      >
        <div className="space-y-2">
          <div className="flex justify-end">
            <OperationalTableControlsSlot contextLabel="Budget allocations" />
          </div>
          {allocations.length === 0 ? (
            <p className="px-4 py-8 text-[11px] text-muted-foreground">
              No allocations for this budget version.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={allocations}
              rowKey={(row) => row.id}
            />
          )}
        </div>
      </OperationalTableSuiteProvider>
    </div>
  );
}
