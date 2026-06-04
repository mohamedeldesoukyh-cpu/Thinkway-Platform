import type { ComponentPropsWithoutRef } from "react";

import {
  documentNumberDisplayTitle,
  formatDocumentNumberForDisplay,
} from "@/lib/documents/format-document-number";
import { cn } from "@/lib/utils";

type DocumentNumberProps = ComponentPropsWithoutRef<"span"> & {
  value: string | null | undefined;
  /** Show canonical padded number on hover when it differs from display. Default true. */
  showCanonicalTitle?: boolean;
  fallback?: string;
};

export function DocumentNumber({
  value,
  showCanonicalTitle = true,
  fallback = "—",
  className,
  ...props
}: DocumentNumberProps) {
  if (value == null || !value.trim()) {
    return (
      <span className={className} {...props}>
        {fallback}
      </span>
    );
  }

  const canonical = value.trim();
  const display = formatDocumentNumberForDisplay(canonical);
  const title =
    showCanonicalTitle ? documentNumberDisplayTitle(canonical) : undefined;

  return (
    <span className={cn("tabular-nums", className)} title={title} {...props}>
      {display}
    </span>
  );
}
