"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { toast } from "sonner";

import {
  finalizeQuotationSave,
  updateQuotationHeader,
  updateQuotationItemCommercials,
} from "@/features/quotations/actions";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import type { AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import type { CommercialInputMode, QuotationStatus } from "@/types/database";
import { linePendingDiffersFromItem } from "@/lib/quotations/quotation-line-pending-diff";
import { rollupDeliverableCommercials } from "@/lib/quotations/quotation-deliverable-rollup";

export type QuotationLinePendingPayload = {
  service_description?: string | null;
  deliverables?: QuotationDeliverable[];
  revenue?: number | null;
  cost?: number | null;
  gp_pct?: number | null;
  gp_value?: number | null;
  mode?: "cost_revenue";
  platform?: string | null;
  handle?: string | null;
  followers?: number | null;
  engagement_rate?: number | null;
  option_number?: number | null;
};

export type QuotationMetaPendingPayload = {
  prepared_by_name?: string | null;
  reviewed_by_name?: string | null;
  client_signature_name?: string | null;
  issue_date?: string;
  validity_date?: string | null;
  version?: string;
  department?: string;
  change_summary?: string | null;
  status?: QuotationStatus;
  notes?: string | null;
};

type QuotationManualSaveContextValue = {
  registerLinePending: (itemId: string, payload: QuotationLinePendingPayload) => void;
  registerMetaPending: (patch: QuotationMetaPendingPayload) => void;
  registerSaveFlush: (flush: () => void) => () => void;
  isLinePending: (itemId: string) => boolean;
  hasUnsavedChanges: boolean;
  saveStatus: AutosaveStatus;
  savePending: boolean;
  saveAll: () => Promise<boolean>;
};

const QuotationManualSaveContext = createContext<QuotationManualSaveContextValue | null>(null);

type ProviderProps = {
  quotationId: string;
  items: QuotationItemRow[];
  children: ReactNode;
};

export function QuotationManualSaveProvider({ quotationId, items, children }: ProviderProps) {
  const router = useRouter();
  const linePendingRef = useRef(new Map<string, QuotationLinePendingPayload>());
  const metaPendingRef = useRef<QuotationMetaPendingPayload | null>(null);
  const saveFlushHandlersRef = useRef(new Set<() => void>());
  const itemsByIdRef = useRef(new Map(items.map((item) => [item.id, item])));
  itemsByIdRef.current = new Map(items.map((item) => [item.id, item]));
  const [pendingLineIds, setPendingLineIds] = useState<Set<string>>(() => new Set());
  const [hasMetaPending, setHasMetaPending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [savePending, setSavePending] = useState(false);

  const hasUnsavedChanges = pendingLineIds.size > 0 || hasMetaPending;
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  hasUnsavedRef.current = hasUnsavedChanges;

  const syncPendingState = useCallback(() => {
    setPendingLineIds((current) => {
      const next = new Set(linePendingRef.current.keys());
      if (
        current.size === next.size &&
        [...current].every((id) => next.has(id))
      ) {
        return current;
      }
      return next;
    });
    const hasLines = linePendingRef.current.size > 0;
    const hasMeta = metaPendingRef.current != null;
    setHasMetaPending(hasMeta);
    if (!hasLines && !hasMeta) {
      setSaveStatus("idle");
    } else {
      setSaveStatus("pending");
    }
  }, []);

  const registerLinePending = useCallback(
    (itemId: string, payload: QuotationLinePendingPayload) => {
      const item = itemsByIdRef.current.get(itemId);
      const prev = linePendingRef.current.get(itemId) ?? {};
      const merged = { ...prev, ...payload };

      if (item && !linePendingDiffersFromItem(item, merged)) {
        if (linePendingRef.current.has(itemId)) {
          linePendingRef.current.delete(itemId);
          syncPendingState();
        }
        return;
      }

      linePendingRef.current.set(itemId, merged);
      setPendingLineIds((current) => {
        if (current.has(itemId)) return current;
        const next = new Set(current);
        next.add(itemId);
        return next;
      });
      setSaveStatus("pending");
    },
    [syncPendingState]
  );

  const registerMetaPending = useCallback(
    (patch: QuotationMetaPendingPayload) => {
      metaPendingRef.current = { ...(metaPendingRef.current ?? {}), ...patch };
      setHasMetaPending(true);
      setSaveStatus("pending");
    },
    []
  );

  const registerSaveFlush = useCallback((flush: () => void) => {
    saveFlushHandlersRef.current.add(flush);
    return () => {
      saveFlushHandlersRef.current.delete(flush);
    };
  }, []);

  const isLinePending = useCallback(
    (itemId: string) => pendingLineIds.has(itemId),
    [pendingLineIds]
  );

  const saveAll = useCallback(async (): Promise<boolean> => {
    if (!hasUnsavedRef.current && linePendingRef.current.size === 0 && !metaPendingRef.current) {
      return true;
    }

    setSavePending(true);
    savePendingRef.current = true;
    setSaveStatus("saving");

    for (const flush of saveFlushHandlersRef.current) {
      flush();
    }

    const itemById = itemsByIdRef.current;
    let firstError: string | undefined;
    const pendingEntries = [...linePendingRef.current.entries()].filter(([itemId, payload]) => {
      const item = itemById.get(itemId);
      return item && linePendingDiffersFromItem(item, payload);
    });

    const saveOptions = { deferRevalidate: true, skipTotalsRecompute: true } as const;

    const lineResults = await Promise.all(
      pendingEntries.map(async ([itemId, payload]) => {
        const item = itemById.get(itemId);
        if (!item) return { ok: true as const };

        const rolled = payload.deliverables?.length
          ? rollupDeliverableCommercials(payload.deliverables, {
              lineCurrency: item.cost_currency || "EGP",
              fxRateToEgp: item.fx_rate_to_egp ?? 1,
            })
          : null;

        return updateQuotationItemCommercials(
          {
            item_id: itemId,
            quotation_id: quotationId,
            ...payload,
            mode: (rolled ? "cost_revenue" : item.commercial_input_mode) as CommercialInputMode,
            cost: rolled?.cost ?? payload.cost ?? item.cost,
            cost_currency: item.cost_currency,
            gp_pct: rolled?.gpPct ?? payload.gp_pct ?? item.gp_pct,
            revenue: rolled?.revenue ?? payload.revenue ?? item.revenue,
            gp_value: rolled?.gpValue ?? payload.gp_value ?? item.gp_value,
            af_pct: item.af_pct,
          },
          saveOptions
        );
      })
    );

    for (const res of lineResults) {
      if (!res.ok && !firstError) firstError = res.message;
    }

    if (!firstError && metaPendingRef.current) {
      const res = await updateQuotationHeader({
        id: quotationId,
        ...metaPendingRef.current,
      });
      if (!res.ok) firstError = res.message;
    }

    if (!firstError && pendingEntries.length > 0) {
      const totalsRes = await finalizeQuotationSave(quotationId);
      if (!totalsRes.ok) firstError = totalsRes.message;
    }

    setSavePending(false);
    savePendingRef.current = false;

    if (firstError) {
      setSaveStatus("error");
      toast.error(firstError);
      return false;
    }

    linePendingRef.current.clear();
    metaPendingRef.current = null;
    setPendingLineIds(new Set());
    setHasMetaPending(false);
    setSaveStatus("saved");
    startTransition(() => {
      router.refresh();
    });
    return true;
  }, [quotationId, router]);

  const saveAllRef = useRef(saveAll);
  saveAllRef.current = saveAll;
  const savePendingRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      if (savePendingRef.current) return;

      const hadChanges = hasUnsavedRef.current;
      void saveAllRef.current().then((ok) => {
        if (ok && hadChanges) toast.success("Quotation saved.");
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const onPageHide = () => {
      if (!hasUnsavedRef.current || savePendingRef.current) return;
      for (const flush of saveFlushHandlersRef.current) {
        flush();
      }
      void saveAllRef.current();
    };

    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  const value = useMemo(
    () => ({
      registerLinePending,
      registerMetaPending,
      registerSaveFlush,
      isLinePending,
      hasUnsavedChanges,
      saveStatus,
      savePending,
      saveAll,
    }),
    [
      registerLinePending,
      registerMetaPending,
      registerSaveFlush,
      isLinePending,
      hasUnsavedChanges,
      saveStatus,
      savePending,
      saveAll,
    ]
  );

  return (
    <QuotationManualSaveContext.Provider value={value}>
      {children}
    </QuotationManualSaveContext.Provider>
  );
}

export function useQuotationManualSave(): QuotationManualSaveContextValue {
  const ctx = useContext(QuotationManualSaveContext);
  if (!ctx) {
    throw new Error("useQuotationManualSave must be used within QuotationManualSaveProvider");
  }
  return ctx;
}
