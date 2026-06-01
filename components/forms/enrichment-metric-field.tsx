"use client";

import { PencilLineIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getMetricPlaceholder,
  METRICS_SOURCE_LABELS,
  type MetricsSource,
} from "@/lib/social/enrichment/metrics-status";
import { cn } from "@/lib/utils";

const FIELD_SOURCE_STYLES: Record<
  MetricsSource,
  { badge: string; input: string }
> = {
  synced: {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    input: "border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/60",
  },
  manual: {
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
    input: "border-violet-300/80 bg-violet-50/40 ring-1 ring-violet-200/60 dark:border-violet-800 dark:ring-violet-900/40",
  },
  unavailable: {
    badge: "text-muted-foreground",
    input: "border-dashed border-muted-foreground/30 bg-muted/20 italic",
  },
  pending_api: {
    badge:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
    input: "border-dashed border-blue-300/60 bg-blue-50/20 dark:border-blue-900/60",
  },
};

type EnrichmentMetricFieldProps = {
  id: string;
  label: string;
  value: string;
  fieldSource: MetricsSource;
  isManualOverride: boolean;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: string;
};

export function EnrichmentMetricField({
  id,
  label,
  value,
  fieldSource,
  isManualOverride,
  onChange,
  min = 0,
  max,
  step,
}: EnrichmentMetricFieldProps) {
  const styles = FIELD_SOURCE_STYLES[fieldSource];
  const placeholder = getMetricPlaceholder({
    value,
    fieldSource,
    isManualOverride,
  });
  const showManualHint = fieldSource === "manual" || isManualOverride;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1.5">
          {showManualHint ? (
            <PencilLineIcon className="size-3.5 text-violet-600 dark:text-violet-400" />
          ) : null}
          {label}
        </Label>
        <Badge variant="outline" className={cn("text-[10px]", styles.badge)}>
          {METRICS_SOURCE_LABELS[fieldSource]}
        </Badge>
      </div>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn("transition-colors", styles.input, !value && "text-muted-foreground")}
      />
    </div>
  );
}
