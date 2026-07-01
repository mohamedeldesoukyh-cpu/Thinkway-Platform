import type { SupabaseClient } from "@supabase/supabase-js";

import type { FieldSourceMap } from "@/lib/creator-enrichment/types";
import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import { resolveMetricsSourceForEnrichment } from "@/lib/social/enrichment/metrics-status";
import type { Database } from "@/types/database";

import { mergeAuthoritative, isImportFieldEmpty } from "./merge";
import {
  buildCreatorImportMetadata,
  buildImportFieldSources,
  mergeCreatorImportMetadataAuthoritative,
  normalizeParsedCreatorRow,
  resolveCountryCode,
  resolveImportDisplayName,
  resolveInfluencerImportCategories,
} from "./normalize";
import {
  resolveImportAvatarFields,
} from "./resolve-import-avatar";
import type {
  ImportProcessingLogEntry,
  ImportUpsertResult,
  ParsedCreatorRow,
} from "./types";

type UpsertContext = {
  supabase: SupabaseClient<Database>;
  importFileId: string;
  sourceName: string | null;
  uploadedBy: string | null;
  /** PDF imports may fetch og:image from profile URLs when no photo column exists. */
  enableOpenGraphAvatarFallback?: boolean;
  log: (level: ImportProcessingLogEntry["level"], message: string) => void;
};

type ExistingPlatformAccount = {
  id: string;
  influencer_id: string;
  follower_count: number | null;
  engagement_rate: number | null;
  audience_country: string | null;
  interest_categories: string[] | null;
  profile_url: string | null;
  normalized_profile_url: string | null;
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
      "id, influencer_id, follower_count, engagement_rate, audience_country, interest_categories, profile_url, normalized_profile_url, profile_picture_url, avatar_source, metadata, field_sources"
    )
    .eq("platform", platform)
    .eq("normalized_username", normalizedUsername)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ExistingPlatformAccount | null;
}

async function findInfluencerIdByNormalizedUsername(
  supabase: SupabaseClient<Database>,
  normalizedUsername: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id")
    .eq("normalized_username", normalizedUsername)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.influencer_id ?? null;
}

async function findInfluencerProfile(
  supabase: SupabaseClient<Database>,
  influencerId: string
) {
  const { data, error } = await supabase
    .from("influencers")
    .select("display_name, categories, country_code, metadata")
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
    skipped: 0,
    duplicate: 0,
    failed: 0,
    platform_accounts_created: 0,
    platform_accounts_updated: 0,
    followers_updated: 0,
    categories_updated: 0,
    audience_interests_updated: 0,
    avatars_imported: 0,
    missing_avatars: 0,
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

    try {
      const existing = await findExistingAccount(
        ctx.supabase,
        normalized.platform,
        normalized.normalized_username
      );

      const rowHasAvatarUrl = !isImportFieldEmpty(row.profile_picture_url);
      const shouldResolveAvatar =
        rowHasAvatarUrl ||
        !existing ||
        (ctx.enableOpenGraphAvatarFallback &&
          isImportFieldEmpty(existing?.profile_picture_url));
      const importAvatarFields = shouldResolveAvatar
        ? await resolveImportAvatarFields({
            row,
            platform: normalized.platform,
            profileUrl: normalized.profile_url,
            enableOpenGraphFallback: ctx.enableOpenGraphAvatarFallback,
            log: ctx.log,
          })
        : null;

      if (importAvatarFields?.profile_picture_url) {
        counters.avatars_imported += 1;
        ctx.log(
          "info",
          `[import] avatar persisted @${row.username} source=${importAvatarFields.avatar_source}`
        );
      } else if (!rowHasAvatarUrl && !importAvatarFields?.profile_picture_url) {
        counters.missing_avatars += 1;
      }

      if (existing) {
        const filledFields = new Set<string>();
        const log = ctx.log;

        const mergedFollowerCount = mergeAuthoritative(
          existing.follower_count,
          row.followers,
          "follower_count",
          log
        );
        if (mergedFollowerCount !== existing.follower_count) {
          filledFields.add("follower_count");
        }

        const mergedEngagementRate = mergeAuthoritative(
          existing.engagement_rate,
          row.engagement_rate,
          "engagement_rate",
          log
        );
        if (mergedEngagementRate !== existing.engagement_rate) {
          filledFields.add("engagement_rate");
        }

        const countryCode = resolveCountryCode(row.country);
        const mergedAudienceCountry = mergeAuthoritative(
          existing.audience_country,
          countryCode,
          "audience_country",
          log
        );
        if (mergedAudienceCountry !== existing.audience_country) {
          filledFields.add("audience_country");
        }

        const incomingInterestCategories = row.categories;
        const mergedInterestCategories = mergeAuthoritative(
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
        const mergedMetadata = mergeCreatorImportMetadataAuthoritative(existingMeta, row, log);

        let avatarPatch: Record<string, unknown> = {};
        if (
          importAvatarFields?.profile_picture_url &&
          (rowHasAvatarUrl || isImportFieldEmpty(existing.profile_picture_url))
        ) {
          avatarPatch = importAvatarFields;
          filledFields.add("profile_picture_url");
        }

        const mergedProfileUrl = mergeAuthoritative(
          existing.profile_url,
          normalized.profile_url,
          "profile_url",
          log
        );
        if (mergedProfileUrl !== existing.profile_url) {
          filledFields.add("profile_url");
        }

        const mergedNormalizedProfileUrl = mergeAuthoritative(
          existing.normalized_profile_url,
          normalized.normalized_profile_url,
          "normalized_profile_url",
          log
        );
        if (mergedNormalizedProfileUrl !== existing.normalized_profile_url) {
          filledFields.add("normalized_profile_url");
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
        const incomingInfluencerCategories = row.categories;
        const mergedInfluencerCategories = mergeAuthoritative(
          existingInfluencer?.categories ?? [],
          incomingInfluencerCategories.length > 0 ? incomingInfluencerCategories : [],
          "influencer.categories",
          log
        );

        const accountUpdate: Record<string, unknown> = {
          follower_count: mergedFollowerCount,
          engagement_rate: mergedEngagementRate,
          audience_country: mergedAudienceCountry,
          profile_url: mergedProfileUrl,
          normalized_profile_url: mergedNormalizedProfileUrl,
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
        const mergedDisplayName = mergeAuthoritative(
          existingInfluencer?.display_name ?? null,
          row.display_name?.trim() || null,
          "influencer.display_name",
          log
        );
        if (mergedDisplayName !== existingInfluencer?.display_name) {
          influencerPatch.display_name = mergedDisplayName;
        }

        const mergedCountryCode = mergeAuthoritative(
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
          const mergedRole = mergeAuthoritative(
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
        if (avatarPatch.profile_picture_url) {
          await persistCreatorPrimaryIdentity(ctx.supabase, existing.influencer_id);
        }

        const hadAccountChanges = filledFields.size > 0;
        const hadInfluencerChanges = Object.keys(influencerPatch).length > 0;
        if (!hadAccountChanges && !hadInfluencerChanges) {
          counters.skipped += 1;
        } else {
          counters.updated += 1;
          counters.platform_accounts_updated += 1;
          if (filledFields.has("follower_count")) counters.followers_updated += 1;
          if (
            filledFields.has("interest_categories") ||
            mergedInfluencerCategories !== (existingInfluencer?.categories ?? [])
          ) {
            counters.categories_updated += 1;
          }
          const prevInterests =
            (existingMeta.audience_interests as string[] | undefined) ?? [];
          const nextInterests =
            (mergedMetadata.audience_interests as string[] | undefined) ?? [];
          if (JSON.stringify(prevInterests) !== JSON.stringify(nextInterests)) {
            counters.audience_interests_updated += 1;
          }
        }

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
      const importDisplayName = resolveImportDisplayName(row);
      const linkedInfluencerId = await findInfluencerIdByNormalizedUsername(
        ctx.supabase,
        normalized.normalized_username
      );

      let influencerId = linkedInfluencerId;
      let createdInfluencer = false;

      if (!influencerId) {
        const { data: influencer, error: influencerError } = await ctx.supabase
          .from("influencers")
          .insert({
            display_name: importDisplayName,
            country_code: countryCode,
            categories: influencerCategories,
            status: "active",
            notes: row.source
              ? `Imported from ${row.source}`
              : "Imported via Discovery Import Center",
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

        influencerId = influencer.id;
        createdInfluencer = true;
      } else {
        const existingInfluencer = await findInfluencerProfile(ctx.supabase, influencerId);
        const influencerPatch: Record<string, unknown> = {};
        const mergedDisplayName = mergeAuthoritative(
          existingInfluencer?.display_name ?? null,
          row.display_name?.trim() || null,
          "influencer.display_name",
          ctx.log
        );
        if (mergedDisplayName !== existingInfluencer?.display_name) {
          influencerPatch.display_name = mergedDisplayName;
        }

        const mergedCountryCode = mergeAuthoritative(
          existingInfluencer?.country_code ?? null,
          countryCode,
          "influencer.country_code",
          ctx.log
        );
        if (mergedCountryCode !== existingInfluencer?.country_code) {
          influencerPatch.country_code = mergedCountryCode;
        }

        const mergedInfluencerCategories = mergeAuthoritative(
          existingInfluencer?.categories ?? [],
          influencerCategories.length > 0 ? influencerCategories : [],
          "influencer.categories",
          ctx.log
        );
        if (
          mergedInfluencerCategories.length > 0 ||
          (existingInfluencer?.categories?.length ?? 0) > 0
        ) {
          influencerPatch.categories = mergedInfluencerCategories;
        }

        if (Object.keys(influencerPatch).length > 0) {
          const { error: influencerError } = await ctx.supabase
            .from("influencers")
            .update(
              influencerPatch as Database["public"]["Tables"]["influencers"]["Update"]
            )
            .eq("id", influencerId);
          if (influencerError) throw new Error(influencerError.message);
        }
      }

      const importMeta = buildCreatorImportMetadata(row);
      const importFieldSources = buildImportFieldSources(row, {
        hasAvatar: Boolean(importAvatarFields),
      });
      const { data: account, error: accountError } = await ctx.supabase
        .from("influencer_platform_accounts")
        .insert({
          influencer_id: influencerId,
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
            row.categories.length > 0 ? row.categories : null,
          is_primary: createdInfluencer,
          sync_status: normalized.sync_status,
          sync_source: normalized.sync_source,
          metrics_source: normalized.metrics_source,
          metrics_is_manual_override: normalized.metrics_is_manual_override,
          field_sources: importFieldSources,
          metadata: importMeta,
          ...(importAvatarFields ?? {}),
        })
        .select("id")
        .single();

      if (accountError) {
        if (accountError.code === "23505") {
          if (createdInfluencer) {
            await ctx.supabase.from("influencers").delete().eq("id", influencerId);
          }
          counters.duplicate += 1;
          continue;
        }
        throw new Error(accountError.message);
      }

      await upsertCreatorSource(ctx.supabase, {
        influencerId,
        sourceName: row.source ?? ctx.sourceName ?? "import",
        sourceFileId: ctx.importFileId,
        importedAt: importMeta.imported_at as string,
      });

      await refreshInfluencerSearchVector(ctx.supabase, influencerId);
      if (importAvatarFields?.profile_picture_url) {
        await persistCreatorPrimaryIdentity(ctx.supabase, influencerId);
      }

      if (createdInfluencer) {
        counters.imported += 1;
        counters.platform_accounts_created += 1;
      } else {
        counters.updated += 1;
        counters.platform_accounts_created += 1;
      }
      if (row.followers != null) counters.followers_updated += 1;
      if (row.categories.length > 0) counters.categories_updated += 1;
      if (row.audience_interests.length > 0) counters.audience_interests_updated += 1;

      await insertAuditLog(ctx.supabase, {
        action: createdInfluencer ? "create" : "update",
        entity_type: "influencer",
        entity_id: influencerId,
        actor_id: ctx.uploadedBy,
        metadata: {
          import_file_id: ctx.importFileId,
          platform: normalized.platform,
          username: normalized.username,
          operation: createdInfluencer
            ? "discovery_import_create"
            : "discovery_import_add_platform",
        },
        new_data: {
          display_name: importDisplayName,
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
