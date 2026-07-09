/**
 * CreatorDNAWriter — persists IPL snapshot evidence into creator_dna / staging.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { NormalizedProfileSnapshot } from "@/lib/intelligence-persistence/types";
import type { RawProviderPayload } from "@/lib/intelligence-persistence/types";

import { CreatorDNAService } from "../services/creator-dna-service";
import { resolveApifyRunIdFromSnapshot } from "../services/apify-to-dna-mapper";
import {
  mapReprocessCategoriesToCandidates,
  mapSnapshotToFieldCandidates,
} from "./ipl-snapshot-mapper";

type AnySupabase = SupabaseClient;

export type WriteFromSnapshotInput = {
  snapshotId: string;
  influencerId?: string | null;
  discoveredProfileId?: string | null;
  platformAccountId?: string | null;
  normalized: NormalizedProfileSnapshot;
  snapshotVersion: number;
  fetchedAt?: string;
  enrichmentRunId?: string | null;
  rawSnapshot?: RawProviderPayload | null;
  avatarUrlOverride?: string | null;
};

export class CreatorDNAWriter {
  private readonly service: CreatorDNAService;

  constructor(private readonly supabase: AnySupabase) {
    this.service = new CreatorDNAService(supabase);
  }

  async writeFromSnapshot(input: WriteFromSnapshotInput): Promise<{
    ok: boolean;
    target: "creator_dna" | "creator_dna_staging" | "skipped";
    influencerId?: string;
    changedFields?: string[];
    message: string;
  }> {
    const fetchedAt = input.fetchedAt ?? input.normalized.fetchedAt ?? new Date().toISOString();
    const fields = mapSnapshotToFieldCandidates({
      snapshotId: input.snapshotId,
      normalized: input.normalized,
      snapshotVersion: input.snapshotVersion,
      fetchedAt,
      platformAccountId: input.platformAccountId,
      rawSnapshot: input.rawSnapshot,
      avatarUrlOverride: input.avatarUrlOverride,
    });

    const apifyRunId = resolveApifyRunIdFromSnapshot({
      normalized: input.normalized,
      rawSnapshot: input.rawSnapshot,
    });
    const persistMeta = {
      rawApifySnapshot: input.rawSnapshot ?? null,
      apifyRunId,
      enrichedAt: fetchedAt,
    };

    if (input.influencerId) {
      const result = await this.service.mergeEvidence(input.influencerId, {
        snapshotId: input.snapshotId,
        fields,
        enrichmentRunId: input.enrichmentRunId ?? null,
        platformAccountId: input.platformAccountId ?? null,
        intelligenceSource: "apify_enrichment",
        lifecycleContext: {
          hasEnrichmentSnapshot: true,
        },
        ...persistMeta,
      });
      return {
        ok: result.ok,
        target: "creator_dna",
        influencerId: input.influencerId,
        changedFields: result.changedFields,
        message: result.message,
      };
    }

    if (input.discoveredProfileId) {
      const result = await this.service.mergeStagingEvidence(input.discoveredProfileId, {
        snapshotId: input.snapshotId,
        fields,
        platformAccountId: input.platformAccountId ?? null,
        ...persistMeta,
      });
      return {
        ok: result.ok,
        target: "creator_dna_staging",
        changedFields: result.changedFields,
        message: result.message,
      };
    }

    return {
      ok: false,
      target: "skipped",
      message: "Snapshot has no influencer_id or discovered_profile_id — DNA write skipped.",
    };
  }

  async writeReprocessCategories(input: {
    snapshotId: string;
    influencerId: string;
    categories: string[];
    snapshotVersion: number;
    fetchedAt: string;
  }): Promise<{ ok: boolean; changedFields: string[] }> {
    const fields = mapReprocessCategoriesToCandidates(input);
    const result = await this.service.mergeEvidence(input.influencerId, {
      snapshotId: input.snapshotId,
      fields,
      changeReason: "reprocess_merge",
      eventType: "reprocess_merge",
      intelligenceSource: "apify_enrichment",
    });
    return { ok: result.ok, changedFields: result.changedFields };
  }
}

export async function writeCreatorDnaFromSnapshot(
  supabase: AnySupabase,
  input: WriteFromSnapshotInput
): Promise<{ ok: boolean; target: string; message: string }> {
  const writer = new CreatorDNAWriter(supabase);
  const result = await writer.writeFromSnapshot(input);
  if (result.ok) {
    console.log("[creator-dna] snapshot merged", {
      snapshotId: input.snapshotId,
      target: result.target,
      influencerId: result.influencerId,
      changedFields: result.changedFields?.length ?? 0,
    });
  } else {
    console.error("[creator-dna] snapshot merge failed", {
      snapshotId: input.snapshotId,
      target: result.target,
      influencerId: input.influencerId ?? input.discoveredProfileId ?? null,
      message: result.message,
    });
  }
  return { ok: result.ok, target: result.target, message: result.message };
}
