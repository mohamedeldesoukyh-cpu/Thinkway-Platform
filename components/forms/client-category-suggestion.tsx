"use client";

import { AlertTriangle, Check, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";
import {
  classificationSourceLabel,
  isLowConfidenceClassification,
  type ClientClassificationSource,
} from "@/lib/clients/classify-client-category-types";
import { cn } from "@/lib/utils";

export type ClientCategorySuggestionState = {
  categorySlug: string;
  subcategorySlug: string;
  confidence: number;
  source: ClientClassificationSource;
  reason?: string;
};

type ClientCategorySuggestionProps = {
  suggestion: ClientCategorySuggestionState | null;
  applied: boolean;
  onAccept: () => void;
  onOverride: () => void;
  disabled?: boolean;
};

export function ClientCategorySuggestion({
  suggestion,
  applied,
  onAccept,
  onOverride,
  disabled,
}: ClientCategorySuggestionProps) {
  if (!suggestion) {
    return null;
  }

  const lowConfidence = isLowConfidenceClassification(suggestion.confidence);
  const categoryLabel = getClientCategoryLabel(suggestion.categorySlug);
  const subcategoryLabel = getClientSubcategoryLabel(
    suggestion.categorySlug,
    suggestion.subcategorySlug
  );

  return (
    <div
      className={cn(
        "rounded-[12px] border px-4 py-3.5 text-sm",
        lowConfidence
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-[var(--brand-product)]/30 bg-[var(--brand-product)]/5"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="font-medium text-foreground">Suggested classification</p>
          <p className="text-muted-foreground">
            {categoryLabel} · {subcategoryLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            {Math.round(suggestion.confidence)}% confidence ·{" "}
            {classificationSourceLabel(suggestion.source)}
          </p>
          {suggestion.reason ? (
            <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
          ) : null}
          {lowConfidence ? (
            <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              Manual review recommended
            </p>
          ) : null}
          {applied ? (
            <p className="text-xs text-muted-foreground">
              Suggestion applied — save to confirm.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!applied ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onAccept}
              disabled={disabled}
            >
              <Check data-icon="inline-start" />
              Accept
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOverride}
            disabled={disabled}
          >
            <Pencil data-icon="inline-start" />
            {applied ? "Change" : "Override"}
          </Button>
        </div>
      </div>
    </div>
  );
}
