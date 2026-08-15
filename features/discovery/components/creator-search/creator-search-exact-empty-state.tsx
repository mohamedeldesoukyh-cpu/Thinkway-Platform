"use client";

import { SparklesIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AddMissingCreatorEmptyState } from "@/features/discovery/components/add-missing-creator-dialog";
import { DiscoveryEmptyState } from "@/features/discovery/components/design-system";
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
  onOpenAddMissingCreator?: () => void;
};

export function CreatorSearchExactEmptyState({
  query,
  onSearchWithFewerWords,
  canSimplifyQuery,
  onMissingCreatorAdded,
  onMissingCreatorEnrichmentStatusChange,
  onMissingCreatorUpdated,
  onOpenAddMissingCreator,
}: Props) {
  return (
    <DiscoveryEmptyState
      title={`No matching inventory for '${query}'.`}
      description="We looked for an exact handle or name match and did not find this creator in Thinkway."
    >
      <AddMissingCreatorEmptyState
        visible
        onOpen={onOpenAddMissingCreator}
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
    </DiscoveryEmptyState>
  );
}
