"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type QuotationCreatorPlatformOption,
} from "@/features/quotations/actions";
import type { QuotationItemRow } from "@/features/quotations/types";
import {
  bootstrapPlatformOptionsFromItem,
  bootstrapManualCreatorPlatformOptions,
  isManualQuotationCreator,
  getCachedCreatorPlatformOptions,
  loadCreatorPlatformOptions,
  mergeCreatorPlatformOptions,
  quotationCreatorPlatformCacheKey,
} from "@/lib/quotations/quotation-creator-platform-options";
import {
  deliverableTypeLines,
  syncDeliverableFromTypeLines,
} from "@/lib/quotations/quotation-deliverable-types";
import type { DeliverableCommercialRollup } from "@/lib/quotations/quotation-deliverable-rollup";
import {
  resolvePricedEntryCurrency,
  rollupDeliverableCommercials,
} from "@/lib/quotations/quotation-deliverable-rollup";
import {
  createEmptyDeliverableDraft,
  ensureAtLeastOneDraft,
  fromDeliverableDrafts,
  mergeDeliverableDraftsFromServer,
  toDeliverableDrafts,
  type DeliverableDraft,
} from "@/lib/quotations/quotation-deliverable-drafts";
import type { QuotationLinePendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import { linePendingDiffersFromItem } from "@/lib/quotations/quotation-line-pending-diff";

export type { DeliverableDraft } from "@/lib/quotations/quotation-deliverable-drafts";
export { fromDeliverableDrafts, newDeliverableKey } from "@/lib/quotations/quotation-deliverable-drafts";

function hasServerLinkedPlatforms(item: QuotationItemRow): boolean {
  return (item.creator_profile_source?.linkedPlatforms?.length ?? 0) > 0;
}

export function useQuotationLineFields(
  item: QuotationItemRow,
  onDeliverableCommercialsDerived?: (
    commercials: DeliverableCommercialRollup & { costCurrency: string }
  ) => void,
  onLinePendingChange?: (payload: QuotationLinePendingPayload) => void,
  lineSaveStatus: AutosaveStatus = "idle",
  hasPendingChanges = false,
  registerSaveFlush?: (flush: () => void) => () => void,
  /** Live line FX from shared draft (Cost Detail may change currency before remount). */
  liveLineFx?: { costCurrency?: string; fxRateToEgp?: number }
) {
  const cacheKey = quotationCreatorPlatformCacheKey(item);
  const linkedPlatformsKey = (item.creator_profile_source?.linkedPlatforms ?? []).join(",");
  const linkedPlatformHandle =
    item.creator_profile_source?.handle ?? item.handle ?? "";
  const [platformOptions, setPlatformOptions] = useState<QuotationCreatorPlatformOption[]>(() => {
    const bootstrap = bootstrapPlatformOptionsFromItem(item);
    const cached = getCachedCreatorPlatformOptions(cacheKey);
    if (cached?.length) return mergeCreatorPlatformOptions(bootstrap, cached);
    return bootstrap;
  });
  const [loadingPlatforms, setLoadingPlatforms] = useState(
    () => platformOptions.length === 0 && cacheKey != null
  );

  useEffect(() => {
    let cancelled = false;
    const bootstrap = bootstrapPlatformOptionsFromItem(item);

    const applyPlatforms = (fetched: QuotationCreatorPlatformOption[]) => {
      setPlatformOptions(mergeCreatorPlatformOptions(bootstrap, fetched));
      setLoadingPlatforms(false);
    };

    const cached = getCachedCreatorPlatformOptions(cacheKey);
    if (cached?.length) {
      applyPlatforms(cached);
      if (!hasServerLinkedPlatforms(item)) {
        void loadCreatorPlatformOptions(item).then((platforms) => {
          if (cancelled) return;
          applyPlatforms(platforms);
        });
      }
      return () => {
        cancelled = true;
      };
    }

    if (bootstrap.length > 0) {
      applyPlatforms(bootstrap);
      if (!hasServerLinkedPlatforms(item)) {
        void loadCreatorPlatformOptions(item).then((platforms) => {
          if (cancelled) return;
          applyPlatforms(platforms);
        });
      }
      return () => {
        cancelled = true;
      };
    }

    if (cacheKey) {
      setLoadingPlatforms(true);
    }

    void loadCreatorPlatformOptions(item).then((platforms) => {
      if (cancelled) return;
      applyPlatforms(platforms);
    });

    return () => {
      cancelled = true;
    };
  }, [
    cacheKey,
    item.unified_id,
    item.influencer_id,
    item.profile_id,
    item.platform,
    item.handle,
    item.followers,
    item.engagement_rate,
    linkedPlatformsKey,
  ]);

  const [serviceDescription, setServiceDescription] = useState(item.service_description ?? "");
  const [deliverableDrafts, setDeliverableDrafts] = useState<DeliverableDraft[]>(() => {
    const fromServer = toDeliverableDrafts(item.deliverables);
    return fromServer.length > 0 ? fromServer : [createEmptyDeliverableDraft(item)];
  });

  const platformSelectOptions = useMemo(() => {
    const fromLinked = linkedPlatformsKey
      ? linkedPlatformsKey.split(",").map((platform) => ({
          platform,
          handle: linkedPlatformHandle,
          followers: item.followers,
          engagement_rate: item.engagement_rate,
        }))
      : [];
    const fromLinePlatform = item.platform
      ? [
          {
            platform: item.platform,
            handle: item.handle ?? "",
            followers: item.followers,
            engagement_rate: item.engagement_rate,
          },
        ]
      : [];
    const manualFallback =
      isManualQuotationCreator(item) &&
      fromLinked.length === 0 &&
      fromLinePlatform.length === 0 &&
      platformOptions.length === 0
        ? bootstrapManualCreatorPlatformOptions()
        : [];
    return mergeCreatorPlatformOptions(
      manualFallback,
      platformOptions,
      fromLinked,
      fromLinePlatform
    );
  }, [
    platformOptions,
    item.platform,
    item.handle,
    item.followers,
    item.engagement_rate,
    linkedPlatformsKey,
    linkedPlatformHandle,
    item.influencer_id,
    item.profile_id,
    item.unified_id,
  ]);

  const platformSelectKey = platformSelectOptions.map((p) => p.platform).join(",");

  useEffect(() => {
    if (hasPendingChanges || localDraftDirtyRef.current || commitTimerRef.current) return;
    setServiceDescription(item.service_description ?? "");
    const allowed = platformSelectKey ? platformSelectKey.split(",") : [];
    setDeliverableDrafts((prev) =>
      mergeDeliverableDraftsFromServer(prev, item, allowed, { preserveLocal: false })
    );
  }, [
    item.id,
    item.service_description,
    item.deliverables,
    item.platform,
    platformSelectKey,
    hasPendingChanges,
  ]);

  const lineCurrency = (
    liveLineFx?.costCurrency ||
    item.cost_currency ||
    "EGP"
  ).toUpperCase();
  const lineFxRateToEgp =
    lineCurrency === "EGP"
      ? 1
      : liveLineFx?.fxRateToEgp ?? item.fx_rate_to_egp ?? 1;

  const derivedCommercials = useMemo(() => {
    const deliverables = fromDeliverableDrafts(deliverableDrafts);
    const entryCurrency = resolvePricedEntryCurrency(deliverables, lineCurrency);
    const rolled = rollupDeliverableCommercials(deliverables, {
      lineCurrency: entryCurrency,
      fxRateToEgp:
        entryCurrency === "EGP"
          ? 1
          : entryCurrency === lineCurrency
            ? lineFxRateToEgp
            : lineFxRateToEgp,
      lineAfPct: item.af_pct,
    });
    if (!rolled) return null;
    return { ...rolled, costCurrency: entryCurrency };
  }, [deliverableDrafts, lineCurrency, lineFxRateToEgp, item.af_pct]);

  const onDeliverableCommercialsDerivedRef = useRef(onDeliverableCommercialsDerived);
  onDeliverableCommercialsDerivedRef.current = onDeliverableCommercialsDerived;

  const lastDerivedCommercialsKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!derivedCommercials) {
      lastDerivedCommercialsKeyRef.current = null;
      return;
    }
    const key = [
      derivedCommercials.cost,
      derivedCommercials.revenue,
      derivedCommercials.gpValue,
      derivedCommercials.gpPct,
      derivedCommercials.afValue,
      derivedCommercials.afPct,
      derivedCommercials.costCurrency,
    ].join("|");
    if (lastDerivedCommercialsKeyRef.current === key) return;
    lastDerivedCommercialsKeyRef.current = key;
    onDeliverableCommercialsDerivedRef.current?.(derivedCommercials);
  }, [derivedCommercials]);

  const deliverableDraftsRef = useRef(deliverableDrafts);
  deliverableDraftsRef.current = deliverableDrafts;
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localDraftDirtyRef = useRef(false);

  const commitDeliverableDrafts = useCallback(
    (drafts: DeliverableDraft[]) => {
      const allowed = platformSelectOptions.map((p) => p.platform);
      const sanitized = drafts.map((d) => {
        const fallback = d.platform || item.platform || allowed[0] || "instagram";
        const lines = d.type_lines?.length ? d.type_lines : deliverableTypeLines(d);
        const synced = syncDeliverableFromTypeLines(lines, allowed, fallback);
        return { ...d, ...synced };
      });
      const withMinimum = ensureAtLeastOneDraft(sanitized, item, allowed);
      setDeliverableDrafts(withMinimum);
      const deliverables = fromDeliverableDrafts(withMinimum);
      const entryCurrency = resolvePricedEntryCurrency(deliverables, lineCurrency);
      const entryFx =
        entryCurrency === "EGP"
          ? 1
          : entryCurrency === lineCurrency
            ? lineFxRateToEgp
            : lineFxRateToEgp;
      const rolled = rollupDeliverableCommercials(deliverables, {
        lineCurrency: entryCurrency,
        fxRateToEgp: entryFx,
        lineAfPct: item.af_pct,
      });
      // When deliverables are unpriced, only stage deliverable JSON.
      // Never overwrite staged Master cost/revenue with persisted zeros (Save wipe bug).
      const payload: QuotationLinePendingPayload = rolled
        ? {
            deliverables,
            revenue: rolled.revenue,
            cost: rolled.cost,
            cost_currency: entryCurrency,
            gp_pct: rolled.gpPct,
            gp_value: rolled.gpValue,
            af_pct: rolled.afPct,
            mode: "cost_revenue",
          }
        : { deliverables };

      localDraftDirtyRef.current = false;

      if (!linePendingDiffersFromItem(item, payload)) {
        return withMinimum;
      }

      onLinePendingChange?.(payload);
      if (rolled) {
        onDeliverableCommercialsDerived?.({ ...rolled, costCurrency: entryCurrency });
      }
      return withMinimum;
    },
    [
      onLinePendingChange,
      onDeliverableCommercialsDerived,
      item.revenue,
      item.cost,
      item.gp_pct,
      item.gp_value,
      item.af_pct,
      item.platform,
      platformSelectOptions,
      lineCurrency,
      lineFxRateToEgp,
    ]
  );

  const flushScheduledCommit = useCallback(() => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (!localDraftDirtyRef.current) return;
    commitDeliverableDrafts(deliverableDraftsRef.current);
  }, [commitDeliverableDrafts]);

  useEffect(() => {
    if (!registerSaveFlush) return;
    return registerSaveFlush(flushScheduledCommit);
  }, [registerSaveFlush, flushScheduledCommit]);

  useEffect(
    () => () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    },
    []
  );

  const scheduleDeliverableCommit = useCallback(() => {
    localDraftDirtyRef.current = true;
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      commitDeliverableDrafts(deliverableDraftsRef.current);
    }, 500);
  }, [commitDeliverableDrafts]);

  const queueLineDetails = useCallback(
    (payload: QuotationLinePendingPayload) => {
      onLinePendingChange?.(payload);
    },
    [onLinePendingChange]
  );

  const saveDeliverables = useCallback(
    (next: DeliverableDraft[]) => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
      commitDeliverableDrafts(next);
    },
    [commitDeliverableDrafts]
  );

  const handlePlatformChange = useCallback(
    (platform: string) => {
      const account = platformSelectOptions.find((p) => p.platform === platform);
      const nextDeliverables = deliverableDrafts.map((d) => ({ ...d, platform }));
      setDeliverableDrafts(nextDeliverables);
      queueLineDetails({
        platform,
        handle: account?.handle ?? item.handle,
        followers: account?.followers ?? item.followers,
        engagement_rate: account?.engagement_rate ?? item.engagement_rate,
        deliverables: fromDeliverableDrafts(nextDeliverables),
      });
    },
    [platformSelectOptions, item, deliverableDrafts, queueLineDetails]
  );

  const updateDeliverableDraftLocal = useCallback(
    (key: string, patch: Partial<DeliverableDraft>) => {
      localDraftDirtyRef.current = true;
      setDeliverableDrafts((prev) =>
        prev.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft))
      );
    },
    []
  );

  const handleAddDeliverable = useCallback(() => {
    const allowedPlatforms = platformSelectOptions.map((p) => p.platform);
    setDeliverableDrafts((prev) => [
      ...prev,
      createEmptyDeliverableDraft(item, allowedPlatforms),
    ]);
  }, [item, platformSelectOptions]);

  const removeDeliverable = useCallback(
    (key: string) => {
      saveDeliverables(deliverableDrafts.filter((d) => d.key !== key));
    },
    [deliverableDrafts, saveDeliverables]
  );

  return {
    loadingPlatforms,
    platformSelectOptions,
    serviceDescription,
    setServiceDescription,
    deliverableDrafts,
    saveDeliverables,
    updateDeliverableDraftLocal,
    handlePlatformChange,
    handleAddDeliverable,
    removeDeliverable,
    queueLineDetails,
    scheduleDeliverableCommit,
    flushScheduledCommit,
    lineSaveStatus,
  };
}
