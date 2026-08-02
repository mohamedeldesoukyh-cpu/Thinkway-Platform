"use client";

import { useEffect, useState } from "react";

import { hydrateCreatorsFromDnaAction } from "@/features/creator-dna/actions/hydrate-creators-action";
import {
  getUnifiedCreatorsBatchAction,
} from "@/features/campaigns/creator-discovery-actions";
import { dedupeCreatorIds, dedupeByCreatorId } from "@/lib/creators/dedupe-creators";

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
import type { StudioEciPlanningSignal } from "../services/eci/project-studio-eci-signal";

export type { HydratedVendor } from "../services/creator-hydration-mapper";
export { mapCreatorToHydratedVendor } from "../services/creator-hydration-mapper";

const hydrationResultCache = new Map<string, Promise<HydratedVendor[]>>();

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

async function loadHydratedVendors(
  ids: string[],
  rationale: string | undefined,
  avgFitScore: number | undefined,
  mapperOptions: HydrationMapperOptions | undefined
): Promise<HydratedVendor[]> {
  const cacheKey = `${ids.join(",")}|${rationale ?? ""}|${avgFitScore ?? ""}|${JSON.stringify(mapperOptions ?? {})}`;
  const cached = hydrationResultCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async (): Promise<HydratedVendor[]> => {
    // DNA hydration loads ECI on the server — do not pass Map across the action boundary.
    const serializableOptions = mapperOptions
      ? { ...mapperOptions, eciSignalsByInfluencerId: undefined }
      : undefined;
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
          await backfillMissingAvatars(deduped, serializableOptions),
          ids
        );
      }
    } catch {
      // Fall through to unified browse hydration
    }

    try {
      const withEci = await resolveEciMapperOptions(ids, mapperOptions);
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
    const ai = order.get(a.id) ?? 999;
    const bi = order.get(b.id) ?? 999;
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

export function useCreatorHydration(
  creatorIds: string[],
  rationale?: string,
  avgFitScore?: number,
  mapperOptions?: HydrationMapperOptions
): { vendors: HydratedVendor[]; loading: boolean } {
  const [vendors, setVendors] = useState<HydratedVendor[]>([]);
  const [loading, setLoading] = useState(false);

  const idsKey = dedupeCreatorIds(creatorIds).join(",");
  const rationaleKey = rationale ?? "";
  const avgFitKey = avgFitScore ?? -1;
  const optionsKey = JSON.stringify(mapperOptions ?? {});

  useEffect(() => {
    if (!idsKey) {
      setVendors([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadHydratedVendors(
      idsKey.split(",").filter(Boolean).slice(0, STUDIO_CREATOR_HYDRATION_LIMIT),
      rationaleKey || undefined,
      avgFitKey >= 0 ? avgFitKey : undefined,
      mapperOptions
    )
      .then((result) => {
        if (!cancelled) {
          setVendors(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVendors([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey, rationaleKey, avgFitKey, optionsKey]);

  return { vendors, loading };
}
