"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  useCreatorSelection,
  type useCreatorBrowse,
} from "./creator-selection-hooks";
import type {
  CreatorCheckboxState,
  CreatorSelectionConfig,
  CreatorSelectionMode,
} from "./creator-selection-types";

type CreatorSelectionContextValue = {
  selectedIds: Set<string>;
  selectedCount: number;
  mode: CreatorSelectionMode;
  toggle: (id: string) => void;
  toggleAllVisible: (visibleIds: readonly string[]) => void;
  selectAll: (ids: readonly string[]) => void;
  deselectAll: (ids: readonly string[]) => void;
  clearSelection: () => void;
  checkboxState: (visibleIds: readonly string[]) => CreatorCheckboxState;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedCreators: (creators: UnifiedCreatorResult[]) => UnifiedCreatorResult[];
};

const CreatorSelectionContext = createContext<CreatorSelectionContextValue | null>(null);

export function CreatorSelectionProvider({
  config,
  children,
}: {
  config?: CreatorSelectionConfig;
  children: ReactNode;
}) {
  const selection = useCreatorSelection(config);

  const value: CreatorSelectionContextValue = {
    ...selection,
    selectedCreators: (creators) =>
      creators.filter((c) => selection.selectedIds.has(c.unified_id)),
  };

  return (
    <CreatorSelectionContext.Provider value={value}>
      {children}
    </CreatorSelectionContext.Provider>
  );
}

export function useCreatorSelectionContext(): CreatorSelectionContextValue {
  const ctx = useContext(CreatorSelectionContext);
  if (!ctx) {
    throw new Error("useCreatorSelectionContext must be used within CreatorSelectionProvider");
  }
  return ctx;
}

/** Optional hook — returns null outside provider. */
export function useOptionalCreatorSelectionContext(): CreatorSelectionContextValue | null {
  return useContext(CreatorSelectionContext);
}

export type CreatorBrowseHookResult = ReturnType<typeof useCreatorBrowse>;
