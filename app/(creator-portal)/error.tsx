"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function CreatorPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[creator-portal] route error:", error.digest ?? error.name);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-lg border border-border p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Creator Workspace could not load</h2>
        <p className="text-sm text-muted-foreground">
          Retry this page, or sign out and open Creator Workspace again.
        </p>
      </div>
      <Button type="button" onClick={() => reset()} className="w-fit">
        Try again
      </Button>
    </div>
  );
}
