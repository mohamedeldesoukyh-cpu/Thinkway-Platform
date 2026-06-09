"use client";

import { useCallback, useEffect, useState } from "react";

import {
  normalizeWorkspaceTabOrder,
  reorderWorkspaceTabs,
} from "@/lib/workspace/workspace-tab-order";

type UseWorkspaceTabOrderOptions<T extends string> = {
  storageKey: string;
  defaultOrder: readonly T[];
  isValidId: (id: string) => id is T;
};

export function useWorkspaceTabOrder<T extends string>({
  storageKey,
  defaultOrder,
  isValidId,
}: UseWorkspaceTabOrderOptions<T>) {
  const [tabOrder, setTabOrder] = useState<T[]>([...defaultOrder]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setTabOrder(normalizeWorkspaceTabOrder(JSON.parse(raw), defaultOrder, isValidId));
      }
    } catch {
      setTabOrder([...defaultOrder]);
    }
    setHydrated(true);
  }, [storageKey, defaultOrder, isValidId]);

  const persistTabOrder = useCallback(
    (next: T[]) => {
      const normalized = normalizeWorkspaceTabOrder(next, defaultOrder, isValidId);
      setTabOrder(normalized);
      try {
        localStorage.setItem(storageKey, JSON.stringify(normalized));
      } catch {
        /* ignore quota / private mode */
      }
    },
    [storageKey, defaultOrder, isValidId]
  );

  const moveTab = useCallback(
    (fromIndex: number, toIndex: number) => {
      persistTabOrder(reorderWorkspaceTabs(tabOrder, fromIndex, toIndex));
    },
    [persistTabOrder, tabOrder]
  );

  const resetTabOrder = useCallback(() => {
    persistTabOrder([...defaultOrder]);
  }, [defaultOrder, persistTabOrder]);

  return { tabOrder, moveTab, resetTabOrder, hydrated };
}
