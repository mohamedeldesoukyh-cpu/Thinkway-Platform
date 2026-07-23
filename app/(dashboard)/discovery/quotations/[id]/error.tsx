"use client";

import { useEffect } from "react";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { Button } from "@/components/ui/button";

export default function QuotationDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[quotations/detail] route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          Quotation could not load
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message ||
            "Something went wrong while loading this quotation after shortlist generation."}
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <PageBackButton fallbackHref="/discovery/quotations" label="Back to quotations" />
      </div>
    </div>
  );
}
