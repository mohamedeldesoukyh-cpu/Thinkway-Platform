"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  splitPackageTotalsAcrossDeliverables,
  type PackageDeliverableShare,
} from "@/lib/assignments/sync-package-deliverables";
import type { AssignmentDeliverableHierarchyRow } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";

type AssignmentPackageSplitValue = {
  enabled: boolean;
  shareFor: (deliverableId: string) => PackageDeliverableShare | null;
  setQuantity: (deliverableId: string, quantity: number) => void;
};

const AssignmentPackageSplitContext = createContext<AssignmentPackageSplitValue>({
  enabled: false,
  shareFor: () => null,
  setQuantity: () => {},
});

function qtyMapFromDeliverables(
  deliverables: AssignmentDeliverableHierarchyRow[]
): Record<string, number> {
  return Object.fromEntries(
    deliverables.map((row) => [row.id, Math.max(1, Math.floor(row.quantity) || 1)])
  );
}

export function AssignmentPackageSplitProvider({
  enabled,
  line,
  deliverables,
  resetKey,
  children,
}: {
  enabled: boolean;
  line: CampaignLineWorkspace;
  deliverables: AssignmentDeliverableHierarchyRow[];
  resetKey: string;
  children: ReactNode;
}) {
  const [qtyById, setQtyById] = useState<Record<string, number>>(() =>
    qtyMapFromDeliverables(deliverables)
  );

  useEffect(() => {
    setQtyById(qtyMapFromDeliverables(deliverables));
    // Deliverable identity/qty is captured in resetKey after save, cancel, or add/remove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const totals = useMemo(
    () => ({
      revenueBeforeVat: Number(line.revenue_before_vat ?? line.revenue) || 0,
      costBeforeVat: Number(line.cost_before_vat ?? line.cost) || 0,
      usageRightsAmount: Number(line.usage_rights_amount ?? 0),
      usageRightsCost: Number(line.usage_rights_cost ?? 0),
      agencyFeePercent: Number(line.agency_fee_percent ?? 0),
    }),
    [
      line.revenue_before_vat,
      line.revenue,
      line.cost_before_vat,
      line.cost,
      line.usage_rights_amount,
      line.usage_rights_cost,
      line.agency_fee_percent,
    ]
  );

  const sharesById = useMemo(() => {
    if (!enabled) return new Map<string, PackageDeliverableShare>();
    const shares = splitPackageTotalsAcrossDeliverables(
      deliverables.map((row) => ({
        id: row.id,
        quantity: qtyById[row.id] ?? row.quantity,
      })),
      totals
    );
    return new Map(shares.map((share) => [share.id, share]));
  }, [enabled, deliverables, qtyById, totals]);

  const shareFor = useCallback(
    (deliverableId: string) => sharesById.get(deliverableId) ?? null,
    [sharesById]
  );

  const setQuantity = useCallback((deliverableId: string, quantity: number) => {
    const next = Math.max(1, Math.floor(quantity) || 1);
    setQtyById((prev) => {
      if (prev[deliverableId] === next) return prev;
      return { ...prev, [deliverableId]: next };
    });
  }, []);

  const value = useMemo(
    () => ({ enabled, shareFor, setQuantity }),
    [enabled, shareFor, setQuantity]
  );

  return (
    <AssignmentPackageSplitContext.Provider value={value}>
      {children}
    </AssignmentPackageSplitContext.Provider>
  );
}

export function useAssignmentPackageSplit(): AssignmentPackageSplitValue {
  return useContext(AssignmentPackageSplitContext);
}
