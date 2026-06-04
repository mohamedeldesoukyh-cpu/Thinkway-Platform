import { useCallback, useMemo, useState } from "react";

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

export function useOperationalCommercialDraft(initial: Initial) {
  const [draft, setDraft] = useState<OperationalCommercialDraft>(() => ({
    qty: initial.qty,
    revPerAd: initial.revPerAd,
    rev: initial.rev,
    costPerAd: initial.costPerAd,
    cost: initial.cost,
  }));

  const reset = useCallback((next: Initial) => {
    setDraft({
      qty: next.qty,
      revPerAd: next.revPerAd,
      rev: next.rev,
      costPerAd: next.costPerAd,
      cost: next.cost,
    });
  }, []);

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
  }, []);

  const setRevPerAd = useCallback((revPerAd: number) => {
    setDraft((prev) => ({ ...prev, ...syncCommercialFromRevPerAd(prev.qty, revPerAd) }));
  }, []);

  const setRev = useCallback((rev: number) => {
    setDraft((prev) => ({ ...prev, ...syncCommercialFromRev(prev.qty, rev) }));
  }, []);

  const setCostPerAd = useCallback((costPerAd: number) => {
    setDraft((prev) => ({ ...prev, ...syncCommercialFromCostPerAd(prev.qty, costPerAd) }));
  }, []);

  const setCost = useCallback((cost: number) => {
    setDraft((prev) => ({ ...prev, ...syncCommercialFromCost(prev.qty, cost) }));
  }, []);

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
