import type { SupabaseClient } from "@supabase/supabase-js";

import type { FieldSourceMap } from "@/lib/creator-enrichment/types";
import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import { buildNormalizedPlatformAccount } from "@/lib/social/normalize-account";
import { resolveMetricsSourceForEnrichment } from "@/lib/social/enrichment/metrics-status";
import type { Database } from "@/types/database";

import {
  buildCreatorImportMetadata,
  buildImportFieldSources,
  importProfilePictureAccountFields,
  mergeCreatorImportMetadata,
  normalizeParsedCreatorRow,
  resolveCountryCode,
  resolveInfluencerImportCategories,
} from "./normalize";
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
  log: (level: ImportProcessingLogEntry["level"], message: string) => void;
};

async function findExistingAccount(
  supabase: SupabaseClient<Database>,
  platform: string,
  normalizedUsername: string
) {
  const { data, error } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, follower_count, engagement_rate, metadata, field_sources, interest_categories"
    )
    .eq("platform", platform)
    .eq("normalized_username", normalizedUsername)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
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
    const importFieldSources = buildImportFieldSources(row, {
      hasAvatar: Boolean(importAvatarFields),
    });

    try {
      const existing = await findExistingAccount(
        ctx.supabase,
        normalized.platform,
        normalized.normalized_username
      );

      if (existing) {
        const importMeta = buildCreatorImportMetadata(row);
        const existingMeta =
          (existing.metadata as Record<string, unknown> | null) ?? {};
        const mergedMetadata = mergeCreatorImportMetadata(existingMeta, row);
        const mergedFieldSources: FieldSourceMap = {
          ...(existing.field_sources as FieldSourceMap | null),
          ...importFieldSources,
        };
        const existingInfluencer = await findInfluencerProfile(
          ctx.supabase,
          existing.influencer_id
        );
        const mergedInfluencerCategories = resolveInfluencerImportCategories(
          existingInfluencer?.categories,
          row
        );
        const interestCategories =
          mergedInfluencerCategories.length > 0 ? mergedInfluencerCategories : undefined;

        const { error: accountError } = await ctx.supabase
          .from("influencer_platform_accounts")
          .update({
            follower_count: row.followers ?? existing.follower_count,
            engagement_rate: row.engagement_rate ?? existing.engagement_rate,
            audience_country: resolveCountryCode(row.country),
            metadata: mergedMetadata,
            field_sources: mergedFieldSources,
            ...(interestCategories ? { interest_categories: interestCategories } : {}),
            sync_source: "discovery_import",
            metrics_source: normalized.metrics_source,
            metrics_is_manual_override: normalized.metrics_is_manual_override,
            ...(importAvatarFields ?? {}),
          })
          .eq("id", existing.id);

        if (accountError) throw new Error(accountError.message);

        const countryCode = resolveCountryCode(row.country);
        const influencerPatch: Record<string, unknown> = {};
        if (countryCode) influencerPatch.country_code = countryCode;
        if (
          mergedInfluencerCategories.length > 0 ||
          row.categories.length > 0 ||
          row.audience_interests.length > 0 ||
          (existingInfluencer?.categories?.length ?? 0) > 0
        ) {
          influencerPatch.categories = mergedInfluencerCategories;
        }
        if (row.role?.trim()) {
          const existingInfluencerMeta =
            (existingInfluencer?.metadata as Record<string, unknown> | null) ?? {};
          influencerPatch.metadata = {
            ...existingInfluencerMeta,
            role: row.role.trim(),
          };
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

        await upsertCreatorSource(ctx.supabase, {
          influencerId: existing.influencer_id,
          sourceName: row.source ?? ctx.sourceName ?? "import",
          sourceFileId: ctx.importFileId,
          importedAt: importMeta.imported_at as string,
        });

        counters.updated += 1;
        counters.enrichmentAccountIds.push({
          influencerId: existing.influencer_id,
          platformAccountId: existing.id,
          platform: normalized.platform,
          username: normalized.username,
        });

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
            follower_count: row.followers,
            engagement_rate: row.engagement_rate,
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

      counters.imported += 1;
      counters.enrichmentAccountIds.push({
        influencerId: influencer.id,
        platformAccountId: account.id,
        platform: normalized.platform,
        username: normalized.username,
      });

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
