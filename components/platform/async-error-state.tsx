"use client";

import { PageFallback } from "@/components/platform/page-fallback";

type AsyncErrorStateProps = {
  title?: string;
  message?: string | null;
  scope?: string;
  onRetry?: () => void;
};

export function AsyncErrorState({
  title = "This section is temporarily unavailable",
  message,
  scope,
  onRetry,
}: AsyncErrorStateProps) {
  const description =
    message ??
    "Core ERP operations remain available. Optional analytics or enrichment may be offline.";

  return (
    <PageFallback
      title={title}
      description={description}
      hint={
        scope
          ? `${scope} failed to load. Operational billing, campaigns, and invoices are isolated.`
          : undefined
      }
      onRetry={
        onRetry ??
        (() => {
          window.location.reload();
        })
      }
      variant="warning"
    />
  );
}
