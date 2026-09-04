"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  resolveListNavNeighbors,
  type ListNavEntity,
} from "@/lib/navigation/list-nav-context";
import { cn } from "@/lib/utils";

type EntityPrevNextProps = {
  entity: ListNavEntity;
  currentId: string;
  hrefForId: (id: string) => string;
  /** Optional — when provided, neighbors hide if filter fingerprint drifted. */
  expectedFilterKey?: string | null;
  className?: string;
};

/**
 * Previous / Next across the full filtered list context (not page-local).
 */
const EMPTY_NEIGHBORS = {
  prevId: null as string | null,
  nextId: null as string | null,
  index: -1,
  total: 0,
  filterKey: null as string | null,
};

export function EntityPrevNext({
  entity,
  currentId,
  hrefForId,
  expectedFilterKey,
  className,
}: EntityPrevNextProps) {
  // sessionStorage is client-only — reading it in useState init causes React #418
  // (SSR null vs client "1/29") and can blank the rest of the quotation body.
  const [neighbors, setNeighbors] = useState(EMPTY_NEIGHBORS);

  useEffect(() => {
    setNeighbors(resolveListNavNeighbors(entity, currentId, expectedFilterKey));
  }, [currentId, entity, expectedFilterKey]);

  if (neighbors.total < 2 || neighbors.index < 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {neighbors.prevId ? (
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" asChild>
          <Link href={hrefForId(neighbors.prevId)} aria-label="Previous in filtered list">
            <ChevronLeftIcon className="size-3.5" />
            Previous
          </Link>
        </Button>
      ) : null}
      <span className="px-1 text-[11px] tabular-nums text-muted-foreground">
        {neighbors.index + 1} / {neighbors.total}
      </span>
      {neighbors.nextId ? (
        <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" asChild>
          <Link href={hrefForId(neighbors.nextId)} aria-label="Next in filtered list">
            Next
            <ChevronRightIcon className="size-3.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
