import type { SupabaseClient } from "@supabase/supabase-js";

import type { FieldSourceMap } from "@/lib/creator-enrichment/types";
import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import { resolveMetricsSourceForEnrichment } from "@/lib/social/enrichment/metrics-status";
import type { Database } from "@/types/database";

import { mergeMissingOnly, isImportFieldEmpty } from "./merge";
import {
  buildCreatorImportMetadata,
  buildImportFieldSources,
  importProfilePictureAccountFields,
  mergeCreatorImportMetadataMissingOnly,
  normalizeParsedCreatorRow,
  resolveCountryCode,
  resolveInfluencerImportCategories,
} from "./normalize";
import type {
  ImportEnrichmentAccountRef,
  ImportProcessingLogEntry,
  ImportUpsertResult,
  ParsedCreatorRow,
} from "./types";

type UpsertContext = {
  supabase: SupabaseClient<Database>;
  importFileId: string;
  sourceName: string | null;
  uploadedBy: string | null;
  log: (level: ImportProcessingLogEntry["level"], message: string) => void;
};

type ExistingPlatformAccount = {
  id: string;
  influencer_id: string;
  follower_count: number | null;
  engagement_rate: number | null;
  audience_country: string | null;
  interest_categories: string[] | null;
  profile_picture_url: string | null;
  avatar_source: string | null;
  metadata: Record<string, unknown> | null;
  field_sources: FieldSourceMap | null;
};

async function findExistingAccount(
  supabase: SupabaseClient<Database>,
  platform: string,
  normalizedUsername: string
): Promise<ExistingPlatformAccount | null> {
  const { data, error } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, follower_count, engagement_rate, audience_country, interest_categories, profile_picture_url, avatar_source, metadata, field_sources"
    )
    .eq("platform", platform)
    .eq("normalized_username", normalizedUsername)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ExistingPlatformAccount | null;
}

async function findInfluencerProfile(
  supabase: SupabaseClient<Database>,
  influencerId: string
) {
  const { data, error } = await supabase
    .from("influencers")
    .select("categories, country_code, metadata")
    .eq("id", influencerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

function importFieldSourcesForFilledFields(
  row: ParsedCreatorRow,
  filledFields: Set<string>,
  hasAvatar: boolean
): FieldSourceMap {
  const all = buildImportFieldSources(row, { hasAvatar });
  const filtered: FieldSourceMap = {};
  for (const [field, source] of Object.entries(all)) {
    if (filledFields.has(field)) {
      filtered[field] = source;
    }
  }
  return filtered;
}

function trackAvatarEnrichmentIfNeeded(
  counters: ImportUpsertResult,
  ref: ImportEnrichmentAccountRef,
  profilePictureUrl: string | null | undefined
) {
  if (isUsableAvatarUrl(profilePictureUrl)) return;
  counters.avatarEnrichmentAccountIds.push(ref);
}

async function upsertCreatorSource(
  supabase: SupabaseClient<Database>,
  input: {
    influencerId: string;
    sourceName: string;
    sourceFileId: string;
    importedAt: string;
  }
) {
  const { data: existing, error: lookupError } = await supabase
    .from("creator_sources")
    .select("id")
    .eq("influencer_id", input.influencerId)
    .eq("source_file_id", input.sourceFileId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  if (existing) {
    const { error } = await supabase
      .from("creator_sources")
      .update({
        source_name: input.sourceName,
        imported_at: input.importedAt,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("creator_sources").insert({
    influencer_id: input.influencerId,
    source_name: input.sourceName,
    source_file_id: input.sourceFileId,
    imported_at: input.importedAt,
  });
  if (error) throw new Error(error.message);
}

/** Rebuild influencers.search_vector after import upsert (platform account triggers may lag). */
async function refreshInfluencerSearchVector(
  supabase: SupabaseClient<Database>,
  influencerId: string
) {
  const { data: row, error: loadError } = await supabase
    .from("influencers")
    .select("display_name")
    .eq("id", influencerId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  const displayName = row?.display_name?.trim();
  if (!displayName) return;

  const { error } = await supabase
    .from("influencers")
    .update({ display_name: displayName })
    .eq("id", influencerId);

  if (error) throw new Error(error.message);
}

export async function upsertImportedCreators(
  rows: ParsedCreatorRow[],
  ctx: UpsertContext
): Promise<ImportUpsertResult> {
  const counters: ImportUpsertResult = {
    total: rows.length,
    imported: 0,
    updated: 0,
    duplicate: 0,
    failed: 0,
    enrichmentAccountIds: [],
    avatarEnrichmentAccountIds: [],
  };

  for (const rawRow of rows) {
    const row = normalizeParsedCreatorRow(rawRow, ctx.sourceName);
    const normalized = buildNormalizedPlatformAccount({
      platform: row.platform,
      username: row.username,
      follower_count: row.followers,
      engagement_rate: row.engagement_rate,
      sync_status: "manual",
      sync_source: "discovery_import",
      metrics_source: resolveMetricsSourceForEnrichment({
        platform: row.platform,
        follower_count: row.followers,
        engagement_rate: row.engagement_rate,
        avg_views: null,
        sync_status: "manual",
      }),
      metrics_is_manual_override: row.followers != null,
    });

    const importAvatarFields = importProfilePictureAccountFields(
      row.profile_picture_url,
      normalized.platform
    );

    if (importAvatarFields) {
      ctx.log(
        "info",
        `[import] creator avatar detected @${row.username} (${row.platform})`
      );
    }

    try {
      const existing = await findExistingAccount(
        ctx.supabase,
        normalized.platform,
        normalized.normalized_username
      );

      if (existing) {
        const filledFields = new Set<string>();
        const log = ctx.log;

        const mergedFollowerCount = mergeMissingOnly(
          existing.follower_count,
          row.followers,
          "follower_count",
          log
        );
        if (mergedFollowerCount !== existing.follower_count) {
          filledFields.add("follower_count");
        }

        const mergedEngagementRate = mergeMissingOnly(
          existing.engagement_rate,
          row.engagement_rate,
          "engagement_rate",
          log
        );
        if (mergedEngagementRate !== existing.engagement_rate) {
          filledFields.add("engagement_rate");
        }

        const countryCode = resolveCountryCode(row.country);
        const mergedAudienceCountry = mergeMissingOnly(
          existing.audience_country,
          countryCode,
          "audience_country",
          log
        );
        if (mergedAudienceCountry !== existing.audience_country) {
          filledFields.add("audience_country");
        }

        const incomingInterestCategories = resolveInfluencerImportCategories([], row);
        const mergedInterestCategories = mergeMissingOnly(
          existing.interest_categories ?? [],
          incomingInterestCategories.length > 0 ? incomingInterestCategories : [],
          "interest_categories",
          log
        );
        if (
          JSON.stringify(mergedInterestCategories) !==
          JSON.stringify(existing.interest_categories ?? [])
        ) {
          filledFields.add("interest_categories");
        }

        const existingMeta =
          (existing.metadata as Record<string, unknown> | null) ?? {};
        const mergedMetadata = mergeCreatorImportMetadataMissingOnly(existingMeta, row, log);

        let avatarPatch: Record<string, unknown> = {};
        if (importAvatarFields) {
          if (
            isImportFieldEmpty(existing.profile_picture_url) ||
            !isUsableAvatarUrl(existing.profile_picture_url)
          ) {
            avatarPatch = importAvatarFields;
            filledFields.add("profile_picture_url");
          } else {
            log(
              "info",
              `[import] field skipped (existing value present): profile_picture_url`
            );
          }
        }

        const importFieldSources = importFieldSourcesForFilledFields(
          row,
          filledFields,
          Boolean(avatarPatch.profile_picture_url)
        );
        const mergedFieldSources: FieldSourceMap = {
          ...(existing.field_sources ?? {}),
          ...importFieldSources,
        };

        const existingInfluencer = await findInfluencerProfile(
          ctx.supabase,
          existing.influencer_id
        );
        const incomingInfluencerCategories = resolveInfluencerImportCategories([], row);
        const mergedInfluencerCategories = mergeMissingOnly(
          existingInfluencer?.categories ?? [],
          incomingInfluencerCategories.length > 0 ? incomingInfluencerCategories : [],
          "influencer.categories",
          log
        );

        const accountUpdate: Record<string, unknown> = {
          follower_count: mergedFollowerCount,
          engagement_rate: mergedEngagementRate,
          audience_country: mergedAudienceCountry,
          metadata: mergedMetadata,
          field_sources: mergedFieldSources,
          sync_source: "discovery_import",
          ...avatarPatch,
        };

        if (mergedInterestCategories.length > 0 || !isImportFieldEmpty(existing.interest_categories)) {
          accountUpdate.interest_categories = mergedInterestCategories;
        }

        if (filledFields.has("follower_count")) {
          accountUpdate.metrics_source = normalized.metrics_source;
          accountUpdate.metrics_is_manual_override = normalized.metrics_is_manual_override;
        }

        const { error: accountError } = await ctx.supabase
          .from("influencer_platform_accounts")
          .update(
            accountUpdate as Database["public"]["Tables"]["influencer_platform_accounts"]["Update"]
          )
          .eq("id", existing.id);

        if (accountError) throw new Error(accountError.message);

        const influencerPatch: Record<string, unknown> = {};
        const mergedCountryCode = mergeMissingOnly(
          existingInfluencer?.country_code ?? null,
          countryCode,
          "influencer.country_code",
          log
        );
        if (mergedCountryCode !== existingInfluencer?.country_code) {
          influencerPatch.country_code = mergedCountryCode;
        }

        if (
          mergedInfluencerCategories.length > 0 ||
          (existingInfluencer?.categories?.length ?? 0) > 0
        ) {
          influencerPatch.categories = mergedInfluencerCategories;
        }

        if (row.role?.trim()) {
          const existingInfluencerMeta =
            (existingInfluencer?.metadata as Record<string, unknown> | null) ?? {};
          const mergedRole = mergeMissingOnly(
            (existingInfluencerMeta.role as string | null | undefined) ?? null,
            row.role.trim(),
            "influencer.role",
            log
          );
          if (mergedRole !== existingInfluencerMeta.role) {
            influencerPatch.metadata = {
              ...existingInfluencerMeta,
              role: mergedRole,
            };
          }
        }

        if (Object.keys(influencerPatch).length > 0) {
          const { error: influencerError } = await ctx.supabase
            .from("influencers")
            .update(
              influencerPatch as Database["public"]["Tables"]["influencers"]["Update"]
            )
            .eq("id", existing.influencer_id);
          if (influencerError) throw new Error(influencerError.message);
        }

        const importMeta = buildCreatorImportMetadata(row);
        await upsertCreatorSource(ctx.supabase, {
          influencerId: existing.influencer_id,
          sourceName: row.source ?? ctx.sourceName ?? "import",
          sourceFileId: ctx.importFileId,
          importedAt: importMeta.imported_at as string,
        });

        await refreshInfluencerSearchVector(ctx.supabase, existing.influencer_id);

        counters.updated += 1;
        const enrichmentRef: ImportEnrichmentAccountRef = {
          influencerId: existing.influencer_id,
          platformAccountId: existing.id,
          platform: normalized.platform,
          username: normalized.username,
        };
        counters.enrichmentAccountIds.push(enrichmentRef);

        const resolvedAvatarUrl =
          (avatarPatch.profile_picture_url as string | undefined) ??
          existing.profile_picture_url;
        trackAvatarEnrichmentIfNeeded(counters, enrichmentRef, resolvedAvatarUrl);

        await insertAuditLog(ctx.supabase, {
          action: "update",
          entity_type: "influencer",
          entity_id: existing.influencer_id,
          actor_id: ctx.uploadedBy,
          metadata: {
            import_file_id: ctx.importFileId,
            platform: normalized.platform,
            username: normalized.username,
            operation: "discovery_import_update",
          },
          new_data: {
            follower_count: mergedFollowerCount,
            engagement_rate: mergedEngagementRate,
            country: row.country,
          },
        });
        continue;
      }

      const countryCode = resolveCountryCode(row.country);
      const influencerCategories = resolveInfluencerImportCategories(undefined, row);
      const { data: influencer, error: influencerError } = await ctx.supabase
        .from("influencers")
        .insert({
          display_name: normalized.username,
          country_code: countryCode,
          categories: influencerCategories,
          status: "active",
          notes: row.source ? `Imported from ${row.source}` : "Imported via Discovery Import Center",
          ...(row.role?.trim() ? { metadata: { role: row.role.trim() } } : {}),
          created_by: ctx.uploadedBy,
        } as Database["public"]["Tables"]["influencers"]["Insert"])
        .select("id")
        .single();

      if (influencerError) {
        if (influencerError.code === "23505") {
          counters.duplicate += 1;
          continue;
        }
        throw new Error(influencerError.message);
      }

      const importMeta = buildCreatorImportMetadata(row);
      const importFieldSources = buildImportFieldSources(row, {
        hasAvatar: Boolean(importAvatarFields),
      });
      const { data: account, error: accountError } = await ctx.supabase
        .from("influencer_platform_accounts")
        .insert({
          influencer_id: influencer.id,
          platform: normalized.platform,
          handle: normalized.handle,
          username: normalized.username,
          normalized_username: normalized.normalized_username,
          profile_url: normalized.profile_url,
          normalized_profile_url: normalized.normalized_profile_url,
          follower_count: row.followers ?? 0,
          engagement_rate: row.engagement_rate,
          audience_country: countryCode,
          interest_categories:
            influencerCategories.length > 0 ? influencerCategories : null,
          is_primary: true,
          sync_status: normalized.sync_status,
          sync_source: normalized.sync_source,
          metrics_source: normalized.metrics_source,
          metrics_is_manual_override: normalized.metrics_is_manual_override,
          field_sources: importFieldSources,
          metadata: {
            ...importMeta,
            categories: influencerCategories,
          },
          ...(importAvatarFields ?? {}),
        })
        .select("id")
        .single();

      if (accountError) {
        if (accountError.code === "23505") {
          await ctx.supabase.from("influencers").delete().eq("id", influencer.id);
          counters.duplicate += 1;
          continue;
        }
        throw new Error(accountError.message);
      }

      await upsertCreatorSource(ctx.supabase, {
        influencerId: influencer.id,
        sourceName: row.source ?? ctx.sourceName ?? "import",
        sourceFileId: ctx.importFileId,
        importedAt: importMeta.imported_at as string,
      });

      await refreshInfluencerSearchVector(ctx.supabase, influencer.id);

      counters.imported += 1;
      const enrichmentRef: ImportEnrichmentAccountRef = {
        influencerId: influencer.id,
        platformAccountId: account.id,
        platform: normalized.platform,
        username: normalized.username,
      };
      counters.enrichmentAccountIds.push(enrichmentRef);

      trackAvatarEnrichmentIfNeeded(
        counters,
        enrichmentRef,
        importAvatarFields?.profile_picture_url ?? null
      );

      await insertAuditLog(ctx.supabase, {
        action: "create",
        entity_type: "influencer",
        entity_id: influencer.id,
        actor_id: ctx.uploadedBy,
        metadata: {
          import_file_id: ctx.importFileId,
          platform: normalized.platform,
          username: normalized.username,
          operation: "discovery_import_create",
        },
        new_data: {
          display_name: normalized.username,
          follower_count: row.followers,
          engagement_rate: row.engagement_rate,
          country: row.country,
        },
      });
    } catch (error) {
      counters.failed += 1;
      const message = error instanceof Error ? error.message : "Upsert failed";
      ctx.log("error", `Failed @${row.username} (${row.platform}): ${message}`);
    }
  }

  return counters;
}
