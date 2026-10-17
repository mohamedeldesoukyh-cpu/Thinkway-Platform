"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  createBudgetLineAction,
  createBudgetVersionAction,
} from "@/features/planning/actions";
import type { DashboardFilterOptions } from "@/features/analytics/load-executive-dashboard";
import type { BudgetVersion, BudgetPeriod, BudgetLine } from "@/lib/planning/types/budget";
import type { BudgetPeriodType } from "@/lib/planning/types/budget";

type BudgetCreateSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "version" | "line";
  fiscalYear: number;
  filterOptions: DashboardFilterOptions;
  version?: BudgetVersion | null;
  periods: BudgetPeriod[];
  line?: BudgetLine | null;
};

const CURRENCIES = ["USD", "AED", "SAR", "EGP", "EUR", "GBP"] as const;

export function BudgetCreateSheet({
  open,
  onOpenChange,
  mode,
  fiscalYear,
  filterOptions,
  version,
  periods,
  line,
}: BudgetCreateSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(line?.line_label ?? "");
  const [periodType, setPeriodType] = useState<BudgetPeriodType>("monthly");
  const [currency, setCurrency] = useState<string>("EGP");
  const [notes, setNotes] = useState("");
  const [revenue, setRevenue] = useState(String(line?.revenue_budget ?? ""));
  const [cost, setCost] = useState(String(line?.cost_budget ?? ""));
  const [clientId, setClientId] = useState(line?.client_id ?? "");
  const [brandId, setBrandId] = useState(line?.brand_id ?? "");
  const [country, setCountry] = useState(line?.country_code ?? "");
  const [periodId, setPeriodId] = useState(line?.budget_period_id ?? "");
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setNotes("");
    setRevenue("0");
    setCost("0");
    setClientId("");
    setBrandId("");
    setCountry("");
  };

  const submitVersion = () => {
    startTransition(async () => {
      const result = await createBudgetVersionAction({
        name: name || `FY${fiscalYear} Budget`,
        fiscalYear,
        currencyCode: currency,
        periodType,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Budget version created.");
      if (result.versionId) router.push(`/planning?fy=${fiscalYear}&tab=versions&version=${result.versionId}`);
      reset();
      onOpenChange(false);
    });
  };

  const submitLine = () => {
    if (!version) return;
    const rev = Number(revenue);
    const cst = Number(cost);
    if (!periodId || !revenue.trim() || !cost.trim() || ![rev, cst].every(n => Number.isFinite(n) && n >= 0)) {
      setError("Choose a period and enter valid revenue and cost amounts (zero is allowed).");
      return;
    }
    setError("");
    const gp = rev - cst;
    const margin = rev > 0 ? (gp / rev) * 100 : 0;

    startTransition(async () => {
      const result = await createBudgetLineAction({
        lineId: line?.id,
        budgetPeriodId: periodId,
        budgetVersionId: version.id,
        versionStatus: version.status,
        currencyCode: version.currency_code,
        clientId: clientId || undefined,
        brandId: brandId || undefined,
        campaignHeaderId: line?.campaign_header_id ?? undefined,
        teamId: line?.team_id ?? undefined,
        businessUnitId: line?.business_unit_id ?? undefined,
        countryCode: country || undefined,
        revenueBudget: rev,
        costBudget: cst,
        gpBudget: gp,
        marginBudget: margin,
        collectionsBudget: rev,
        vendorCostBudget: cst,
        poBudget: 0,
        lineLabel: name || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(line ? "Budget line updated." : "Budget line added.");
      reset();
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {mode === "version" ? "Create budget version" : line ? "Edit budget line" : "Add budget line"}
          </SheetTitle>
          <SheetDescription>
            {mode === "version"
              ? "Define fiscal year, period granularity, and base currency."
              : `Enter revenue and direct campaign cost in ${version?.currency_code ?? "the budget currency"}. Add one line per month; leave dimensions empty for a company-wide budget.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="grid gap-2">
            <Label>{mode === "version" ? "Version name" : "Line label"}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {mode === "version" ? (
            <>
              <div className="grid gap-2">
                <Label>Period mode</Label>
                <Select
                  value={periodType}
                  onValueChange={(v) => setPeriodType(v as BudgetPeriodType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="budget-period">Budget period</Label>
                <Select value={periodId} onValueChange={setPeriodId}>
                  <SelectTrigger id="budget-period"><SelectValue placeholder="Choose a month / period" /></SelectTrigger>
                  <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id}>{p.period_key}</SelectItem>)}</SelectContent>
                </Select>
                {periods.length === 0 ? <p role="alert" className="text-sm text-destructive">No periods available. Create a monthly budget version first.</p> : null}
              </div>
              <div className="grid gap-2">
                <Label>Country</Label>
                <Select value={country || "__none__"} onValueChange={(v) => setCountry(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {filterOptions.countries.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Client</Label>
                <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {filterOptions.clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Brand</Label>
                <Select value={brandId || "__none__"} onValueChange={(v) => setBrandId(v === "__none__" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {filterOptions.brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Revenue</Label>
                  <Input
                    aria-label="Budget revenue"
                    step="0.01"
                    type="number"
                    min={0}
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cost</Label>
                  <Input
                    aria-label="Budget cost"
                    step="0.01"
                    type="number"
                    min={0}
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="button"
            disabled={isPending || (mode === "line" && periods.length === 0)}
            onClick={mode === "version" ? submitVersion : submitLine}
          >
            {isPending ? "Saving…" : mode === "version" ? "Create version" : line ? "Save changes" : "Add line"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
