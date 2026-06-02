import { BarChart3Icon } from "lucide-react";

export function ChartEmptyState({ label = "No data for selected filters" }: { label?: string }) {
  return (
    <div
      className="flex h-[160px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 text-center"
      role="status"
    >
      <BarChart3Icon className="size-8 text-muted-foreground/60" aria-hidden />
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
