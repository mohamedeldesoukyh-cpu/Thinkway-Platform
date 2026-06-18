"use client";

import { AlertTriangle, Check, Pencil } from "lucide-react";

import {
  CLIENT_FORM_FIELD_HINT_CLASS,
  CLIENT_FORM_GHOST_BUTTON_CLASS,
  CLIENT_FORM_SECONDARY_BUTTON_CLASS,
} from "@/features/clients/components/client-form-ui";
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
        "rounded-[12px] border bg-[#F5F8FD] px-4 py-4",
        lowConfidence ? "border-amber-500/40" : "border-[#E6EAF2]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="text-[13px] font-semibold text-[#0B0F1A]">
            Suggested classification
          </p>
          <p className="text-[13px] text-[#3A4254]">
            {categoryLabel} · {subcategoryLabel}
          </p>
          <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
            {Math.round(suggestion.confidence)}% confidence ·{" "}
            {classificationSourceLabel(suggestion.source)}
          </p>
          {suggestion.reason ? (
            <p className={CLIENT_FORM_FIELD_HINT_CLASS}>{suggestion.reason}</p>
          ) : null}
          {lowConfidence ? (
            <p className="flex items-center gap-1 text-[11.5px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              Manual review recommended
            </p>
          ) : null}
          {applied ? (
            <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
              Suggestion applied — save to confirm.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {!applied ? (
            <button
              type="button"
              className={CLIENT_FORM_SECONDARY_BUTTON_CLASS}
              onClick={onAccept}
              disabled={disabled}
            >
              <Check className="size-3.5" aria-hidden />
              Accept
            </button>
          ) : null}
          <button
            type="button"
            className={cn(
              CLIENT_FORM_GHOST_BUTTON_CLASS,
              "px-3 py-1.5 text-xs"
            )}
            onClick={onOverride}
            disabled={disabled}
          >
            <Pencil className="size-3.5" aria-hidden />
            {applied ? "Change" : "Override"}
          </button>
        </div>
      </div>
    </div>
  );
}
