"use client";

import { useState, useTransition } from "react";
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
import type { BudgetVersion } from "@/lib/planning/types/budget";
import type { BudgetPeriodType } from "@/lib/planning/types/budget";

type BudgetCreateSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "version" | "line";
  fiscalYear: number;
  filterOptions: DashboardFilterOptions;
  version?: BudgetVersion | null;
};

const CURRENCIES = ["USD", "AED", "SAR", "EGP", "EUR", "GBP"] as const;

export function BudgetCreateSheet({
  open,
  onOpenChange,
  mode,
  fiscalYear,
  filterOptions,
  version,
}: BudgetCreateSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [periodType, setPeriodType] = useState<BudgetPeriodType>("monthly");
  const [currency, setCurrency] = useState<string>("USD");
  const [notes, setNotes] = useState("");
  const [revenue, setRevenue] = useState("0");
  const [cost, setCost] = useState("0");
  const [clientId, setClientId] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("");
  const [country, setCountry] = useState<string>("");

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
      reset();
      onOpenChange(false);
    });
  };

  const submitLine = () => {
    if (!version) return;
    const rev = Number.parseFloat(revenue) || 0;
    const cst = Number.parseFloat(cost) || 0;
    const gp = Math.max(0, rev - cst);
    const margin = rev > 0 ? (gp / rev) * 100 : 0;

    startTransition(async () => {
      const result = await createBudgetLineAction({
        budgetVersionId: version.id,
        versionStatus: version.status,
        currencyCode: version.currency_code,
        clientId: clientId || undefined,
        brandId: brandId || undefined,
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
        toast.error(result.error);
        return;
      }
      toast.success("Budget line added.");
      reset();
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {mode === "version" ? "Create budget version" : "Add budget line"}
          </SheetTitle>
          <SheetDescription>
            {mode === "version"
              ? "Define fiscal year, period granularity, and base currency."
              : "Allocate revenue and cost across planning dimensions."}
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
                    type="number"
                    min={0}
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cost</Label>
                  <Input
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
          <Button
            type="button"
            disabled={isPending}
            onClick={mode === "version" ? submitVersion : submitLine}
          >
            {isPending ? "Saving…" : mode === "version" ? "Create version" : "Add line"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
