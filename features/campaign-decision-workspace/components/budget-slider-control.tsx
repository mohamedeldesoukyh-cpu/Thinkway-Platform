"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BudgetSliderControlProps = {
  value: number;
  onChange: (percentChange: number) => void;
  className?: string;
};

export function BudgetSliderControl({
  value,
  onChange,
  className,
}: BudgetSliderControlProps) {
  return (
    <Card size="sm" className={cn("rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Budget Adjustment</CardTitle>
        <p className="text-xs text-muted-foreground">-50% to +50% · instant simulation</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Change</span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              value > 0 && "text-[#1D9E75]",
              value < 0 && "text-destructive"
            )}
          >
            {value > 0 ? "+" : ""}
            {value}%
          </span>
        </div>
        <input
          type="range"
          min={-50}
          max={50}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[#1D9E75]"
          aria-label="Budget adjustment percentage"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>-50%</span>
          <span>0%</span>
          <span>+50%</span>
        </div>
      </CardContent>
    </Card>
  );
}
