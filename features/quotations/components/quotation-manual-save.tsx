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
import {
  COMMERCIAL_SYNC_CONFIRMATION_REQUIRED,
  financeLockConfirmationCopy,
} from "@/lib/services/commercial/confirmation-copy";
import {
  CommercialRevisionDialog,
  type CommercialRevisionDialogLine,
} from "@/features/campaigns/components/commercial-revision-dialog";

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
import { stripDeliverableCommercialAmounts, shouldPreferDeliverableRollup } from "@/lib/quotations/quotation-line-commercial-ssot";
import { diffMasterChanges } from "@/lib/services/commercial/field-registry";

export type QuotationLinePendingPayload = {
  /** Client-only edit authority; never sent to the server action. */
  commercial_source?: "master" | "deliverables";
  service_description?: string | null;
  deliverables?: QuotationDeliverable[];
  revenue?: number | null;
  cost?: number | null;
  cost_currency?: string;
  cost_fx_override?: string | null;
  revenue_fx_override?: string | null;
  gp_pct?: number | null;
  gp_value?: number | null;
  af_pct?: number | null;
  /** Full commercial input mode when staged from Commercial Workspace / row editors. */
  mode?: CommercialInputMode;
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
  const savePendingRef = useRef(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionCampaignHeaderId, setRevisionCampaignHeaderId] = useState<
    string | null
  >(null);
  const [revisionLines, setRevisionLines] = useState<
    CommercialRevisionDialogLine[]
  >([]);

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
      // Omit undefined keys so a deliverable-only flush cannot wipe staged Master fields.
      const merged: QuotationLinePendingPayload = { ...prev };
      for (const [key, value] of Object.entries(payload) as Array<
        [keyof QuotationLinePendingPayload, QuotationLinePendingPayload[keyof QuotationLinePendingPayload]]
      >) {
        if (value !== undefined) {
          (merged as Record<string, unknown>)[key as string] = value;
        }
      }

      // Cost-only deliverable flush must not zero Master revenue after markup / CW edits.
      const prevRevenue = Number(prev.revenue ?? item?.revenue ?? 0);
      const incomingRevenue = payload.revenue;
      if (
        payload.commercial_source !== "master" &&
        prevRevenue > 0 &&
        incomingRevenue != null &&
        Number(incomingRevenue) <= 0 &&
        payload.deliverables != null &&
        (payload.cost != null || payload.mode === "cost_revenue")
      ) {
        merged.revenue = prev.revenue ?? item?.revenue;
        merged.cost = prev.cost ?? payload.cost ?? item?.cost;
        merged.gp_pct = prev.gp_pct ?? item?.gp_pct;
        merged.gp_value = prev.gp_value ?? item?.gp_value;
        merged.af_pct = prev.af_pct ?? payload.af_pct ?? item?.af_pct;
        merged.mode = prev.mode ?? payload.mode ?? item?.commercial_input_mode;
      }

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
    if (savePendingRef.current) return false;
    savePendingRef.current = true;
    try {
      // Flush editor buffers before deciding whether there is anything to save.
      for (const flush of [...saveFlushHandlersRef.current]) flush();
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

      const savedMeta = metaPendingRef.current;
      const savedClientBrand = clientBrandPendingRef.current;
      const itemById = itemsByIdRef.current;
      let firstError: string | undefined;
      const stagedEntries = [...linePendingRef.current.entries()];
      const pendingEntries = stagedEntries.filter(([itemId, payload]) => {
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
                  lineCurrency: payload.cost_currency || item.cost_currency || "EGP",
                  fxRateToEgp: item.fx_rate_to_egp ?? 1,
                  lineAfPct: payload.af_pct ?? item.af_pct,
                })
              : null;
            const masterRevenue = payload.revenue ?? item.revenue;
            const useRolled = payload.commercial_source !== "master" && shouldPreferDeliverableRollup({
              rolled,
              masterRevenue,
            });

            const { commercial_source: _source, ...commercialPayload } = payload;
            return updateQuotationItemCommercials(
              {
                item_id: itemId,
                quotation_id: quotationId,
                ...commercialPayload,
                ...(payload.commercial_source === "master" && payload.deliverables
                  ? { deliverables: stripDeliverableCommercialAmounts(payload.deliverables) }
                  : {}),
                mode: (useRolled
                  ? "cost_revenue"
                  : payload.mode ?? item.commercial_input_mode) as CommercialInputMode,
                cost: useRolled ? rolled!.cost : (payload.cost ?? item.cost),
                cost_currency: payload.cost_currency ?? item.cost_currency,
                gp_pct: useRolled ? rolled!.gpPct : (payload.gp_pct ?? item.gp_pct),
                revenue: useRolled ? rolled!.revenue : (payload.revenue ?? item.revenue),
                gp_value: useRolled ? rolled!.gpValue : (payload.gp_value ?? item.gp_value),
                af_pct: useRolled ? rolled!.afPct : (payload.af_pct ?? item.af_pct),
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

      const financeGate = lineResults.find(
        (res) => !res.ok && "code" in res && res.code === "FINANCE_LOCKED"
      );
      if (financeGate && !financeGate.ok) {
        const copy = financeLockConfirmationCopy();
        const meta =
          "commercialSync" in financeGate ? financeGate.commercialSync : null;
        const accepted = await confirm({
          title: meta?.confirmationTitle ?? copy.title,
          description: meta?.confirmationDescription ?? copy.description,
          confirmLabel: copy.confirmLabel,
        });
        if (accepted) {
          const campaignHeaderId = meta?.campaignHeaderId ?? null;
          if (!campaignHeaderId) {
            toast.error(
              "Cannot start Commercial Revision — missing Campaign linkage."
            );
            setSaveStatus("pending");
            return false;
          } else {
            const lines: CommercialRevisionDialogLine[] = [];
            for (const [itemId, payload] of pendingEntries) {
              const item = itemById.get(itemId);
              if (!item) continue;
              const rolled = payload.commercial_source !== "master" && payload.deliverables?.length
                ? rollupDeliverableCommercials(payload.deliverables, {
                    lineCurrency: item.cost_currency || "EGP",
                    fxRateToEgp: item.fx_rate_to_egp ?? 1,
                    lineAfPct: payload.af_pct ?? item.af_pct,
                  })
                : null;
              const current = {
                creator_cost: item.cost,
                client_revenue: item.revenue,
                cost_currency: item.cost_currency,
                exchange_rate: item.fx_rate_to_egp,
                cost_fx_override: item.cost_fx_override ?? null,
                revenue_fx_override: item.revenue_fx_override ?? null,
                agency_fee_percent: item.af_pct,
                commercial_input_mode: item.commercial_input_mode,
                gp_pct_input: item.gp_pct,
                gp_value_input: item.gp_value,
              };
              const proposed = {
                creator_cost: rolled?.cost ?? payload.cost ?? item.cost,
                client_revenue:
                  rolled?.revenue ?? payload.revenue ?? item.revenue,
                cost_currency: payload.cost_currency ?? item.cost_currency,
                exchange_rate: item.fx_rate_to_egp,
                cost_fx_override: payload.cost_fx_override !== undefined ? payload.cost_fx_override : item.cost_fx_override ?? null,
                revenue_fx_override: payload.revenue_fx_override !== undefined ? payload.revenue_fx_override : item.revenue_fx_override ?? null,
                agency_fee_percent:
                  rolled?.afPct ?? payload.af_pct ?? item.af_pct,
                commercial_input_mode: (rolled
                  ? "cost_revenue"
                  : item.commercial_input_mode) as CommercialInputMode,
                gp_pct_input: rolled?.gpPct ?? payload.gp_pct ?? item.gp_pct,
                gp_value_input:
                  rolled?.gpValue ?? payload.gp_value ?? item.gp_value,
              };
              const { fieldChanges } = diffMasterChanges(current, proposed);
              if (fieldChanges.length === 0) continue;
              lines.push({
                commercialLineId: itemId,
                current,
                proposed,
              });
            }
            if (lines.length === 0) {
              toast.message("No Master commercial changes to revise", {
                description:
                  "Issue/validity dates and other document fields are not Commercial Revision Masters. Save them without opening a revision — only cost, revenue, GP, fees, and currency require approval after finance lock.",
              });
              // Fall through: lines had no Master deltas (e.g. date-only save).
              // Retry line path is unnecessary; continue to header meta save below.
              lineResults = pendingEntries.map(() => ({ ok: true as const }));
            } else {
              setRevisionCampaignHeaderId(campaignHeaderId);
              setRevisionLines(lines);
              setRevisionOpen(true);
              setSaveStatus("pending");
              return false;
            }
          }
        } else {
          setSaveStatus("pending");
          return false;
        }
      }

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
          setSaveStatus("pending");
          return false;
        }
        lineResults = await saveLines(true);
      }

      for (const res of lineResults) {
        if (!res.ok && !firstError) firstError = res.message;
      }

      if (!firstError && savedMeta) {
        const res = await updateQuotationHeader({
          id: quotationId,
          ...savedMeta,
        });
        if (!res.ok) firstError = res.message;
      }

      if (!firstError && savedClientBrand) {
        const cb = savedClientBrand;
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

      if (firstError) {
        setSaveStatus("error");
        toast.error(firstError);
        return false;
      }

      // Preserve changes made while this request was in flight.
      for (const [id, payload] of stagedEntries) {
        if (linePendingRef.current.get(id) === payload) linePendingRef.current.delete(id);
      }
      if (metaPendingRef.current === savedMeta) metaPendingRef.current = null;
      if (clientBrandPendingRef.current === savedClientBrand) clientBrandPendingRef.current = null;
      syncPendingState();
      setSaveStatus(linePendingRef.current.size || metaPendingRef.current || clientBrandPendingRef.current ? "pending" : "saved");
      startTransition(() => {
        router.refresh();
      });
      return true;
    } catch (error) {
      setSaveStatus("error");
      toast.error(error instanceof Error ? error.message : "Could not save quotation. Your changes are still available; please retry.");
      return false;
    } finally {
      setSavePending(false);
      savePendingRef.current = false;
    }
  }, [quotationId, router, confirm, syncPendingState]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
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
      {revisionCampaignHeaderId ? (
        <CommercialRevisionDialog
          open={revisionOpen}
          onOpenChange={setRevisionOpen}
          campaignHeaderId={revisionCampaignHeaderId}
          quotationId={quotationId}
          lines={revisionLines}
        />
      ) : null}
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
