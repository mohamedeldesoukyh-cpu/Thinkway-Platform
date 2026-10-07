import type { SupabaseClient } from "@supabase/supabase-js";

import { platformLabel } from "@/lib/campaigns/line-assignment";
import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { normalizeSocialPlatform } from "@/lib/social/normalize-platform";
import type { Database } from "@/types/database";
import { findMergeRateConflicts, type MergeRateRow } from "./merge-rate-conflicts";

type AnySupabase = SupabaseClient<any>;

export type MergeCreatorsEligibility = {
  canMerge: boolean;
  message: string;
  platformConflicts: string[];
  platformsToMove: string[];
};

export type MergeCreatorsResult =
  | {
      ok: true;
      creator: UnifiedCreatorResult;
      message: string;
      platformsMoved: number;
    }
  | { ok: false; message: string; platformConflicts?: string[] };

type PlatformAccountRow = {
  id: string;
  platform: string;
  is_primary: boolean | null;
};

function platformKey(platform: string): string {
  return normalizeSocialPlatform(platform) ?? platform.trim().toLowerCase();
}

function buildMergeEligibility(
  targetPlatforms: PlatformAccountRow[],
  sourcePlatforms: PlatformAccountRow[]
): MergeCreatorsEligibility {
  const targetPlatformKeys = new Set(
    targetPlatforms.map((row) => platformKey(row.platform)).filter(Boolean)
  );
  const platformConflicts = sourcePlatforms
    .filter((row) => targetPlatformKeys.has(platformKey(row.platform)))
    .map((row) => platformKey(row.platform));
  const platformsToMove = sourcePlatforms
    .filter((row) => !targetPlatformKeys.has(platformKey(row.platform)))
    .map((row) => platformKey(row.platform));

  const conflictLabels = platformConflicts.map((p) => platformLabel(p));
  const moveLabels = platformsToMove.map((p) => platformLabel(p));

  if (platformConflicts.length > 0) {
    return {
      canMerge: true,
      message: `Keep all existing accounts, including ${conflictLabels.join(", ")}, and transfer the old creator's jobs to this creator.`,
      platformConflicts: conflictLabels,
      platformsToMove,
    };
  }

  if (platformsToMove.length === 0) {
    return {
      canMerge: true,
      message: "Transfer the old creator's records and history to this creator.",
      platformConflicts: conflictLabels,
      platformsToMove,
    };
  }

  return {
    canMerge: true,
    message: `Combine ${moveLabels.join(", ")} into this creator profile.`,
    platformConflicts: conflictLabels,
    platformsToMove,
  };
}

export function evaluateMergeCreatorsEligibility(input: {
  targetPlatforms: Array<{ platform: string }>;
  sourcePlatforms: Array<{ platform: string }>;
}): MergeCreatorsEligibility {
  return buildMergeEligibility(
    input.targetPlatforms as PlatformAccountRow[],
    input.sourcePlatforms as PlatformAccountRow[]
  );
}

export async function getMergeCreatorsEligibility(
  supabase: SupabaseClient<Database>,
  input: {
    targetInfluencerId: string;
    sourceInfluencerId: string;
  }
): Promise<MergeCreatorsEligibility> {
  const targetInfluencerId = input.targetInfluencerId.trim();
  const sourceInfluencerId = input.sourceInfluencerId.trim();

  if (!targetInfluencerId || !sourceInfluencerId) {
    return {
      canMerge: false,
      message: "Both creators are required.",
      platformConflicts: [],
      platformsToMove: [],
    };
  }

  if (targetInfluencerId === sourceInfluencerId) {
    return {
      canMerge: false,
      message: "Choose a different creator to combine.",
      platformConflicts: [],
      platformsToMove: [],
    };
  }

  const { data: accounts, error } = await supabase
    .from("influencer_platform_accounts")
    .select("id, platform, is_primary, influencer_id")
    .in("influencer_id", [targetInfluencerId, sourceInfluencerId]);

  if (error) {
    return {
      canMerge: false,
      message: error.message,
      platformConflicts: [],
      platformsToMove: [],
    };
  }

  const targetPlatforms = (accounts ?? []).filter(
    (row) => row.influencer_id === targetInfluencerId
  ) as PlatformAccountRow[];
  const sourcePlatforms = (accounts ?? []).filter(
    (row) => row.influencer_id === sourceInfluencerId
  ) as PlatformAccountRow[];

  const eligibility=buildMergeEligibility(targetPlatforms, sourcePlatforms);
  if(!eligibility.canMerge)return eligibility;
  const db=supabase as AnySupabase;
  const rates: MergeRateRow[] = [];
  for (let from=0;;from+=500) {
    const result=await db.from("rate_card_lines").select("*").in("influencer_id",[targetInfluencerId,sourceInfluencerId]).order("id").range(from,from+499);
    if(result.error)return {...eligibility,canMerge:false,message:result.error.message};
    rates.push(...(result.data??[]));
    if((result.data??[]).length<500)break;
  }
  if(findMergeRateConflicts(rates,targetInfluencerId,sourceInfluencerId).length) return {...eligibility,canMerge:false,message:"Both creators have prices in the same rate card. Choose the prices to keep below, then continue the merge."};

  return eligibility;
}

export function classifyMergeReassignError(message: string): "missing" | "unique" | "fatal" {
  if (/schema cache|does not exist|could not find/i.test(message)) return "missing";
  if (/duplicate key value|unique constraint/i.test(message)) return "unique";
  return "fatal";
}

/** Transfer all creator records atomically; any failure rolls everything back. */
export async function mergeCreators(supabase: SupabaseClient<Database>, input: {
  targetInfluencerId: string; sourceInfluencerId: string; targetUnifiedId: string; actorId: string;
}): Promise<MergeCreatorsResult> {
  try {
    const result = await (supabase as AnySupabase).rpc("combine_creator_records", {
      p_target: input.targetInfluencerId, p_source: input.sourceInfluencerId,
      p_actor: input.actorId, p_patch: {},
    });
    if (result.error) return { ok: false, message: result.error.message };
    try { await persistCreatorPrimaryIdentity(supabase, input.targetInfluencerId); } catch { /* The completed transfer remains successful; identity can be refreshed separately. */ }
    const creator = await getUnifiedCreatorById(supabase, `inf:${input.targetInfluencerId}`, { skipDna: true });
    if (!creator) return { ok: false, message: "Creators combined. Close and reopen the surviving profile to reload it." };
    return { ok: true, creator, platformsMoved: Number(result.data ?? 0), message: `Creators combined. All linked work now belongs to ${creator.display_name}.` };
  } catch(error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not combine creators." };
  }
}
