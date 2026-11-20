import { useUndoableState } from "@/lib/productivity/workspace-undo";
import { useCallback, useMemo } from "react";

import {
  roundOperationalAmount,
  syncCommercialFromCost,
  syncCommercialFromCostPerAd,
  syncCommercialFromRev,
  syncCommercialFromRevPerAd,
} from "@/features/campaigns/components/assignment-hierarchy/operational-amount";

export type OperationalCommercialDraft = {
  qty: number;
  revPerAd: number;
  rev: number;
  costPerAd: number;
  cost: number;
};

type Initial = {
  qty: number;
  revPerAd: number;
  rev: number;
  costPerAd: number;
  cost: number;
};

export function useOperationalCommercialDraft(initial: Initial, enabled = true) {
  const [draft, setDraft, resetDraft] = useUndoableState<OperationalCommercialDraft>(() => ({
    qty: initial.qty,
    revPerAd: initial.revPerAd,
    rev: initial.rev,
    costPerAd: initial.costPerAd,
    cost: initial.cost,
  }), "Campaign commercial values", enabled);

  const reset = useCallback((next: Initial) => {
    resetDraft({
      qty: next.qty,
      revPerAd: next.revPerAd,
      rev: next.rev,
      costPerAd: next.costPerAd,
      cost: next.cost,
    });
  }, [resetDraft]);

  const setQty = useCallback((qty: number) => {
    setDraft((prev) => {
      const q = Math.max(1, Math.floor(qty) || 1);
      return {
        ...prev,
        qty: q,
        rev: roundOperationalAmount(q * prev.revPerAd),
        cost: roundOperationalAmount(q * prev.costPerAd),
      };
    });
  }, [setDraft]);

  const setRevPerAd = useCallback((revPerAd: number) => {
    setDraft((prev) => ({ ...prev, ...syncCommercialFromRevPerAd(prev.qty, revPerAd) }));
  }, [setDraft]);

  const setRev = useCallback((rev: number) => {
    setDraft((prev) => ({ ...prev, ...syncCommercialFromRev(prev.qty, rev) }));
  }, [setDraft]);

  const setCostPerAd = useCallback((costPerAd: number) => {
    setDraft((prev) => ({ ...prev, ...syncCommercialFromCostPerAd(prev.qty, costPerAd) }));
  }, [setDraft]);

  const setCost = useCallback((cost: number) => {
    setDraft((prev) => ({ ...prev, ...syncCommercialFromCost(prev.qty, cost) }));
  }, [setDraft]);

  return useMemo(
    () => ({
      draft,
      reset,
      setQty,
      setRevPerAd,
      setRev,
      setCostPerAd,
      setCost,
    }),
    [draft, reset, setQty, setRevPerAd, setRev, setCostPerAd, setCost]
  );
}
