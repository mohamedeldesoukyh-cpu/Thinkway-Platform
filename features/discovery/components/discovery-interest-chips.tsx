"use client";

import { cn } from "@/lib/utils";

export function InterestChips({
  interests,
  variant = "default",
  maxVisible = 3,
  emptyLabel = "No interests tagged",
}: {
  interests: string[];
  variant?: "default" | "compact" | "icat";
  maxVisible?: number;
  emptyLabel?: string;
}) {
  if (interests.length === 0) {
    return <span className="text-[11px] text-muted-foreground/60">{emptyLabel}</span>;
  }

  const visible = interests.slice(0, maxVisible);
  const overflow = interests.length - visible.length;

  if (variant === "compact" || variant === "icat") {
    const chipClass =
      variant === "icat"
        ? "min-w-0 max-w-full truncate rounded-[7px] border border-border bg-[var(--surface,#f6f8fc)] px-2 py-0.5 text-[11px] font-medium capitalize text-[var(--text-2)]"
        : "min-w-0 max-w-[5.5rem] truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground";

    return (
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1">
        {visible.map((interest) => (
          <span key={interest} title={interest} className={chipClass}>
            {interest}
          </span>
        ))}
        {overflow > 0 ? (
          <span
            className="shrink-0 rounded-[7px] border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            title={interests.slice(maxVisible).join(", ")}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {visible.map((interest) => (
        <span
          key={interest}
          title={interest}
          className="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
        >
          {interest}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          title={interests.slice(maxVisible).join(", ")}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

export function RelevanceScore({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const rounded = Math.round(score);
  const bars = Math.max(1, Math.min(4, Math.ceil((rounded / 100) * 4)));
  return (
    <div className="flex items-center gap-1.5" title={`Campaign relevance ${rounded}%`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-0.5 rounded-full", i < bars ? "bg-primary" : "bg-primary/20")}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-primary">{rounded}</span>
    </div>
  );
}
