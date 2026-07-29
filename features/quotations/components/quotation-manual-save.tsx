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

import { useConfirmAction } from "@/components/shared/confirm-action-provider";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { COMMERCIAL_SYNC_CONFIRMATION_REQUIRED } from "@/lib/services/commercial/confirmation-copy";

import {
  finalizeQuotationSave,
  updateQuotationHeader,
  updateQuotationItemCommercials,
} from "@/features/quotations/actions";
import { updateQuotationClientBrand } from "@/features/quotations/lifecycle-actions";
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
  af_pct?: number | null;
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

export type QuotationClientBrandPendingPayload = {
  useTemporary: boolean;
  temporary_client_name?: string | null;
  temporary_brand_name?: string | null;
  client_id?: string | null;
  brand_id?: string | null;
  campaign_header_id?: string | null;
};

type QuotationManualSaveContextValue = {
  registerLinePending: (itemId: string, payload: QuotationLinePendingPayload) => void;
  registerMetaPending: (patch: QuotationMetaPendingPayload) => void;
  registerClientBrandPending: (payload: QuotationClientBrandPendingPayload | null) => void;
  registerSaveFlush: (flush: () => void) => () => void;
  isLinePending: (itemId: string) => boolean;
  getLinePendingPayload: (itemId: string) => QuotationLinePendingPayload | undefined;
  hasUnsavedChanges: boolean;
  hasClientBrandPending: boolean;
  saveStatus: AutosaveStatus;
  savePending: boolean;
  saveAll: () => Promise<boolean>;
};

const QuotationManualSaveContext = createContext<QuotationManualSaveContextValue | null>(null);

function QuotationManualSaveShortcuts() {
  const { saveAll, hasUnsavedChanges } = useQuotationManualSave();
  const saveAllRef = useRef(saveAll);
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  saveAllRef.current = saveAll;
  hasUnsavedRef.current = hasUnsavedChanges;

  useRegisterShortcut({
    id: "quotation-save",
    keys: "ctrl+s",
    label: "Save quotation",
    group: "Quotation",
    handler: () => {
      const hadChanges = hasUnsavedRef.current;
      void saveAllRef.current().then((ok) => {
        if (ok && hadChanges) toast.success("Quotation saved.");
      });
    },
  });

  return null;
}

type ProviderProps = {
  quotationId: string;
  items: QuotationItemRow[];
  children: ReactNode;
};

export function QuotationManualSaveProvider({ quotationId, items, children }: ProviderProps) {
  const router = useRouter();
  const { confirm } = useConfirmAction();
  const linePendingRef = useRef(new Map<string, QuotationLinePendingPayload>());
  const metaPendingRef = useRef<QuotationMetaPendingPayload | null>(null);
  const clientBrandPendingRef = useRef<QuotationClientBrandPendingPayload | null>(null);
  const saveFlushHandlersRef = useRef(new Set<() => void>());
  const itemsByIdRef = useRef(new Map(items.map((item) => [item.id, item])));
  itemsByIdRef.current = new Map(items.map((item) => [item.id, item]));
  const [pendingLineIds, setPendingLineIds] = useState<Set<string>>(() => new Set());
  const [hasMetaPending, setHasMetaPending] = useState(false);
  const [hasClientBrandPending, setHasClientBrandPending] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [savePending, setSavePending] = useState(false);

  const hasUnsavedChanges =
    pendingLineIds.size > 0 || hasMetaPending || hasClientBrandPending;
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
    const hasClientBrand = clientBrandPendingRef.current != null;
    setHasMetaPending(hasMeta);
    setHasClientBrandPending(hasClientBrand);
    if (!hasLines && !hasMeta && !hasClientBrand) {
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

  const registerClientBrandPending = useCallback(
    (payload: QuotationClientBrandPendingPayload | null) => {
      clientBrandPendingRef.current = payload;
      setHasClientBrandPending(payload != null);
      if (
        payload == null &&
        linePendingRef.current.size === 0 &&
        metaPendingRef.current == null
      ) {
        setSaveStatus("idle");
      } else if (payload != null) {
        setSaveStatus("pending");
      }
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

  const getLinePendingPayload = useCallback((itemId: string) => {
    return linePendingRef.current.get(itemId);
  }, []);

  const saveAll = useCallback(async (): Promise<boolean> => {
    if (
      !hasUnsavedRef.current &&
      linePendingRef.current.size === 0 &&
      !metaPendingRef.current &&
      !clientBrandPendingRef.current
    ) {
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

    const saveLines = async (confirmCommercialSync: boolean) => {
      const saveOptions = {
        deferRevalidate: true,
        skipTotalsRecompute: true,
        confirmCommercialSync,
      } as const;

      return Promise.all(
        pendingEntries.map(async ([itemId, payload]) => {
          const item = itemById.get(itemId);
          if (!item) return { ok: true as const };

          const rolled = payload.deliverables?.length
            ? rollupDeliverableCommercials(payload.deliverables, {
                lineCurrency: item.cost_currency || "EGP",
                fxRateToEgp: item.fx_rate_to_egp ?? 1,
                lineAfPct: payload.af_pct ?? item.af_pct,
              })
            : null;

          return updateQuotationItemCommercials(
            {
              item_id: itemId,
              quotation_id: quotationId,
              ...payload,
              mode: (rolled
                ? "cost_revenue"
                : item.commercial_input_mode) as CommercialInputMode,
              cost: rolled?.cost ?? payload.cost ?? item.cost,
              cost_currency: item.cost_currency,
              gp_pct: rolled?.gpPct ?? payload.gp_pct ?? item.gp_pct,
              revenue: rolled?.revenue ?? payload.revenue ?? item.revenue,
              gp_value: rolled?.gpValue ?? payload.gp_value ?? item.gp_value,
              af_pct: rolled?.afPct ?? payload.af_pct ?? item.af_pct,
            },
            {
              ...saveOptions,
              idempotencyKey: confirmCommercialSync
                ? `quote-save:${quotationId}:${itemId}:${Date.now()}`
                : undefined,
            }
          );
        })
      );
    };

    let lineResults = await saveLines(false);
    const syncGate = lineResults.find(
      (res) =>
        !res.ok &&
        "code" in res &&
        res.code === COMMERCIAL_SYNC_CONFIRMATION_REQUIRED
    );
    if (syncGate && !syncGate.ok && "commercialSync" in syncGate) {
      const meta = syncGate.commercialSync;
      const accepted = await confirm({
        title: meta?.confirmationTitle ?? "Update linked Campaign?",
        description:
          meta?.confirmationDescription ??
          "Updating these commercial values will automatically update both the Quotation and the Campaign.",
        confirmLabel: "Continue",
      });
      if (!accepted) {
        setSavePending(false);
        savePendingRef.current = false;
        setSaveStatus("pending");
        return false;
      }
      lineResults = await saveLines(true);
    }

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

    if (!firstError && clientBrandPendingRef.current) {
      const cb = clientBrandPendingRef.current;
      if (cb.useTemporary) {
        const res = await updateQuotationClientBrand({
          quotationId,
          is_temporary_client: true,
          temporary_client_name: cb.temporary_client_name,
          temporary_brand_name: cb.temporary_brand_name,
        });
        if (!res.ok) firstError = res.message;
      } else {
        if (!cb.client_id || !cb.brand_id) {
          firstError = "Select both legal entity and brand, or use temporary values.";
        } else {
          const res = await updateQuotationClientBrand({
            quotationId,
            client_id: cb.client_id,
            brand_id: cb.brand_id,
          });
          if (!res.ok) firstError = res.message;
        }
        if (!firstError) {
          const res = await updateQuotationHeader({
            id: quotationId,
            campaign_header_id: cb.campaign_header_id ?? null,
          });
          if (!res.ok) firstError = res.message;
        }
      }
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
    clientBrandPendingRef.current = null;
    setPendingLineIds(new Set());
    setHasMetaPending(false);
    setHasClientBrandPending(false);
    setSaveStatus("saved");
    startTransition(() => {
      router.refresh();
    });
    return true;
  }, [quotationId, router, confirm]);

  const saveAllRef = useRef(saveAll);
  saveAllRef.current = saveAll;
  const savePendingRef = useRef(false);

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
      registerClientBrandPending,
      registerSaveFlush,
      isLinePending,
      getLinePendingPayload,
      hasUnsavedChanges,
      hasClientBrandPending,
      saveStatus,
      savePending,
      saveAll,
    }),
    [
      registerLinePending,
      registerMetaPending,
      registerClientBrandPending,
      registerSaveFlush,
      isLinePending,
      getLinePendingPayload,
      hasUnsavedChanges,
      hasClientBrandPending,
      saveStatus,
      savePending,
      saveAll,
    ]
  );

  return (
    <QuotationManualSaveContext.Provider value={value}>
      <QuotationManualSaveShortcuts />
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
