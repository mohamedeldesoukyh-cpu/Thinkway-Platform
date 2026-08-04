"use client";

import { useEffect, useRef, useState } from "react";

import { hydrateCreatorsFromDnaAction } from "@/features/creator-dna/actions/hydrate-creators-action";
import {
  getUnifiedCreatorsBatchAction,
} from "@/features/campaigns/creator-discovery-actions";
import { dedupeCreatorIds, dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import { startLoadTimer } from "@/lib/performance/progressive-load";

import {
  STUDIO_CREATOR_HYDRATION_LIMIT,
  STUDIO_VENDOR_INITIAL_VISIBLE,
} from "../constants/hydration-limits";
import { loadStudioEciPlanningSignalsAction } from "../actions/studio-eci-actions";
import {
  mapCreatorToHydratedVendor,
  type HydratedVendor,
  type HydrationMapperOptions,
} from "../services/creator-hydration-mapper";
import {
  formatStudioEciReason,
  type StudioEciPlanningSignal,
} from "../services/eci/project-studio-eci-signal";
import { estimateViewportHydrationSeedCount } from "./use-viewport-creator-ids";

export type { HydratedVendor } from "../services/creator-hydration-mapper";
export { mapCreatorToHydratedVendor } from "../services/creator-hydration-mapper";

const hydrationResultCache = new Map<string, Promise<HydratedVendor[]>>();

function lookupSignal(
  map: Map<string, StudioEciPlanningSignal>,
  vendorId: string
): StudioEciPlanningSignal | undefined {
  const bare = vendorId.replace(/^inf:/, "").replace(/^dis:/, "");
  return (
    map.get(vendorId) ??
    map.get(bare) ??
    map.get(`inf:${bare}`) ??
    map.get(`dis:${bare}`)
  );
}

function applyEciSignalsToVendors(
  vendors: HydratedVendor[],
  signals: Map<string, StudioEciPlanningSignal>
): HydratedVendor[] {
  if (signals.size === 0) return vendors;
  return vendors.map((vendor) => {
    const eci = lookupSignal(signals, vendor.id);
    if (!eci) return vendor;
    return {
      ...vendor,
      thinkwayScore: eci.investmentScore ?? vendor.thinkwayScore,
      brandFit: eci.investmentScore ?? vendor.brandFit,
      eciRecommendation: eci.recommendation ?? vendor.eciRecommendation,
      eciConfidencePercent: eci.confidencePercent ?? vendor.eciConfidencePercent,
      planningSignal: eci,
      reason: formatStudioEciReason(eci) || vendor.reason,
    };
  });
}

async function resolveEciMapperOptions(
  ids: string[],
  mapperOptions: HydrationMapperOptions | undefined
): Promise<HydrationMapperOptions | undefined> {
  if (mapperOptions?.eciSignalsByInfluencerId?.size) return mapperOptions;
  try {
    const record = await loadStudioEciPlanningSignalsAction(ids);
    const map = new Map<string, StudioEciPlanningSignal>();
    for (const [id, signal] of Object.entries(record)) {
      map.set(id, signal);
      map.set(`inf:${id}`, signal);
    }
    if (map.size === 0) return mapperOptions;
    return { ...mapperOptions, eciSignalsByInfluencerId: map };
  } catch {
    return mapperOptions;
  }
}

function mergeVendorWaves(primary: HydratedVendor[], overlay: HydratedVendor[]): HydratedVendor[] {
  if (overlay.length === 0) return primary;
  if (primary.length === 0) return overlay;
  const byId = new Map<string, HydratedVendor>();
  for (const v of primary) byId.set(v.id, v);
  for (const v of overlay) {
    const prev = byId.get(v.id);
    if (!prev) {
      byId.set(v.id, v);
      continue;
    }
    byId.set(v.id, {
      ...prev,
      ...v,
      thinkwayScore: v.thinkwayScore ?? prev.thinkwayScore,
      eciRecommendation: v.eciRecommendation ?? prev.eciRecommendation,
      eciConfidencePercent: v.eciConfidencePercent ?? prev.eciConfidencePercent,
      planningSignal: v.planningSignal ?? prev.planningSignal,
      priceEstimate: v.priceEstimate ?? prev.priceEstimate,
      reason: v.planningSignal ? v.reason : prev.reason ?? v.reason,
      avatarUrl: v.avatarUrl ?? prev.avatarUrl,
      profileUrl: v.profileUrl ?? prev.profileUrl,
    });
  }
  return [...byId.values()];
}

async function loadHydratedVendors(
  ids: string[],
  rationale: string | undefined,
  avgFitScore: number | undefined,
  mapperOptions: HydrationMapperOptions | undefined,
  wave: { includeEci: boolean; includeQuotationPrices: boolean }
): Promise<HydratedVendor[]> {
  if (ids.length === 0) return [];
  const cacheKey = `${ids.join(",")}|${rationale ?? ""}|${avgFitScore ?? ""}|${JSON.stringify(mapperOptions ?? {})}|eci:${wave.includeEci}|qp:${wave.includeQuotationPrices}`;
  const cached = hydrationResultCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async (): Promise<HydratedVendor[]> => {
    const serializableOptions = mapperOptions
      ? {
          ...mapperOptions,
          eciSignalsByInfluencerId: undefined,
          includeEci: wave.includeEci,
          includeQuotationPrices: wave.includeQuotationPrices,
        }
      : {
          includeEci: wave.includeEci,
          includeQuotationPrices: wave.includeQuotationPrices,
        };
    try {
      const dnaResult = await hydrateCreatorsFromDnaAction(
        ids,
        rationale,
        avgFitScore,
        serializableOptions
      );
      if (dnaResult.vendors.length > 0) {
        const deduped = dedupeByCreatorId(dnaResult.vendors, (v) => v.id).items;
        return orderVendorsByCreatorIds(
          wave.includeEci
            ? await backfillMissingAvatars(deduped, serializableOptions)
            : deduped,
          ids
        );
      }
    } catch {
      // Fall through to unified browse hydration
    }

    try {
      const withEci = wave.includeEci
        ? await resolveEciMapperOptions(ids, mapperOptions)
        : mapperOptions;
      const creators = await getUnifiedCreatorsBatchAction(ids);
      const results: HydratedVendor[] = [];
      for (let index = 0; index < creators.length; index += 1) {
        const creator = creators[index];
        if (creator) {
          results.push(
            mapCreatorToHydratedVendor(creator, index, rationale, avgFitScore, withEci)
          );
        }
      }
      return orderVendorsByCreatorIds(
        dedupeByCreatorId(results, (v) => v.id).items,
        ids
      );
    } catch {
      return [];
    }
  })();

  hydrationResultCache.set(cacheKey, promise);
  return promise;
}

function orderVendorsByCreatorIds(
  vendors: HydratedVendor[],
  creatorIds: string[]
): HydratedVendor[] {
  const order = new Map<string, number>();
  dedupeCreatorIds(creatorIds).forEach((id, index) => {
    order.set(id, index);
    if (id.startsWith("inf:")) order.set(id.slice(4), index);
    else if (id.startsWith("dis:")) order.set(id.slice(4), index);
    else {
      order.set(`inf:${id}`, index);
      order.set(`dis:${id}`, index);
    }
  });

  return [...vendors].sort((a, b) => {
    const ai = order.get(a.id) ?? order.get(a.id.replace(/^inf:/, "")) ?? 999;
    const bi = order.get(b.id) ?? order.get(b.id.replace(/^inf:/, "")) ?? 999;
    return ai - bi;
  });
}

async function backfillMissingAvatars(
  vendors: HydratedVendor[],
  mapperOptions?: HydrationMapperOptions
): Promise<HydratedVendor[]> {
  const needsBackfill = vendors
    .map((vendor, index) => ({ vendor, index }))
    .filter(({ vendor }) => !vendor.avatarUrl || !vendor.profileUrl)
    .slice(0, STUDIO_VENDOR_INITIAL_VISIBLE);

  if (needsBackfill.length === 0) return vendors;

  try {
    const creators = await getUnifiedCreatorsBatchAction(
      needsBackfill.map(({ vendor }) => vendor.id)
    );
    const creatorById = new Map<string, (typeof creators)[number]>();
    for (const creator of creators) {
      creatorById.set(creator.unified_id, creator);
      if (creator.influencer_id) {
        creatorById.set(creator.influencer_id, creator);
        creatorById.set(`inf:${creator.influencer_id}`, creator);
      }
    }

    const backfilled = needsBackfill.map(({ vendor, index }) => {
      const creator =
        creatorById.get(vendor.id) ??
        creatorById.get(vendor.id.replace(/^inf:/, ""));
      if (!creator) return { index, vendor };
      const mapped = mapCreatorToHydratedVendor(
        creator,
        index,
        vendor.reason,
        vendor.brandFit,
        mapperOptions
      );
      return {
        index,
        vendor: {
          ...vendor,
          avatarUrl: mapped.avatarUrl ?? vendor.avatarUrl,
          profileUrl: mapped.profileUrl ?? vendor.profileUrl,
          platform: mapped.platform || vendor.platform,
          priceEstimate: mapped.priceEstimate ?? vendor.priceEstimate,
          reason: vendor.reason ?? mapped.reason,
        },
      };
    });

    const next = [...vendors];
    for (const { index, vendor } of backfilled) {
      next[index] = vendor;
    }
    return next;
  } catch {
    return vendors;
  }
}

function normalizeIdKey(id: string): string {
  return id.replace(/^inf:/, "").replace(/^dis:/, "");
}

export type UseCreatorHydrationOptions = {
  /**
   * Creator ids observed in/near the viewport (and previously seen).
   * When provided, hydration follows visibility — no fixed first-N batch.
   * When omitted, uses an adaptive viewport seed then hydrates remaining on idle.
   */
  visibleCreatorIds?: string[];
};

/**
 * Progressive Studio creator hydration (viewport-driven):
 * Phase 1 — DNA for visible ids (perceived slate)
 * Phase 2 — ECI overlay for those ids (full SSOT)
 * Phase 3 — quotation polish + newly scrolled-in creators
 */
export function useCreatorHydration(
  creatorIds: string[],
  rationale?: string,
  avgFitScore?: number,
  mapperOptions?: HydrationMapperOptions,
  options?: UseCreatorHydrationOptions
): { vendors: HydratedVendor[]; loading: boolean; phase: 1 | 2 | 3 } {
  const [vendors, setVendors] = useState<HydratedVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  const idsKey = dedupeCreatorIds(creatorIds).join(",");
  const rationaleKey = rationale ?? "";
  const avgFitKey = avgFitScore ?? -1;
  const optionsKey = JSON.stringify(mapperOptions ?? {});
  const visibleKey = (options?.visibleCreatorIds ?? []).join(",");

  const dnaDoneRef = useRef(new Set<string>());
  const eciDoneRef = useRef(new Set<string>());
  const quoteDoneRef = useRef(new Set<string>());
  const inFlightRef = useRef(new Set<string>());

  // Reset tracking when the slate identity changes.
  useEffect(() => {
    dnaDoneRef.current = new Set();
    eciDoneRef.current = new Set();
    quoteDoneRef.current = new Set();
    inFlightRef.current = new Set();
    setVendors([]);
    setPhase(1);
  }, [idsKey]);

  useEffect(() => {
    if (!idsKey) {
      setVendors([]);
      setPhase(1);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const allIds = idsKey.split(",").filter(Boolean).slice(0, STUDIO_CREATOR_HYDRATION_LIMIT);
    const allKeySet = new Set(allIds.map(normalizeIdKey));

    const viewportDriven = options?.visibleCreatorIds !== undefined;
    const requestedVisible = (visibleKey ? visibleKey.split(",") : []).filter(Boolean);
    const visibleOrdered = dedupeCreatorIds(
      requestedVisible.filter((id) => allKeySet.has(normalizeIdKey(id)))
    );

    // Viewport mode: hydrate what IO reports (adaptive seed before first intersection).
    // Non-viewport callers (e.g. presentation summary): hydrate all in adaptive chunks.
    const seedCount = estimateViewportHydrationSeedCount();
    const hydrateTargets = viewportDriven
      ? visibleOrdered.length > 0
        ? visibleOrdered
        : allIds.slice(0, seedCount)
      : allIds.filter((id) => !dnaDoneRef.current.has(normalizeIdKey(id))).slice(0, seedCount);

    const pendingDna = hydrateTargets.filter(
      (id) => !dnaDoneRef.current.has(normalizeIdKey(id)) && !inFlightRef.current.has(normalizeIdKey(id))
    );

    if (pendingDna.length === 0 && vendors.length > 0) {
      // Still may need ECI/quote for already-DNA ids, or newly visible.
      void (async () => {
        const needEci = hydrateTargets.filter(
          (id) =>
            dnaDoneRef.current.has(normalizeIdKey(id)) &&
            !eciDoneRef.current.has(normalizeIdKey(id))
        );
        if (needEci.length === 0) {
          setPhase(3);
          return;
        }
        setPhase(2);
        const wave2Timer = startLoadTimer("studio.creator-hydration.phase2");
        const eciRecord = await loadStudioEciPlanningSignalsAction(needEci);
        if (cancelled) return;
        const eciMap = new Map<string, StudioEciPlanningSignal>();
        for (const [id, signal] of Object.entries(eciRecord)) {
          eciMap.set(id, signal);
          eciMap.set(`inf:${id}`, signal);
        }
        for (const id of needEci) eciDoneRef.current.add(normalizeIdKey(id));
        wave2Timer.end({ eciCount: eciMap.size });
        setVendors((prev) =>
          orderVendorsByCreatorIds(applyEciSignalsToVendors(prev, eciMap), allIds)
        );
        setPhase(3);

        const needQuote = needEci.filter((id) => !quoteDoneRef.current.has(normalizeIdKey(id)));
        if (needQuote.length === 0) return;
        const quoteWave = await loadHydratedVendors(
          needQuote,
          rationaleKey || undefined,
          avgFitKey >= 0 ? avgFitKey : undefined,
          { ...mapperOptions, eciSignalsByInfluencerId: eciMap },
          { includeEci: true, includeQuotationPrices: true }
        );
        if (cancelled) return;
        for (const id of needQuote) quoteDoneRef.current.add(normalizeIdKey(id));
        setVendors((prev) =>
          orderVendorsByCreatorIds(mergeVendorWaves(prev, quoteWave), allIds)
        );
      })();
      return;
    }

    if (pendingDna.length === 0) {
      setLoading(false);
      return;
    }

    for (const id of pendingDna) inFlightRef.current.add(normalizeIdKey(id));
    setLoading(vendors.length === 0);
    setPhase(1);

    const sessionTimer = startLoadTimer("studio.creator-hydration.viewport-batch");

    async function hydrateBatch(batchIds: string[]) {
      if (batchIds.length === 0 || cancelled) return;

      const wave1Timer = startLoadTimer("studio.creator-hydration.phase1");
      const wave1 = await loadHydratedVendors(
        batchIds,
        rationaleKey || undefined,
        avgFitKey >= 0 ? avgFitKey : undefined,
        mapperOptions,
        { includeEci: false, includeQuotationPrices: false }
      );
      wave1Timer.end({ count: wave1.length, mode: viewportDriven ? "viewport" : "chunked" });
      if (cancelled) return;

      for (const id of batchIds) {
        dnaDoneRef.current.add(normalizeIdKey(id));
        inFlightRef.current.delete(normalizeIdKey(id));
      }

      setVendors((prev) =>
        orderVendorsByCreatorIds(mergeVendorWaves(prev, wave1), allIds)
      );
      setLoading(false);
      setPhase(2);

      const wave2Timer = startLoadTimer("studio.creator-hydration.phase2");
      const eciRecord = await loadStudioEciPlanningSignalsAction(batchIds);
      if (cancelled) return;
      const eciMap = new Map<string, StudioEciPlanningSignal>();
      for (const [id, signal] of Object.entries(eciRecord)) {
        eciMap.set(id, signal);
        eciMap.set(`inf:${id}`, signal);
      }
      for (const id of batchIds) eciDoneRef.current.add(normalizeIdKey(id));
      wave2Timer.end({ eciCount: eciMap.size });
      setVendors((prev) =>
        orderVendorsByCreatorIds(applyEciSignalsToVendors(prev, eciMap), allIds)
      );
      setPhase(3);

      const wave3Timer = startLoadTimer("studio.creator-hydration.phase3");
      const quoteWave = await loadHydratedVendors(
        batchIds,
        rationaleKey || undefined,
        avgFitKey >= 0 ? avgFitKey : undefined,
        { ...mapperOptions, eciSignalsByInfluencerId: eciMap },
        { includeEci: true, includeQuotationPrices: true }
      );
      wave3Timer.end({ quoteCount: quoteWave.length });
      if (cancelled) return;
      for (const id of batchIds) quoteDoneRef.current.add(normalizeIdKey(id));
      setVendors((prev) =>
        orderVendorsByCreatorIds(mergeVendorWaves(prev, quoteWave), allIds)
      );
    }

    void (async () => {
      try {
        await hydrateBatch(pendingDna);
        sessionTimer.end({ batch: pendingDna.length });

        if (!viewportDriven) {
          while (!cancelled) {
            const remaining = allIds
              .filter((id) => !dnaDoneRef.current.has(normalizeIdKey(id)))
              .slice(0, seedCount);
            if (remaining.length === 0) break;
            for (const id of remaining) inFlightRef.current.add(normalizeIdKey(id));
            await hydrateBatch(remaining);
          }
        }
      } catch {
        for (const id of pendingDna) inFlightRef.current.delete(normalizeIdKey(id));
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewport-driven batches
  }, [idsKey, rationaleKey, avgFitKey, optionsKey, visibleKey]);

  return { vendors, loading, phase };
}
