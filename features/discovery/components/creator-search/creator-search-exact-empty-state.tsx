"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AddMissingCreatorEmptyState } from "@/features/discovery/components/add-missing-creator-dialog";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorEnrichmentStatus } from "@/features/discovery/enrichment/status";

type Props = {
  query: string;
  onSearchWithFewerWords: () => void;
  canSimplifyQuery: boolean;
  onMissingCreatorAdded?: (creator: UnifiedCreatorResult) => void;
  onMissingCreatorEnrichmentStatusChange?: (
    unifiedId: string,
    status: CreatorEnrichmentStatus
  ) => void;
  onMissingCreatorUpdated?: (creator: UnifiedCreatorResult) => void;
};

export function CreatorSearchExactEmptyState({
  query,
  onSearchWithFewerWords,
  canSimplifyQuery,
  onMissingCreatorAdded,
  onMissingCreatorEnrichmentStatusChange,
  onMissingCreatorUpdated,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div>
        <p className="text-sm font-semibold text-foreground">
          No creators found matching &lsquo;{query}&rsquo;.
        </p>
        <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
          We looked for an exact handle or name match and did not find this creator in Thinkway.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <AddMissingCreatorEmptyState
          visible
          onSuccess={onMissingCreatorAdded}
          onEnrichmentStatusChange={onMissingCreatorEnrichmentStatusChange}
          onCreatorUpdated={onMissingCreatorUpdated}
        />

        {canSimplifyQuery ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={onSearchWithFewerWords}
          >
            Search with fewer words
          </Button>
        ) : null}

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
          <Link href="/ai">
            <SparklesIcon className="size-3.5" />
            AI Search
          </Link>
        </Button>
      </div>
    </div>
  );
}
