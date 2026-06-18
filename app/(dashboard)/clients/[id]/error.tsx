"use client";

import { useEffect } from "react";

import { PageBackButton } from "@/components/navigation/page-back-button";
import { Button } from "@/components/ui/button";

export default function ClientProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[clients/profile] route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          Client profile could not load
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Something went wrong while loading this legal entity."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <PageBackButton fallbackHref="/clients" label="Back to clients" />
      </div>
    </div>
  );
}
