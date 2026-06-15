"use client";

import { Loader2Icon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { PageAlert } from "@/components/ui/page-alert";

type CampaignWorkspaceTabLoadingProps = {
  error?: string | null;
};

export function CampaignWorkspaceTabLoading({
  error,
}: CampaignWorkspaceTabLoadingProps) {
  if (error) {
    return <PageAlert>{error}</PageAlert>;
  }

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading tab data…</p>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </>
  );
}
