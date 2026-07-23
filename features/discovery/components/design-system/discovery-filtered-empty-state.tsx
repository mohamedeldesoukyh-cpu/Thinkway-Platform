"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { DiscoveryEmptyState } from "./discovery-empty-state";

type DiscoveryFilteredEmptyStateProps = {
  title: string;
  description?: string;
  onReset: () => void;
  resetLabel?: string;
  children?: ReactNode;
  className?: string;
};

/** In-table filtered-empty state with optional reset — list pages. */
export function DiscoveryFilteredEmptyState({
  title,
  description = "Try adjusting search or filter criteria.",
  onReset,
  resetLabel = "Reset filters",
  children,
  className,
}: DiscoveryFilteredEmptyStateProps) {
  return (
    <DiscoveryEmptyState
      title={title}
      description={description}
      className={className ?? "py-10"}
    >
      {children}
      <Button type="button" size="sm" variant="secondary" onClick={onReset}>
        {resetLabel}
      </Button>
    </DiscoveryEmptyState>
  );
}
