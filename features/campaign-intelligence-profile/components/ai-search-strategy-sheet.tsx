"use client";

import { useMemo, useState } from "react";
import { CheckIcon, PencilIcon, PlayIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import type { CampaignSearchCriterion } from "../types/profile";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  criteria: CampaignSearchCriterion[];
  onCriteriaChange: (criteria: CampaignSearchCriterion[]) => void;
  onRunSearch: () => void;
  running?: boolean;
};

export function AiSearchStrategySheet({
  open,
  onOpenChange,
  criteria,
  onCriteriaChange,
  onRunSearch,
  running,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const enabledCount = useMemo(() => criteria.filter((c) => c.enabled).length, [criteria]);

  function toggle(id: string) {
    onCriteriaChange(
      criteria.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  }

  function remove(id: string) {
    onCriteriaChange(criteria.filter((c) => c.id !== id));
  }

  function updateWeight(id: string, weight: number) {
    onCriteriaChange(
      criteria.map((c) => (c.id === id ? { ...c, weight: Math.min(100, Math.max(0, weight)) } : c))
    );
  }

  function updateValue(id: string, value: string) {
    onCriteriaChange(criteria.map((c) => (c.id === id ? { ...c, value } : c)));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>AI Search Strategy</SheetTitle>
        </SheetHeader>
        <p className="text-xs text-muted-foreground">
          Mapped Discovery filters from campaign intelligence — objectives, budgets, and KPIs are
          not included.
        </p>
        <ul className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
          {criteria.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
            >
              <button
                type="button"
                className="mt-0.5 shrink-0 text-emerald-600"
                onClick={() => toggle(item.id)}
                aria-label={item.enabled ? "Disable" : "Enable"}
              >
                {item.enabled ? <CheckIcon className="size-4" /> : <XIcon className="size-4 text-muted-foreground" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                {editingId === item.id ? (
                  <Input
                    className="mt-1 h-8 text-sm"
                    value={item.value}
                    onChange={(e) => updateValue(item.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                  />
                ) : (
                  <p className="font-medium">{item.value}</p>
                )}
                <p className="text-xs text-muted-foreground">Weight {item.weight}%</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingId(item.id)}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-7 w-14 px-1 text-center text-xs"
                  value={item.weight}
                  onChange={(e) => updateWeight(item.id, Number(e.target.value))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  onClick={() => remove(item.id)}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          className="mt-4 w-full"
          onClick={onRunSearch}
          disabled={running || enabledCount === 0}
        >
          <PlayIcon className="size-4" />
          Run search ({enabledCount} criteria)
        </Button>
      </SheetContent>
    </Sheet>
  );
}
