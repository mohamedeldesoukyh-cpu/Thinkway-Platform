"use client";

import { useCallback, useState } from "react";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorAcrossPools } from "@/features/discovery/resolve-creator-across-pools";

/** Decouple sheet open state from creator so switching rows updates content without closing. */
export function useCreatorDetailSheetState() {
  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState<UnifiedCreatorResult | null>(null);

  const openCreator = useCallback((next: UnifiedCreatorResult) => {
    setCreator(next);
    setOpen(true);
  }, []);

  /**
   * Pack `cr(handle)` — search every provided pool before giving up.
   * Returns false when nothing matched (caller should not pretend the modal opened).
   */
  const openCreatorByHandle = useCallback(
    (
      handleOrId: string,
      ...pools: Array<Iterable<UnifiedCreatorResult> | null | undefined>
    ): boolean => {
      const found = resolveCreatorAcrossPools(handleOrId, ...pools);
      if (!found) return false;
      openCreator(found);
      return true;
    },
    [openCreator]
  );

  const closeCreator = useCallback(() => {
    setOpen(false);
    setCreator(null);
  }, []);

  const onOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setCreator(null);
  }, []);

  const patchOpenCreator = useCallback((next: UnifiedCreatorResult) => {
    setCreator((current) => (current?.unified_id === next.unified_id ? next : current));
  }, []);

  const closeIfShowing = useCallback((unifiedId: string) => {
    setCreator((current) => {
      if (current?.unified_id !== unifiedId) return current;
      setOpen(false);
      return null;
    });
  }, []);

  return {
    open,
    creator,
    openCreator,
    openCreatorByHandle,
    closeCreator,
    closeIfShowing,
    onOpenChange,
    patchOpenCreator,
    setCreator,
  };
}
