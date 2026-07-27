/**
 * CreatorDNAService — canonical read/write API for creator intelligence.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateConfidence,
  calculateFieldCompleteness,
} from "./confidence-calculator";
import { calculateDnaCompleteness } from "./dna-completeness-engine";
import { intelligenceSourceFromEventType } from "./dna-lifecycle";
import { applyMergeMetadata } from "./merge-metadata";
import { mergeCandidatesIntoDocument, mergeFieldCandidate } from "./dna-merge-engine";
import { createEmptyCreatorDNADocument, parseCreatorDNADocument } from "./document-factory";
import type { FieldEnvelope } from "../types";
import {
  createEmptyEnvelope,
  envelopeHasValue,
  getNestedEnvelope,
  wrapValue,
} from "./field-envelope";
import { APIFY_DNA_FIELD_PATHS } from "./apify-to-dna-mapper";
import { DNA_STAGING_PROMOTE_FIELD_PATHS } from "./staging-promote-paths";
import type {
  CreatorDNADocument,
  CreatorDNARecord,
  CreatorDNAStagingRecord,
  CreatorDnaLifecycle,
  DnaFieldCandidate,
  DnaIntelligenceSource,
  DnaSource,
  FieldHistoryEntry,
  LineageEventType,
  MergeEvidenceInput,
} from "../types";
import type { RawProviderPayload } from "@/lib/intelligence-persistence/types";

type AnySupabase = SupabaseClient;

type MergeOptions = MergeEvidenceInput & {
  enrichmentRunId?: string | null;
  platformAccountId?: string | null;
  platformAccountIds?: string[];
  changeReason?: string;
  eventType?: LineageEventType;
  rawApifySnapshot?: RawProviderPayload | null;
  apifyRunId?: string | null;
  enrichedAt?: string | null;
  intelligenceSource?: DnaIntelligenceSource | null;
  ensureRow?: boolean;
  lifecycleContext?: {
    influencerStatus?: string;
    isImport?: boolean;
    hasCampaignHistory?: boolean;
    hasEnrichmentSnapshot?: boolean;
  };
};

type CreatorDnaRow = {
  influencer_id: string;
  document: CreatorDNADocument;
  version: number;
  last_snapshot_id: string | null;
  last_enrichment_run_id: string | null;
  platform_account_ids: string[];
  dna_lifecycle: string | null;
  last_intelligence_update: string | null;
  created_at: string;
  updated_at: string;
};

type CreatorDnaStagingRow = {
  id: string;
  discovered_profile_id: string;
  document: CreatorDNADocument;
  version: number;
  last_snapshot_id: string | null;
  platform_account_id: string | null;
  promoted_to_influencer_id: string | null;
  promoted_at: string | null;
  created_at: string;
  updated_at: string;
};

export class CreatorDNAService {
  private intelligenceRowColumnsAvailable: boolean | null = null;

  constructor(private readonly supabase: AnySupabase) {}

  async getCreatorDNA(influencerId: string): Promise<CreatorDNARecord | null> {
    const { data, error } = await this.supabase
      .from("creator_dna")
      .select("*")
      .eq("influencer_id", influencerId)
      .maybeSingle();

    if (error || !data) return null;
    return this.rowToRecord(data as CreatorDnaRow);
  }

  async getCreatorDNABatch(influencerIds: string[]): Promise<Map<string, CreatorDNARecord>> {
    const uniqueIds = [...new Set(influencerIds.filter(Boolean))];
    const map = new Map<string, CreatorDNARecord>();
    if (uniqueIds.length === 0) return map;

    const { data, error } = await this.supabase
      .from("creator_dna")
      .select("*")
      .in("influencer_id", uniqueIds);

    if (error || !data) return map;

    for (const row of data as CreatorDnaRow[]) {
      map.set(row.influencer_id, this.rowToRecord(row));
    }
    return map;
  }

  async getStagingDNA(discoveredProfileId: string): Promise<CreatorDNAStagingRecord | null> {
    const { data, error } = await this.supabase
      .from("creator_dna_staging")
      .select("*")
      .eq("discovered_profile_id", discoveredProfileId)
      .maybeSingle();

    if (error || !data) return null;
    return this.stagingRowToRecord(data as CreatorDnaStagingRow);
  }

  calculateConfidence(field: {
    source: DnaSource;
    value: unknown;
    isVerified?: boolean;
    snapshotVersion?: number | null;
  }): number {
    return calculateConfidence({
      source: field.source,
      hasValue: calculateFieldCompleteness(field.value) > 0,
      isVerified: field.isVerified,
      snapshotVersion: field.snapshotVersion,
      fieldCompleteness: calculateFieldCompleteness(field.value),
    });
  }

  resolveConflicts<T>(
    current: FieldEnvelope<T> | undefined,
    candidates: DnaFieldCandidate<T>[]
  ): FieldEnvelope<T> {
    if (candidates.length === 0) {
      return current ?? createEmptyEnvelope(null as T);
    }
    let envelope = current;
    for (const candidate of candidates) {
      envelope = mergeFieldCandidate(envelope, candidate);
    }
    return envelope ?? mergeFieldCandidate(undefined, candidates[candidates.length - 1]!);
  }

  async updateField(
    influencerId: string,
    path: string,
    envelope: FieldEnvelope<unknown>
  ): Promise<{ ok: boolean; version: number }> {
    const result = await this.mergeEvidence(influencerId, {
      snapshotId: null,
      fields: [
        {
          path,
          value: envelope.value,
          confidence: envelope.confidence,
          source: envelope.source,
          sourceVersion: envelope.sourceVersion ?? null,
          updatedAt: envelope.updatedAt,
        },
      ],
      changeReason: "manual_update",
      eventType: "manual_update",
      intelligenceSource: "manual_update",
      ensureRow: true,
    });

    if (!result.ok) {
      const existing = await this.getCreatorDNA(influencerId);
      return { ok: false, version: existing?.version ?? 0 };
    }

    const record = await this.getCreatorDNA(influencerId);
    return { ok: true, version: record?.version ?? 0 };
  }

  async mergeEvidence(
    influencerId: string,
    input: MergeOptions
  ): Promise<{ ok: boolean; changedFields: string[]; message: string }> {
    const existing = await this.getCreatorDNA(influencerId);
    const document = existing?.document ?? createEmptyCreatorDNADocument();
    const { changedFields } = mergeCandidatesIntoDocument(document, input.fields);

    const hasRowPersist =
      input.rawApifySnapshot != null ||
      input.apifyRunId != null ||
      input.enrichedAt != null;

    const intelligenceSource =
      input.intelligenceSource ??
      intelligenceSourceFromEventType(input.eventType, input.intelligenceSource);

    const shouldPersist =
      changedFields.length > 0 ||
      hasRowPersist ||
      input.ensureRow === true ||
      intelligenceSource != null;

    if (!shouldPersist) {
      return { ok: true, changedFields: [], message: "No field changes after conflict resolution." };
    }

    const completeness = calculateDnaCompleteness(document);
    const platformAccountIds = new Set(existing?.platformAccountIds ?? document.meta.platformAccountIds);
    if (input.platformAccountId) {
      platformAccountIds.add(input.platformAccountId);
    }
    for (const accountId of input.platformAccountIds ?? []) {
      platformAccountIds.add(accountId);
    }

    const mergedAt = input.enrichedAt ?? new Date().toISOString();
    const apifyRunId = input.apifyRunId ?? document.meta.apifyRunId ?? null;
    const intelligenceFieldsChanged = changedFields.length > 0;

    const metadataResult = applyMergeMetadata({
      document,
      mergedAt,
      intelligenceSource,
      intelligenceFieldsChanged,
      lifecycleContext: {
        influencerStatus: input.lifecycleContext?.influencerStatus ?? "active",
        isImport: input.lifecycleContext?.isImport ?? false,
        hasCampaignHistory: input.lifecycleContext?.hasCampaignHistory ?? false,
        hasEnrichmentSnapshot:
          input.lifecycleContext?.hasEnrichmentSnapshot ??
          Boolean(input.rawApifySnapshot ?? input.apifyRunId),
      },
    });

    const nextDocument = metadataResult.document;
    nextDocument.meta = {
      ...nextDocument.meta,
      platformAccountIds: [...platformAccountIds],
      lastSnapshotId: input.snapshotId ?? nextDocument.meta.lastSnapshotId,
      lastEnrichmentRunId: input.enrichmentRunId ?? nextDocument.meta.lastEnrichmentRunId,
      apifyRunId,
      provider:
        intelligenceSource === "apify_enrichment"
          ? nextDocument.meta.provider ?? "apify"
          : nextDocument.meta.provider,
      fetchedAt:
        intelligenceSource === "apify_enrichment" ? mergedAt : nextDocument.meta.fetchedAt,
    };

    const nextVersion =
      changedFields.length > 0 || !existing
        ? (existing?.version ?? 0) + 1
        : (existing?.version ?? 0);

    nextDocument.meta.documentVersion = nextVersion;

    if (changedFields.length > 0 || !existing) {
      await this.persistVersion(influencerId, nextVersion, nextDocument, {
        changeReason: input.changeReason ?? input.eventType ?? "ipl_snapshot_merge",
        changedFields,
        snapshotId: input.snapshotId ?? null,
      });
    }

    const rowPayload: Record<string, unknown> = {
      influencer_id: influencerId,
      document: nextDocument as never,
      version: nextVersion,
      last_snapshot_id: input.snapshotId ?? null,
      last_enrichment_run_id: input.enrichmentRunId ?? existing?.lastEnrichmentRunId ?? null,
      platform_account_ids: [...platformAccountIds],
      dna_completeness_score: completeness.dnaCompleteness,
      raw_apify_snapshot: (input.rawApifySnapshot ?? null) as never,
      enriched_at: intelligenceSource === "apify_enrichment" ? mergedAt : undefined,
      apify_run_id: apifyRunId,
      updated_at: mergedAt,
    };

    const { error } = await this.upsertCreatorDnaRow(rowPayload, {
      dna_lifecycle: metadataResult.lifecycle,
      last_intelligence_update: metadataResult.lastIntelligenceUpdate,
    });

    if (error) {
      console.error("[creator-dna] mergeEvidence failed", error.message);
      return { ok: false, changedFields, message: error.message };
    }

    await this.recordLineageEvent({
      influencerId,
      snapshotId: input.snapshotId,
      enrichmentRunId: input.enrichmentRunId ?? null,
      eventType: input.eventType ?? "ipl_snapshot_merge",
      fieldPaths: changedFields,
      metadata: {
        version: nextVersion,
        intelligenceSource,
        lifecycle: metadataResult.lifecycle as CreatorDnaLifecycle,
        missingFields: completeness.missingFields,
        dnaCompleteness: completeness.dnaCompleteness,
        sources: nextDocument.meta.sources,
      },
    });

    return {
      ok: true,
      changedFields,
      message: `Merged ${changedFields.length} field(s) for influencer ${influencerId}.`,
    };
  }

  /**
   * Merge `creator_dna_staging` → canonical `creator_dna` on identity promote.
   * Identity-only: does not touch Commercial Creator CRM.
   */
  async promoteStaging(
    discoveredProfileId: string,
    influencerId: string
  ): Promise<{
    ok: boolean;
    promoted: boolean;
    changedFields: string[];
    message: string;
  }> {
    const staging = await this.getStagingDNA(discoveredProfileId);
    if (!staging) {
      return {
        ok: true,
        promoted: false,
        changedFields: [],
        message: "No staging DNA to promote.",
      };
    }

    if (
      staging.promotedToInfluencerId &&
      staging.promotedToInfluencerId === influencerId
    ) {
      return {
        ok: true,
        promoted: false,
        changedFields: [],
        message: "Staging DNA already promoted for this influencer.",
      };
    }

    const paths = new Set<string>([
      ...DNA_STAGING_PROMOTE_FIELD_PATHS,
      ...APIFY_DNA_FIELD_PATHS,
    ]);
    const fields: MergeOptions["fields"] = [];
    const stagingDoc = staging.document as unknown as Record<string, unknown>;

    for (const path of paths) {
      if (path.startsWith("meta.")) continue;
      const envelope = getNestedEnvelope(stagingDoc, path);
      if (!envelopeHasValue(envelope)) continue;
      fields.push({
        path,
        value: envelope!.value,
        confidence: envelope!.confidence,
        source: envelope!.source,
        sourceVersion: envelope!.sourceVersion ?? null,
        updatedAt: envelope!.updatedAt,
        snapshotId: staging.lastSnapshotId,
      });
    }

    const mergeResult = await this.mergeEvidence(influencerId, {
      snapshotId: staging.lastSnapshotId,
      fields,
      platformAccountId: staging.platformAccountId,
      changeReason: "staging_promotion",
      eventType: "staging_promotion",
      intelligenceSource: "apify_enrichment",
      ensureRow: true,
      enrichedAt: new Date().toISOString(),
      lifecycleContext: {
        influencerStatus: "active",
        isImport: false,
        hasEnrichmentSnapshot: Boolean(staging.lastSnapshotId),
      },
    });

    if (!mergeResult.ok) {
      return {
        ok: false,
        promoted: false,
        changedFields: mergeResult.changedFields,
        message: mergeResult.message,
      };
    }

    const promotedAt = new Date().toISOString();
    const { error: markError } = await this.supabase
      .from("creator_dna_staging")
      .update({
        promoted_to_influencer_id: influencerId,
        promoted_at: promotedAt,
        updated_at: promotedAt,
      } as never)
      .eq("discovered_profile_id", discoveredProfileId);

    if (markError) {
      return {
        ok: false,
        promoted: false,
        changedFields: mergeResult.changedFields,
        message: markError.message,
      };
    }

    await this.recordLineageEvent({
      influencerId,
      discoveredProfileId,
      snapshotId: staging.lastSnapshotId,
      eventType: "staging_promotion",
      fieldPaths: mergeResult.changedFields,
      metadata: {
        promoted: true,
        stagingVersion: staging.version,
      },
    });

    return {
      ok: true,
      promoted: true,
      changedFields: mergeResult.changedFields,
      message: `Promoted staging DNA to influencer ${influencerId}.`,
    };
  }

  async mergeStagingEvidence(
    discoveredProfileId: string,
    input: Omit<MergeOptions, "enrichmentRunId">
  ): Promise<{ ok: boolean; changedFields: string[]; message: string }> {
    const existing = await this.getStagingDNA(discoveredProfileId);
    const document = existing?.document ?? createEmptyCreatorDNADocument();
    const { changedFields } = mergeCandidatesIntoDocument(document, input.fields);
    const completeness = calculateDnaCompleteness(document);

    const hasRowPersist =
      input.rawApifySnapshot != null ||
      input.apifyRunId != null ||
      input.enrichedAt != null;

    const enrichedAt = input.enrichedAt ?? new Date().toISOString();
    const apifyRunId = input.apifyRunId ?? document.meta.apifyRunId ?? null;
    const nextVersion =
      changedFields.length > 0 ? (existing?.version ?? 0) + 1 : (existing?.version ?? 0);

    if (changedFields.length > 0 || hasRowPersist) {
      document.meta = {
        ...document.meta,
        lastSnapshotId: input.snapshotId ?? null,
        platformAccountIds: input.platformAccountId
          ? [input.platformAccountId]
          : document.meta.platformAccountIds,
        documentVersion: changedFields.length > 0 ? nextVersion : document.meta.documentVersion,
        lastMergedAt: changedFields.length > 0 ? enrichedAt : document.meta.lastMergedAt,
        apifyRunId,
        provider: document.meta.provider ?? "apify",
        fetchedAt: enrichedAt,
      };
    }

    const { error } = await this.supabase.from("creator_dna_staging").upsert(
      {
        discovered_profile_id: discoveredProfileId,
        document: document as never,
        version: nextVersion,
        last_snapshot_id: input.snapshotId,
        platform_account_id: input.platformAccountId ?? existing?.platformAccountId ?? null,
        dna_completeness_score: completeness.dnaCompleteness,
        raw_apify_snapshot: (input.rawApifySnapshot ?? null) as never,
        enriched_at: hasRowPersist ? enrichedAt : undefined,
        apify_run_id: apifyRunId,
        updated_at: enrichedAt,
      } as never,
      { onConflict: "discovered_profile_id" }
    );

    if (error) {
      return { ok: false, changedFields, message: error.message };
    }

    await this.recordLineageEvent({
      discoveredProfileId,
      snapshotId: input.snapshotId,
      eventType: "ipl_snapshot_merge",
      fieldPaths: changedFields,
      metadata: { staging: true, version: nextVersion },
    });

    return {
      ok: true,
      changedFields,
      message: `Staging DNA updated for discovered profile ${discoveredProfileId}.`,
    };
  }

  private async upsertCreatorDnaRow(
    basePayload: Record<string, unknown>,
    intelligenceColumns: {
      dna_lifecycle: string;
      last_intelligence_update: string | null;
    }
  ): Promise<{ error: { message: string } | null }> {
    const includeIntelligenceColumns = this.intelligenceRowColumnsAvailable !== false;
    const payload = includeIntelligenceColumns
      ? { ...basePayload, ...intelligenceColumns }
      : basePayload;

    let { error } = await this.supabase
      .from("creator_dna")
      .upsert(payload as never, { onConflict: "influencer_id" });

    if (
      error?.message &&
      (error.message.includes("dna_lifecycle") ||
        error.message.includes("last_intelligence_update"))
    ) {
      this.intelligenceRowColumnsAvailable = false;
      ({ error } = await this.supabase
        .from("creator_dna")
        .upsert(basePayload as never, { onConflict: "influencer_id" }));
    } else if (!error) {
      this.intelligenceRowColumnsAvailable = true;
    }

    return { error };
  }

  private async persistVersion(
    influencerId: string,
    version: number,
    document: CreatorDNADocument,
    meta: { changeReason: string; changedFields: string[]; snapshotId: string | null }
  ): Promise<void> {
    await this.supabase.from("creator_dna_versions").insert({
      influencer_id: influencerId,
      version,
      document: document as never,
      change_reason: meta.changeReason,
      changed_fields: meta.changedFields,
      snapshot_id: meta.snapshotId,
    } as never);
  }

  private async recordLineageEvent(input: {
    influencerId?: string;
    discoveredProfileId?: string;
    snapshotId?: string | null;
    enrichmentRunId?: string | null;
    eventType: LineageEventType;
    fieldPaths: string[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.supabase.from("creator_dna_lineage_events").insert({
      influencer_id: input.influencerId ?? null,
      discovered_profile_id: input.discoveredProfileId ?? null,
      snapshot_id: input.snapshotId ?? null,
      enrichment_run_id: input.enrichmentRunId ?? null,
      event_type: input.eventType,
      field_paths: input.fieldPaths,
      metadata: input.metadata ?? {},
    } as never);
  }

  private rowToRecord(row: CreatorDnaRow): CreatorDNARecord {
    return {
      influencerId: row.influencer_id,
      document: parseCreatorDNADocument(row.document),
      version: row.version,
      lastSnapshotId: row.last_snapshot_id,
      lastEnrichmentRunId: row.last_enrichment_run_id,
      platformAccountIds: row.platform_account_ids ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private stagingRowToRecord(row: CreatorDnaStagingRow): CreatorDNAStagingRecord {
    return {
      id: row.id,
      discoveredProfileId: row.discovered_profile_id,
      document: parseCreatorDNADocument(row.document),
      version: row.version,
      lastSnapshotId: row.last_snapshot_id,
      platformAccountId: row.platform_account_id,
      promotedToInfluencerId: row.promoted_to_influencer_id,
      promotedAt: row.promoted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export function envelopeValue<T>(envelope: FieldHistoryEntry<T> | FieldEnvelope<T> | undefined): T | null {
  if (!envelope) return null;
  return envelope.value ?? null;
}

export { wrapValue };
