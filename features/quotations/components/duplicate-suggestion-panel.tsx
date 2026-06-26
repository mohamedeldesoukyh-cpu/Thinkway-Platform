"use client";

import { Loader2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { duplicateMatchTypeLabel, type DuplicateMatchType } from "@/features/quotations/duplicate-search";
import { cn } from "@/lib/utils";

export type DuplicateSuggestionItem = {
  id: string;
  primaryLabel: string;
  secondaryLabel?: string | null;
  matchType: DuplicateMatchType;
  score: number;
};

type DuplicateSuggestionPanelProps = {
  entityLabel: string;
  query: string;
  loading: boolean;
  suggestions: DuplicateSuggestionItem[];
  dismissed: boolean;
  onUseExisting: (id: string) => void;
  onContinueCreating: () => void;
  className?: string;
};

export function DuplicateSuggestionPanel({
  entityLabel,
  query,
  loading,
  suggestions,
  dismissed,
  onUseExisting,
  onContinueCreating,
  className,
}: DuplicateSuggestionPanelProps) {
  if (!query.trim() || dismissed) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm",
        className
      )}
      role="region"
      aria-live="polite"
      aria-label={`Possible ${entityLabel} duplicates`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-warning">Possible {entityLabel} duplicates</p>
        {loading ? (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      {!loading && suggestions.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No similar records found.</p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mt-2 space-y-2" role="listbox" aria-label={`${entityLabel} duplicate matches`}>
          {suggestions.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-background/80 px-3 py-2"
              role="option"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{item.primaryLabel}</p>
                {item.secondaryLabel ? (
                  <p className="truncate text-xs text-muted-foreground">{item.secondaryLabel}</p>
                ) : null}
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {duplicateMatchTypeLabel(item.matchType)}
                </Badge>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={() => onUseExisting(item.id)}
                >
                  Use existing
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onContinueCreating}>
                  Continue creating
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
