/**
 * Deliverables Documentation Repository — Supabase service (Phase 1 internal).
 */

import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import type { Database } from "@/types/database";

import {
  buildDocumentationUnitsFromHierarchy,
  emptyAgg,
  type AssetAgg,
} from "./build-documentation-units";
import {
  DELIVERABLE_ASSET_MAX_BYTES,
  DELIVERABLE_ASSET_TOO_LARGE_MESSAGE,
  documentationUnitKey,
  mediumCountsAsReceived,
  rollupCreatorCompleteness,
  versionCountsAsClientContent,
  type DeliverableAssetMedium,
  type DeliverableAssetType,
  type DeliverableAssetView,
  type DeliverableCommentView,
  type DocumentationAudience,
  type DocumentationCompleteness,
  type DocumentationUnitDetail,
  type DocumentationUnitSummary,
  type DeliverableAssetVersionView,
} from "./documentation-types";

type Supabase = SupabaseClient<Database>;

const BUCKET = "deliverable-assets";

const CONTENT_MEDIA: DeliverableAssetMedium[] = ["file", "external_link"];

export async function listDocumentationUnits(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<DocumentationUnitSummary[]> {
  const hierarchy = await getCampaignAssignmentHierarchy(campaignHeaderId);
  const aggregates = await loadAggregates(supabase, campaignHeaderId);
  return buildDocumentationUnitsFromHierarchy(
    hierarchy,
    campaignHeaderId,
    aggregates
  );
}

export async function getCreatorDocumentationCompletenessMap(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<Map<string, DocumentationCompleteness>> {
  const units = await listDocumentationUnits(supabase, campaignHeaderId);
  const byCreator = new Map<string, DocumentationUnitSummary[]>();
  for (const unit of units) {
    const key = unit.creatorId ?? "unknown";
    const list = byCreator.get(key) ?? [];
    list.push(unit);
    byCreator.set(key, list);
  }
  const result = new Map<string, DocumentationCompleteness>();
  for (const [creatorId, list] of byCreator) {
    result.set(creatorId, rollupCreatorCompleteness(list));
  }
  return result;
}

export async function getDocumentationUnitDetail(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
  }
): Promise<DocumentationUnitDetail | null> {
  const assets = await loadAssetsForUnit(supabase, input);
  const comments = await loadComments(supabase, input);
  const events = await loadEvents(supabase, input);
  const agg = emptyAgg();
  const received = assets.some(
    (asset) =>
      mediumCountsAsReceived(asset.medium) &&
      versionCountsAsClientContent(asset.currentVersion)
  );
  return {
    unitKey: documentationUnitKey(
      input.assignmentDeliverableId,
      input.assignmentPostScheduleId
    ),
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    sequenceNumber: null,
    label: "",
    creatorId: null,
    creatorName: null,
    assignmentLineId: "",
    assignmentName: "",
    platform: null,
    deliverableType: null,
    dueDate: null,
    quantity: 1,
    received,
    ...agg,
    contentAssetCount: assets.filter(
      (asset) =>
        mediumCountsAsReceived(asset.medium) &&
        versionCountsAsClientContent(asset.currentVersion)
    ).length,
    totalAssetCount: assets.length,
    assets,
    comments,
    events,
  };
}

export async function listDocumentationAssetAggregates(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<Record<string, AssetAgg>> {
  const map = await loadAggregates(supabase, campaignHeaderId);
  return Object.fromEntries(map.entries());
}

export async function addExternalLinkAsset(
  supabase: Supabase,
  input: {
    actorId: string;
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    assetType: DeliverableAssetType;
    label?: string | null;
    externalUrl: string;
    changeSummary?: string | null;
  }
): Promise<{ ok: true; assetId: string } | { ok: false; message: string }> {
  const url = input.externalUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, message: "External link must be an http(s) URL." };
  }

  return createAssetWithVersion(supabase, {
    ...input,
    medium: "external_link",
    externalUrl: url,
    eventType: "link_add",
  });
}

export async function addTextAsset(
  supabase: Supabase,
  input: {
    actorId: string;
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    assetType: DeliverableAssetType;
    label?: string | null;
    textBody: string;
    changeSummary?: string | null;
  }
): Promise<{ ok: true; assetId: string } | { ok: false; message: string }> {
  if (!input.textBody.trim()) {
    return { ok: false, message: "Text body is required." };
  }
  return createAssetWithVersion(supabase, {
    ...input,
    medium: "text",
    textBody: input.textBody.trim(),
    eventType: "upload",
  });
}

export async function addFileAssetVersion(
  supabase: Supabase,
  input: {
    actorId: string;
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    assetType: DeliverableAssetType;
    label?: string | null;
    /** Existing asset to version; omit to create new asset. */
    assetId?: string | null;
    fileName: string;
    mimeType: string;
    fileSize: number;
    fileBytes: ArrayBuffer;
    changeSummary?: string | null;
  }
): Promise<{ ok: true; assetId: string; versionId: string } | { ok: false; message: string }> {
  if (input.fileSize > DELIVERABLE_ASSET_MAX_BYTES) {
    return { ok: false, message: DELIVERABLE_ASSET_TOO_LARGE_MESSAGE };
  }
  let assetId = input.assetId ?? null;

  if (!assetId) {
    const created = await supabase
      .from("deliverable_assets")
      .insert({
        campaign_header_id: input.campaignHeaderId,
        assignment_deliverable_id: input.assignmentDeliverableId,
        assignment_post_schedule_id: input.assignmentPostScheduleId,
        asset_type: input.assetType,
        medium: "file",
        label: input.label ?? input.fileName,
        created_by: input.actorId,
      })
      .select("id")
      .single();
    if (created.error || !created.data) {
      return { ok: false, message: created.error?.message ?? "Failed to create asset" };
    }
    assetId = created.data.id;
  }

  const { data: latest } = await supabase
    .from("deliverable_asset_versions")
    .select("version_number")
    .eq("asset_id", assetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = Number(latest?.version_number ?? 0) + 1;
  const versionId = randomUUID();
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${input.campaignHeaderId}/${input.assignmentDeliverableId}/${assetId}/${versionId}-${safeName}`;

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.fileBytes, {
      contentType: input.mimeType || "application/octet-stream",
      upsert: false,
    });
  if (upload.error) {
    return { ok: false, message: upload.error.message };
  }

  const { error: versionError } = await supabase
    .from("deliverable_asset_versions")
    .insert({
      id: versionId,
      asset_id: assetId,
      version_number: versionNumber,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: input.mimeType,
      file_name: input.fileName,
      file_size: input.fileSize,
      change_summary: input.changeSummary ?? null,
      uploaded_by: input.actorId,
    });
  if (versionError) {
    return { ok: false, message: versionError.message };
  }

  await supabase
    .from("deliverable_assets")
    .update({ current_version_id: versionId })
    .eq("id", assetId);

  await logEvent(supabase, {
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetId,
    versionId,
    eventType: versionNumber === 1 ? "upload" : "replace",
    actorUserId: input.actorId,
    payload: {
      file_name: input.fileName,
      version_number: versionNumber,
      asset_type: input.assetType,
    },
  });

  return { ok: true, assetId, versionId };
}

export type BegunDeliverableFileUpload = {
  assetId: string;
  versionId: string;
  versionNumber: number;
  storagePath: string;
  bucket: string;
  signedUrl: string;
  token: string;
};

export async function beginFileAssetUpload(
  supabase: Supabase,
  input: {
    actorId: string;
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    assetType: DeliverableAssetType;
    label?: string | null;
    assetId?: string | null;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }
): Promise<({ ok: true } & BegunDeliverableFileUpload) | { ok: false; message: string }> {
  if (input.fileSize <= 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  if (input.fileSize > DELIVERABLE_ASSET_MAX_BYTES) {
    return { ok: false, message: DELIVERABLE_ASSET_TOO_LARGE_MESSAGE };
  }

  let assetId = input.assetId ?? null;
  if (!assetId) {
    const created = await supabase
      .from("deliverable_assets")
      .insert({
        campaign_header_id: input.campaignHeaderId,
        assignment_deliverable_id: input.assignmentDeliverableId,
        assignment_post_schedule_id: input.assignmentPostScheduleId,
        asset_type: input.assetType,
        medium: "file",
        label: input.label ?? input.fileName,
        created_by: input.actorId,
      })
      .select("id")
      .single();
    if (created.error || !created.data) {
      return { ok: false, message: created.error?.message ?? "Failed to create asset" };
    }
    assetId = created.data.id;
  }

  const { data: latest } = await supabase
    .from("deliverable_asset_versions")
    .select("version_number")
    .eq("asset_id", assetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const versionNumber = Number(latest?.version_number ?? 0) + 1;
  const versionId = randomUUID();
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${input.campaignHeaderId}/${input.assignmentDeliverableId}/${assetId}/${versionId}-${safeName}`;

  const signed = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath);
  if (signed.error || !signed.data?.signedUrl || !signed.data.token) {
    return {
      ok: false,
      message: signed.error?.message ?? "Could not start the file upload.",
    };
  }

  return {
    ok: true,
    assetId,
    versionId,
    versionNumber,
    storagePath,
    bucket: BUCKET,
    signedUrl: signed.data.signedUrl,
    token: signed.data.token,
  };
}

export async function completeFileAssetUpload(
  supabase: Supabase,
  input: {
    actorId: string;
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    assetType: DeliverableAssetType;
    fileName: string;
    mimeType: string;
    fileSize: number;
    changeSummary?: string | null;
    assetId: string;
    versionId: string;
    versionNumber: number;
    storagePath: string;
  }
): Promise<{ ok: true; assetId: string; versionId: string } | { ok: false; message: string }> {
  const existing = await supabase
    .from("deliverable_asset_versions")
    .select("id")
    .eq("id", input.versionId)
    .maybeSingle();
  if (existing.data?.id) {
    return { ok: true, assetId: input.assetId, versionId: input.versionId };
  }

  const uploaded = await supabase.storage.from(BUCKET).createSignedUrl(input.storagePath, 30);
  if (uploaded.error || !uploaded.data?.signedUrl) {
    return { ok: false, message: "Upload did not finish. Try again." };
  }

  const { error: versionError } = await supabase.from("deliverable_asset_versions").insert({
    id: input.versionId,
    asset_id: input.assetId,
    version_number: input.versionNumber,
    storage_bucket: BUCKET,
    storage_path: input.storagePath,
    mime_type: input.mimeType,
    file_name: input.fileName,
    file_size: input.fileSize,
    change_summary: input.changeSummary ?? null,
    uploaded_by: input.actorId,
  });
  if (versionError) {
    return { ok: false, message: versionError.message };
  }

  await supabase
    .from("deliverable_assets")
    .update({ current_version_id: input.versionId })
    .eq("id", input.assetId);

  await logEvent(supabase, {
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetId: input.assetId,
    versionId: input.versionId,
    eventType: input.versionNumber === 1 ? "upload" : "replace",
    actorUserId: input.actorId,
    payload: {
      file_name: input.fileName,
      version_number: input.versionNumber,
      asset_type: input.assetType,
    },
  });

  return { ok: true, assetId: input.assetId, versionId: input.versionId };
}

export async function addInternalComment(
  supabase: Supabase,
  input: {
    actorId: string;
    actorDisplayName?: string | null;
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    body: string;
    audience?: DocumentationAudience;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = input.body.trim();
  if (!body) return { ok: false, message: "Comment body is required." };

  const { data, error } = await supabase
    .from("deliverable_comments")
    .insert({
      campaign_header_id: input.campaignHeaderId,
      assignment_deliverable_id: input.assignmentDeliverableId,
      assignment_post_schedule_id: input.assignmentPostScheduleId,
      audience: input.audience ?? "internal",
      body,
      author_user_id: input.actorId,
      author_display_name: input.actorDisplayName ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Failed to add comment" };
  }

  await logEvent(supabase, {
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    commentId: data.id,
    eventType: "comment",
    actorUserId: input.actorId,
    payload: { audience: input.audience ?? "internal" },
  });

  return { ok: true };
}

export async function createSignedAssetDownloadUrl(
  supabase: Supabase,
  input: {
    actorId: string;
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    versionId: string;
  }
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const { data: version, error } = await supabase
    .from("deliverable_asset_versions")
    .select("id, storage_bucket, storage_path, asset_id")
    .eq("id", input.versionId)
    .maybeSingle();
  if (error || !version?.storage_bucket || !version.storage_path) {
    return { ok: false, message: "File version not found." };
  }

  const signed = await supabase.storage
    .from(version.storage_bucket)
    .createSignedUrl(version.storage_path, 60 * 15);
  if (signed.error || !signed.data?.signedUrl) {
    return { ok: false, message: signed.error?.message ?? "Failed to sign URL" };
  }

  await logEvent(supabase, {
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetId: version.asset_id,
    versionId: version.id,
    eventType: "download",
    actorUserId: input.actorId,
    payload: {},
  });

  return { ok: true, url: signed.data.signedUrl };
}

async function createAssetWithVersion(
  supabase: Supabase,
  input: {
    actorId: string;
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    assetType: DeliverableAssetType;
    medium: DeliverableAssetMedium;
    label?: string | null;
    externalUrl?: string | null;
    textBody?: string | null;
    changeSummary?: string | null;
    eventType: "upload" | "link_add";
  }
): Promise<{ ok: true; assetId: string } | { ok: false; message: string }> {
  const { data: asset, error: assetError } = await supabase
    .from("deliverable_assets")
    .insert({
      campaign_header_id: input.campaignHeaderId,
      assignment_deliverable_id: input.assignmentDeliverableId,
      assignment_post_schedule_id: input.assignmentPostScheduleId,
      asset_type: input.assetType,
      medium: input.medium,
      label: input.label ?? null,
      created_by: input.actorId,
    })
    .select("id")
    .single();
  if (assetError || !asset) {
    return { ok: false, message: assetError?.message ?? "Failed to create asset" };
  }

  const versionId = randomUUID();
  const { error: versionError } = await supabase
    .from("deliverable_asset_versions")
    .insert({
      id: versionId,
      asset_id: asset.id,
      version_number: 1,
      external_url: input.externalUrl ?? null,
      text_body: input.textBody ?? null,
      change_summary: input.changeSummary ?? null,
      uploaded_by: input.actorId,
      file_name: input.label ?? null,
    });
  if (versionError) {
    return { ok: false, message: versionError.message };
  }

  await supabase
    .from("deliverable_assets")
    .update({ current_version_id: versionId })
    .eq("id", asset.id);

  await logEvent(supabase, {
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetId: asset.id,
    versionId,
    eventType: input.eventType,
    actorUserId: input.actorId,
    payload: {
      asset_type: input.assetType,
      medium: input.medium,
      external_url: input.externalUrl ?? null,
    },
  });

  return { ok: true, assetId: asset.id };
}

async function loadAggregates(
  supabase: Supabase,
  campaignHeaderId: string
): Promise<Map<string, AssetAgg>> {
  const map = new Map<string, AssetAgg>();

  const { data: assets } = await supabase
    .from("deliverable_assets")
    .select(
      "id, assignment_deliverable_id, assignment_post_schedule_id, medium, current_version_id, label, archived_at"
    )
    .eq("campaign_header_id", campaignHeaderId)
    .is("archived_at", null);

  const assetRows = assets ?? [];
  const assetIds = assetRows.map((a) => a.id);
  const versionByAsset = new Map<
    string,
    {
      count: number;
      latestLabel: string | null;
      latestAt: string | null;
      playable: boolean;
    }
  >();

  if (assetIds.length > 0) {
    const { data: versions } = await supabase
      .from("deliverable_asset_versions")
      .select(
        "asset_id, version_number, file_name, uploaded_at, storage_bucket, storage_path, external_url"
      )
      .in("asset_id", assetIds)
      .order("version_number", { ascending: false });

    for (const version of versions ?? []) {
      const prev = versionByAsset.get(version.asset_id);
      const playable = versionCountsAsClientContent({
        storageBucket: version.storage_bucket,
        storagePath: version.storage_path,
        externalUrl: version.external_url,
      });
      if (!prev) {
        versionByAsset.set(version.asset_id, {
          count: 1,
          latestLabel: version.file_name,
          latestAt: version.uploaded_at,
          playable,
        });
      } else {
        prev.count += 1;
        if (playable) prev.playable = true;
      }
    }
  }

  const { data: links } = await supabase
    .from("deliverable_publication_links")
    .select("assignment_deliverable_id, assignment_post_schedule_id")
    .eq("campaign_header_id", campaignHeaderId);

  for (const link of links ?? []) {
    const key = documentationUnitKey(
      link.assignment_deliverable_id,
      link.assignment_post_schedule_id
    );
    const agg = map.get(key) ?? emptyAgg();
    agg.publicationLinkCount += 1;
    map.set(key, agg);
  }

  for (const asset of assetRows) {
    const key = documentationUnitKey(
      asset.assignment_deliverable_id,
      asset.assignment_post_schedule_id
    );
    const agg = map.get(key) ?? emptyAgg();
    agg.totalAssetCount += 1;
    const v = versionByAsset.get(asset.id);
    if (
      CONTENT_MEDIA.includes(asset.medium as DeliverableAssetMedium) &&
      mediumCountsAsReceived(asset.medium as DeliverableAssetMedium) &&
      v?.playable
    ) {
      agg.contentAssetCount += 1;
    }
    if (v) {
      agg.revisionCount += v.count;
      if (
        !agg.lastUpdatedAt ||
        (v.latestAt && v.latestAt > agg.lastUpdatedAt)
      ) {
        agg.lastUpdatedAt = v.latestAt;
        agg.latestVersionLabel = v.latestLabel ?? asset.label;
      }
    }
    map.set(key, agg);
  }

  return map;
}

async function loadAssetsForUnit(
  supabase: Supabase,
  input: {
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
  }
): Promise<DeliverableAssetView[]> {
  let query = supabase
    .from("deliverable_assets")
    .select("*")
    .eq("assignment_deliverable_id", input.assignmentDeliverableId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (input.assignmentPostScheduleId) {
    query = query.or(
      `assignment_post_schedule_id.eq.${input.assignmentPostScheduleId},assignment_post_schedule_id.is.null`
    );
  } else {
    query = query.is("assignment_post_schedule_id", null);
  }

  const { data: assets } = await query;
  if (!assets?.length) return [];

  const ids = assets.map((a) => a.id);
  const { data: versions } = await supabase
    .from("deliverable_asset_versions")
    .select("*")
    .in("asset_id", ids)
    .order("version_number", { ascending: false });

  const byAsset = new Map<string, DeliverableAssetVersionView[]>();
  for (const version of versions ?? []) {
    const view: DeliverableAssetVersionView = {
      id: version.id,
      versionNumber: version.version_number,
      storageBucket: version.storage_bucket,
      storagePath: version.storage_path,
      externalUrl: version.external_url,
      mimeType: version.mime_type,
      fileName: version.file_name,
      fileSize: version.file_size,
      textBody: version.text_body,
      changeSummary: version.change_summary,
      uploadedBy: version.uploaded_by,
      uploadedAt: version.uploaded_at,
    };
    const list = byAsset.get(version.asset_id) ?? [];
    list.push(view);
    byAsset.set(version.asset_id, list);
  }

  return assets.map((asset) => {
    const versionsForAsset = byAsset.get(asset.id) ?? [];
    const current =
      versionsForAsset.find((v) => v.id === asset.current_version_id) ??
      versionsForAsset[0] ??
      null;
    return {
      id: asset.id,
      assetType: asset.asset_type as DeliverableAssetType,
      medium: asset.medium as DeliverableAssetMedium,
      label: asset.label,
      sortOrder: asset.sort_order,
      currentVersion: current,
      versions: versionsForAsset,
      createdAt: asset.created_at,
      archivedAt: asset.archived_at,
    };
  });
}

async function loadComments(
  supabase: Supabase,
  input: {
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
  }
): Promise<DeliverableCommentView[]> {
  let query = supabase
    .from("deliverable_comments")
    .select("*")
    .eq("assignment_deliverable_id", input.assignmentDeliverableId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (input.assignmentPostScheduleId) {
    query = query.eq(
      "assignment_post_schedule_id",
      input.assignmentPostScheduleId
    );
  } else {
    query = query.is("assignment_post_schedule_id", null);
  }

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    audience: row.audience as DocumentationAudience,
    body: row.body,
    authorUserId: row.author_user_id,
    authorDisplayName: row.author_display_name,
    createdAt: row.created_at,
  }));
}

async function loadEvents(
  supabase: Supabase,
  input: {
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
  }
) {
  let query = supabase
    .from("deliverable_documentation_events")
    .select("*")
    .eq("assignment_deliverable_id", input.assignmentDeliverableId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (input.assignmentPostScheduleId) {
    query = query.eq(
      "assignment_post_schedule_id",
      input.assignmentPostScheduleId
    );
  }

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    actorLabel: row.actor_label,
    payload: row.payload ?? {},
    occurredAt: row.occurred_at,
  }));
}

async function logEvent(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId: string | null;
    assetId?: string | null;
    versionId?: string | null;
    commentId?: string | null;
    eventType: string;
    actorUserId: string;
    payload: Record<string, unknown>;
  }
) {
  await supabase.from("deliverable_documentation_events").insert({
    campaign_header_id: input.campaignHeaderId,
    assignment_deliverable_id: input.assignmentDeliverableId,
    assignment_post_schedule_id: input.assignmentPostScheduleId,
    asset_id: input.assetId ?? null,
    version_id: input.versionId ?? null,
    comment_id: input.commentId ?? null,
    event_type: input.eventType,
    actor_user_id: input.actorUserId,
    payload: input.payload,
  });
}
