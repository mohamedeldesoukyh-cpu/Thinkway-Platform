import type { SupabaseClient } from "@supabase/supabase-js";

import { platformLabel } from "@/lib/campaigns/line-assignment";
import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { mergeAuthoritative } from "@/lib/discovery-import/merge";
import { normalizeSocialPlatform } from "@/lib/social/normalize-platform";
import type { Database } from "@/types/database";

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

type InfluencerMergeRow = Pick<
  Database["public"]["Tables"]["influencers"]["Row"],
  | "id"
  | "display_name"
  | "email"
  | "phone"
  | "country_code"
  | "country_codes"
  | "categories"
  | "languages"
  | "rate_card"
  | "notes"
  | "influencer_url"
  | "primary_avatar_url"
  | "default_metrics_platform_account_id"
>;

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function mergeStringArrays(
  target: string[] | null | undefined,
  source: string[] | null | undefined
): string[] {
  return uniqueStrings([...(target ?? []), ...(source ?? [])]);
}

function mergeRateCards(
  target: Record<string, unknown> | null | undefined,
  source: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const next = { ...(target ?? {}) };
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim().length === 0) continue;
    if (!(key in next) || next[key] == null || next[key] === "") {
      next[key] = value;
    }
  }
  return next;
}

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
  // Preserve rate-card prices: overlapping pricing keys require explicit review,
  // never the generic merge helper's delete-on-unique-conflict behavior.
  const db=supabase as AnySupabase;
  // Never delete a completed job or commercial document to make a unique key fit.
  for(const [table,columns] of [["discovery_shortlist_items",["shortlist_id","collapse_group_id"]],["campaign_influencers",["campaign_header_id","campaign_line_id"]],["vendor_ios",["campaign_header_id"]]] as const){
    let query=db.from(table).select(["id","influencer_id",...columns].join(",")).in("influencer_id",[targetInfluencerId,sourceInfluencerId]);
    if(table==="vendor_ios")query=query.eq("is_superseded",false);
    const records=await query;if(records.error)return {...eligibility,canMerge:false,message:records.error.message};
    const keys=new Map<string,string>();
    for(const row of records.data??[]){const key=JSON.stringify(columns.map(column=>row[column]??null));const owner=keys.get(key);if(owner&&owner!==row.influencer_id)return {...eligibility,canMerge:false,message:`Both creators are used in the same ${table}. Review the overlapping records before replacement; existing jobs and prices are preserved.`};keys.set(key,row.influencer_id);}
  }
  const rates=await db.from("rate_card_lines").select("version_id,platform,deliverable,price_type,influencer_id").in("influencer_id",[targetInfluencerId,sourceInfluencerId]);
  if(rates.error)return {...eligibility,canMerge:false,message:rates.error.message};
  const rateKeys=new Set<string>();
  for(const rate of rates.data??[]){const key=JSON.stringify([rate.version_id,rate.platform,rate.deliverable,rate.price_type]);if(rateKeys.has(key))return {...eligibility,canMerge:false,message:"Both creators have prices in the same rate card. Resolve the overlapping prices before replacing the creator; no prices have been removed."};rateKeys.add(key);}
  const avatars=await db.from("rate_card_creator_avatars").select("card_id").in("creator_ref",[`inf:${targetInfluencerId}`,`inf:${sourceInfluencerId}`]);
  if(avatars.error)return {...eligibility,canMerge:false,message:avatars.error.message};
  const cards=new Set<string>();for(const row of avatars.data??[]){if(cards.has(row.card_id))return {...eligibility,canMerge:false,message:"Both creators have a custom photo in the same rate card. Choose one photo before combining."};cards.add(row.card_id);}
  return eligibility;
}

async function dedupeShortlistItems(
  supabase: SupabaseClient<Database>,
  targetInfluencerId: string,
  sourceInfluencerId: string
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("discovery_shortlist_items")
    .select("id, shortlist_id, collapse_group_id, influencer_id")
    .in("influencer_id", [targetInfluencerId, sourceInfluencerId]);

  if (error) throw new Error(error.message);

  const targetRows = (rows ?? []).filter((row) => row.influencer_id === targetInfluencerId);
  const sourceRows = (rows ?? []).filter((row) => row.influencer_id === sourceInfluencerId);
  const targetKeys = new Set(
    targetRows.map(
      (row) => `${row.shortlist_id}:${row.collapse_group_id ?? "standalone"}`
    )
  );

  const duplicateSourceIds = sourceRows
    .filter((row) =>
      targetKeys.has(`${row.shortlist_id}:${row.collapse_group_id ?? "standalone"}`)
    )
    .map((row) => row.id);

  if (duplicateSourceIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("discovery_shortlist_items")
      .delete()
      .in("id", duplicateSourceIds);
    if (deleteError) throw new Error(deleteError.message);
  }
}

async function dedupeCampaignAssignments(
  supabase: SupabaseClient<Database>,
  targetInfluencerId: string,
  sourceInfluencerId: string
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("campaign_influencers")
    .select("id, campaign_header_id, campaign_line_id, influencer_id")
    .in("influencer_id", [targetInfluencerId, sourceInfluencerId]);

  if (error) throw new Error(error.message);

  const targetRows = (rows ?? []).filter((row) => row.influencer_id === targetInfluencerId);
  const sourceRows = (rows ?? []).filter((row) => row.influencer_id === sourceInfluencerId);
  const targetKeys = new Set(
    targetRows.map((row) => `${row.campaign_header_id}:${row.campaign_line_id ?? "none"}`)
  );

  const duplicateSourceIds = sourceRows
    .filter((row) =>
      targetKeys.has(`${row.campaign_header_id}:${row.campaign_line_id ?? "none"}`)
    )
    .map((row) => row.id);

  if (duplicateSourceIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("campaign_influencers")
      .delete()
      .in("id", duplicateSourceIds);
    if (deleteError) throw new Error(deleteError.message);
  }
}

async function dedupeVendorIos(
  supabase: SupabaseClient<Database>,
  targetInfluencerId: string,
  sourceInfluencerId: string
): Promise<void> {
  const db = supabase as AnySupabase;
  const { data: rows, error } = await db
    .from("vendor_ios")
    .select("id, campaign_header_id, influencer_id, is_superseded")
    .in("influencer_id", [targetInfluencerId, sourceInfluencerId]);

  if (error) throw new Error(error.message);

  type VendorIoRow = {
    id: string;
    campaign_header_id: string | null;
    influencer_id: string;
    is_superseded: boolean | null;
  };

  const typedRows = (rows ?? []) as VendorIoRow[];
  const activeTargetCampaigns = new Set(
    typedRows
      .filter((row) => row.influencer_id === targetInfluencerId && row.is_superseded === false)
      .map((row) => row.campaign_header_id)
      .filter(Boolean)
  );

  const duplicateSourceIds = typedRows
    .filter(
      (row) =>
        row.influencer_id === sourceInfluencerId &&
        row.is_superseded === false &&
        row.campaign_header_id &&
        activeTargetCampaigns.has(row.campaign_header_id)
    )
    .map((row) => row.id);

  if (duplicateSourceIds.length > 0) {
    const { error: deleteError } = await db
      .from("vendor_ios")
      .delete()
      .in("id", duplicateSourceIds);
    if (deleteError) throw new Error(deleteError.message);
  }
}

export function classifyMergeReassignError(
  message: string
): "missing" | "unique" | "fatal" {
  if (/schema cache|does not exist|could not find/i.test(message)) return "missing";
  if (/duplicate key value|unique constraint/i.test(message)) return "unique";
  return "fatal";
}

async function reassignColumnReferencesRowByRow(
  supabase: AnySupabase,
  input: {
    table: string;
    column: string;
    targetInfluencerId: string;
    sourceInfluencerId: string;
  }
): Promise<void> {
  const { data, error } = await supabase
    .from(input.table)
    .select("id")
    .eq(input.column, input.sourceInfluencerId);
  if (error) throw new Error(`${input.table}.${input.column}: ${error.message}`);

  for (const row of data ?? []) {
    const { error: updateError } = await supabase
      .from(input.table)
      .update({ [input.column]: input.targetInfluencerId })
      .eq("id", row.id);
    if (!updateError) continue;
    if (classifyMergeReassignError(updateError.message) !== "unique") {
      throw new Error(`${input.table}.${input.column}: ${updateError.message}`);
    }
    const { error: deleteError } = await supabase
      .from(input.table)
      .delete()
      .eq("id", row.id);
    if (deleteError) throw new Error(`${input.table}.${input.column}: ${deleteError.message}`);
  }
}

async function reassignColumnReferences(
  supabase: SupabaseClient<Database>,
  input: {
    table: string;
    column: string;
    targetInfluencerId: string;
    sourceInfluencerId: string;
  }
): Promise<void> {
  const db = supabase as AnySupabase;
  const { error } = await db
    .from(input.table)
    .update({ [input.column]: input.targetInfluencerId })
    .eq(input.column, input.sourceInfluencerId);
  if (!error) return;

  const kind = classifyMergeReassignError(error.message);
  if (kind === "missing") return;
  if (kind === "unique") {
    throw new Error(`${input.table}: overlapping records prevent replacement. No conflicting record was deleted.`);
  }
  throw new Error(`${input.table}.${input.column}: ${error.message}`);
}

async function reassignInfluencerReferences(
  supabase: SupabaseClient<Database>,
  targetInfluencerId: string,
  sourceInfluencerId: string
): Promise<void> {
  const influencerIdTables = [
    "discovery_shortlist_items",
    "quotation_items",
    "campaign_influencers",
    "deliverables",
    "vendor_ios",
    "campaign_publications",
    "creator_sources",
    "creator_enrichment_runs",
    "influencer_metrics_history",
    "creator_content_performance_baselines",
    "creator_intelligence_monthly_metrics",
    "creator_intelligence_commercial_history",
    "creator_intelligence_category_brand_history",
    "creator_intelligence_performance_history",
    "creator_intelligence_audience_history",
    "creator_intelligence_investment_history",
    "influencer_documents",
    "discovered_profiles",
    "ipl_provider_runs",
    "ipl_snapshots",
  ] as const;

  const avatarMove=await (supabase as AnySupabase).from("rate_card_creator_avatars").update({creator_ref:`inf:${targetInfluencerId}`}).eq("creator_ref",`inf:${sourceInfluencerId}`);
  if(avatarMove.error)throw new Error(avatarMove.error.message);
  const rateMove=await (supabase as AnySupabase).from("rate_card_lines").update({influencer_id:targetInfluencerId}).eq("influencer_id",sourceInfluencerId);
  if(rateMove.error)throw new Error(rateMove.error.message);

  for (const table of influencerIdTables) {
    await reassignColumnReferences(supabase, {
      table,
      column: "influencer_id",
      targetInfluencerId,
      sourceInfluencerId,
    });
  }

  // Finance / IO tables use vendor_id (ON DELETE RESTRICT) — must move before source delete.
  for (const table of [
    "vendor_payments",
    "vendor_invoices",
    "vendor_statements",
    "vendor_credit_notes",
  ] as const) {
    await reassignColumnReferences(supabase, {
      table,
      column: "vendor_id",
      targetInfluencerId,
      sourceInfluencerId,
    });
  }
}

async function moveCreatorDnaIfNeeded(
  supabase: SupabaseClient<Database>,
  targetInfluencerId: string,
  sourceInfluencerId: string
): Promise<void> {
  const db = supabase as AnySupabase;
  const [{ data: targetDna }, { data: sourceDna }] = await Promise.all([
    db.from("creator_dna").select("influencer_id").eq("influencer_id", targetInfluencerId).maybeSingle(),
    db.from("creator_dna").select("influencer_id").eq("influencer_id", sourceInfluencerId).maybeSingle(),
  ]);

  if (!sourceDna) return;

  // Target already owns DNA — drop duplicate source DNA so the source profile can be removed.
  if (targetDna) {
    for (const table of ["creator_dna_lineage_events", "creator_dna_versions", "creator_dna"] as const) {
      const { error } = await db.from(table).delete().eq("influencer_id", sourceInfluencerId);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    return;
  }

  const { error: dnaError } = await db
    .from("creator_dna")
    .update({ influencer_id: targetInfluencerId })
    .eq("influencer_id", sourceInfluencerId);
  if (dnaError) throw new Error(dnaError.message);

  for (const table of ["creator_dna_versions", "creator_dna_lineage_events"] as const) {
    const { error } = await db
      .from(table)
      .update({ influencer_id: targetInfluencerId })
      .eq("influencer_id", sourceInfluencerId);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

function buildMergedInfluencerPatch(
  target: InfluencerMergeRow,
  source: InfluencerMergeRow
): Partial<InfluencerMergeRow> {
  return {
    email: mergeAuthoritative(target.email, source.email, "email"),
    phone: mergeAuthoritative(target.phone, source.phone, "phone"),
    country_code: mergeAuthoritative(target.country_code, source.country_code, "country_code"),
    country_codes: mergeStringArrays(target.country_codes, source.country_codes),
    categories: mergeStringArrays(target.categories, source.categories),
    languages: mergeStringArrays(target.languages, source.languages),
    rate_card: mergeRateCards(
      target.rate_card as Record<string, unknown>,
      source.rate_card as Record<string, unknown>
    ),
    notes: mergeAuthoritative(target.notes, source.notes, "notes"),
    influencer_url: mergeAuthoritative(
      target.influencer_url,
      source.influencer_url,
      "influencer_url"
    ),
  };
}

/**
 * Combine two influencer profiles by moving the source creator's platform accounts
 * (and linked operational records) onto the target creator, then removing the source.
 *
 * `supabase` must be a service-role client. Authenticated DML is revoked on
 * creator_enrichment_runs, IPL, DNA versions, and Enterprise Creator Intelligence
 * tables — the caller must authorize with discovery.write first.
 */
export async function mergeCreators(
  supabase: SupabaseClient<Database>,
  input: {
    targetInfluencerId: string;
    sourceInfluencerId: string;
    targetUnifiedId: string;
    actorId: string;
  }
): Promise<MergeCreatorsResult> {
  try {
    const targetInfluencerId = input.targetInfluencerId.trim();
    const sourceInfluencerId = input.sourceInfluencerId.trim();
    const targetUnifiedId = input.targetUnifiedId.trim();

    const eligibility = await getMergeCreatorsEligibility(supabase, {
      targetInfluencerId,
      sourceInfluencerId,
    });
    if (!eligibility.canMerge) {
      return {
        ok: false,
        message: eligibility.message,
        platformConflicts: eligibility.platformConflicts,
      };
    }

    const [
      { data: targetInfluencer, error: targetError },
      { data: sourceInfluencer, error: sourceError },
    ] = await Promise.all([
      supabase
        .from("influencers")
        .select(
          "id, display_name, email, phone, country_code, country_codes, categories, languages, rate_card, notes, influencer_url, primary_avatar_url, default_metrics_platform_account_id"
        )
        .eq("id", targetInfluencerId)
        .maybeSingle(),
      supabase
        .from("influencers")
        .select(
          "id, display_name, email, phone, country_code, country_codes, categories, languages, rate_card, notes, influencer_url, primary_avatar_url, default_metrics_platform_account_id"
        )
        .eq("id", sourceInfluencerId)
        .maybeSingle(),
    ]);

    if (targetError) return { ok: false, message: targetError.message };
    if (sourceError) return { ok: false, message: sourceError.message };
    if (!targetInfluencer || !sourceInfluencer) {
      return { ok: false, message: "One or both creators could not be found." };
    }

    const { data: sourcePlatforms, error: sourcePlatformsError } = await supabase
      .from("influencer_platform_accounts")
      .select("id, platform, is_primary")
      .eq("influencer_id", sourceInfluencerId);

    if (sourcePlatformsError) {
      return { ok: false, message: sourcePlatformsError.message };
    }

    const sourcePlatformRows = (sourcePlatforms ?? []) as PlatformAccountRow[];
    const targetHasPrimary = Boolean(
      (
        await supabase
          .from("influencer_platform_accounts")
          .select("id")
          .eq("influencer_id", targetInfluencerId)
          .eq("is_primary", true)
          .limit(1)
      ).data?.length
    );

    // Eligibility checks overlap before writes; replacement never deduplicates
    // operational records by deleting them.

    for (const account of sourcePlatformRows) {
      const { error: moveError } = await supabase
        .from("influencer_platform_accounts")
        .update({
          influencer_id: targetInfluencerId,
          is_primary: targetHasPrimary ? false : account.is_primary ?? false,
        })
        .eq("id", account.id)
        .eq("influencer_id", sourceInfluencerId);

      if (moveError) {
        return { ok: false, message: moveError.message };
      }
    }

    await reassignInfluencerReferences(supabase, targetInfluencerId, sourceInfluencerId);
    await moveCreatorDnaIfNeeded(supabase, targetInfluencerId, sourceInfluencerId);

    const mergedPatch = buildMergedInfluencerPatch(
      targetInfluencer as InfluencerMergeRow,
      sourceInfluencer as InfluencerMergeRow
    );

    const { error: targetUpdateError } = await supabase
      .from("influencers")
      .update(mergedPatch as Database["public"]["Tables"]["influencers"]["Update"])
      .eq("id", targetInfluencerId);

    if (targetUpdateError) {
      return { ok: false, message: targetUpdateError.message };
    }

    const { error: deleteError } = await supabase
      .from("influencers")
      .delete()
      .eq("id", sourceInfluencerId);

    if (deleteError) {
      return {
        ok: false,
        message:
          deleteError.message ||
          "Platforms were combined but the duplicate creator profile could not be removed.",
      };
    }

    try {
      await persistCreatorPrimaryIdentity(supabase, targetInfluencerId);
    } catch {
      // Identity refresh is best-effort after a successful merge.
    }

    const creator = await getUnifiedCreatorById(supabase, targetUnifiedId, { skipDna: true });
    if (!creator) {
      return {
        ok: false,
        message: "Creators combined but the updated profile could not be reloaded.",
      };
    }

    const movedLabels = eligibility.platformsToMove.map((p) => platformLabel(p)).join(", ");
    const sourceName = sourceInfluencer.display_name?.trim() || "Duplicate creator";

    return {
      ok: true,
      creator,
      platformsMoved: sourcePlatformRows.length,
      message: `Combined ${sourceName} — ${movedLabels} now linked to ${creator.display_name}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not combine creators. Please try again.",
    };
  }
}
