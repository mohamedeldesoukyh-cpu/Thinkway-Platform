import { cache } from "react";
import { requireCreatorScope } from "@/features/portals/scope";
import {
  buildCreatorDocumentationUnitsFromSlots,
  type CreatorDocumentationSlot,
  type CreatorDocumentationUnitCard,
} from "@/features/creator-workspace/slots";
import {
  creatorFacingStatusLabel,
  creatorUploadPrompt,
  projectCreatorUnitStatus,
  unitExpectsPublicationUrl,
  type CreatorUnitStatus,
} from "@/features/creator-workspace/unit-status";
import { loadCampaignScriptForUnit } from "@/lib/campaign-script/load-master";
import {
  getDocumentationUnitDetail,
  listDocumentationAssetAggregates,
} from "@/lib/services/deliverables/documentation-service";
import {
  defaultDeliverableAssetType,
  versionCountsAsClientContent,
  type DeliverableAssetType,
} from "@/lib/services/deliverables/documentation-types";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { ScriptLanguage } from "@/lib/campaign-script";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CreatorScriptView = {
  sourceLanguage: ScriptLanguage;
  bodyEn: string;
  bodyAr: string;
  originalFileName: string | null;
  hasOriginalDocument: boolean;
};

export type CreatorUnitVersionView = {
  id: string;
  versionNumber: number;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string;
  onBehalfLabel: string | null;
  changeSummary: string | null;
  decision: "approved" | "changes_requested" | null;
  decisionComment: string | null;
};

export type CreatorUnitView = CreatorDocumentationUnitCard & {
  status: CreatorUnitStatus;
  statusLabel: string;
  received: boolean;
  hasScript: boolean;
  script: CreatorScriptView | null;
  currentVersionId: string | null;
  currentFileName: string | null;
  currentMimeType: string | null;
  currentFileSize: number | null;
  currentUploadedAt: string | null;
  currentVersionNumber: number | null;
  versions: CreatorUnitVersionView[];
  onBehalfLabel: string | null;
  comments: Array<{ id: string; body: string; createdAt: string; authorDisplayName: string | null }>;
  clientFeedback: { decision: "approved" | "changes_requested"; comment: string | null } | null;
  publicationUrl: string | null;
  publicationStatus: string | null;
  expectsPublicationUrl: boolean;
  uploadAssetType: DeliverableAssetType;
  uploadPrompt: string;
};

type SlotRow = {
  campaign_header_id: string;
  campaign_name: string;
  campaign_document_number: string;
  campaign_line_id: string;
  assignment_deliverable_id: string;
  assignment_post_schedule_id: string | null;
  sequence_number: number | null;
  quantity: number;
  deliverable_type: string;
  platform: string | null;
  due_date: string | null;
  post_status: string | null;
};

function serviceDb(): SupabaseClient {
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    throw new Error("Creator Workspace is temporarily unavailable.");
  }
  return service;
}

export async function creatorOwnsDocumentationUnit(
  supabase: Awaited<ReturnType<typeof requireCreatorScope>>["supabase"],
  assignmentDeliverableId: string,
  assignmentPostScheduleId: string | null
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("creator_owns_documentation_unit", {
    p_assignment_deliverable_id: assignmentDeliverableId,
    p_assignment_post_schedule_id: assignmentPostScheduleId,
  });
  if (error) return false;
  return data === true;
}

export async function listCreatorDocumentationSlots(): Promise<CreatorDocumentationSlot[]> {
  const { supabase } = await requireCreatorScope("creator_portal.read");
  const { data, error } = await (supabase as any).rpc("creator_list_documentation_slots");
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as SlotRow[]).map((row) => ({
    campaignHeaderId: row.campaign_header_id,
    campaignName: row.campaign_name,
    campaignDocumentNumber: row.campaign_document_number,
    campaignLineId: row.campaign_line_id,
    assignmentDeliverableId: row.assignment_deliverable_id,
    assignmentPostScheduleId: row.assignment_post_schedule_id,
    sequenceNumber: row.sequence_number,
    quantity: Number(row.quantity ?? 1),
    deliverableType: row.deliverable_type,
    platform: row.platform,
    dueDate: row.due_date,
    postStatus: row.post_status,
  }));
}

export async function listCreatorDocumentationUnits(): Promise<CreatorDocumentationUnitCard[]> {
  const slots = await listCreatorDocumentationSlots();
  return buildCreatorDocumentationUnitsFromSlots(slots);
}

export const loadCreatorUnitViews = cache(async function loadCreatorUnitViews(
  units?: CreatorDocumentationUnitCard[]
): Promise<CreatorUnitView[]> {
  const cards = units ?? (await listCreatorDocumentationUnits());
  if (cards.length === 0) return [];
  const db = serviceDb();
  const byCampaign = new Map<string, CreatorDocumentationUnitCard[]>();
  for (const card of cards) {
    const list = byCampaign.get(card.campaignHeaderId) ?? [];
    list.push(card);
    byCampaign.set(card.campaignHeaderId, list);
  }

  const views: CreatorUnitView[] = [];
  for (const [campaignHeaderId, campaignUnits] of byCampaign) {
    const aggregates = await listDocumentationAssetAggregates(db as never, campaignHeaderId);
    const deliverableIds = [...new Set(campaignUnits.map((unit) => unit.assignmentDeliverableId))];
    const [publications, decisions] = await Promise.all([
      db
        .from("campaign_publications")
        .select(
          "content_url, status, assignment_deliverable_id, assignment_post_schedule_id"
        )
        .eq("campaign_header_id", campaignHeaderId)
        .in("assignment_deliverable_id", deliverableIds),
      db
        .from("campaign_client_content_decisions")
        .select("version_id, decision, comment, decided_at")
        .eq("campaign_header_id", campaignHeaderId)
        .order("decided_at", { ascending: false }),
    ]);

    for (const card of campaignUnits) {
      views.push(
        await hydrateCreatorUnitView(db, card, {
          contentAssetCount: aggregates[card.unitKey]?.contentAssetCount ?? 0,
          publications: (publications.data ?? []) as Array<{
            content_url: string | null;
            status: string | null;
            assignment_deliverable_id: string | null;
            assignment_post_schedule_id: string | null;
          }>,
          decisions: (decisions.data ?? []) as Array<{
            version_id: string;
            decision: string;
            comment: string | null;
          }>,
        })
      );
    }
  }
  return views;
});

async function hydrateCreatorUnitView(
  db: SupabaseClient,
  card: CreatorDocumentationUnitCard,
  extra: {
    contentAssetCount: number;
    publications: Array<{
      content_url: string | null;
      status: string | null;
      assignment_deliverable_id: string | null;
      assignment_post_schedule_id: string | null;
    }>;
    decisions: Array<{ version_id: string; decision: string; comment: string | null }>;
  }
): Promise<CreatorUnitView> {
  const detail = await getDocumentationUnitDetail(db as never, {
    campaignHeaderId: card.campaignHeaderId,
    assignmentDeliverableId: card.assignmentDeliverableId,
    assignmentPostScheduleId: card.assignmentPostScheduleId,
    commentAudience: "creator",
    includeEvents: false,
  });
  const assets = detail?.assets ?? [];
  const current =
    assets
      .map((asset) => asset.currentVersion)
      .find((version) => versionCountsAsClientContent(version)) ??
    assets.map((asset) => asset.currentVersion).find((version) => version?.onBehalfLabel) ??
    assets[0]?.currentVersion ??
    null;
  const releasedToClient = Boolean(current?.releasedToClientAt);
  const latestDecision = current
    ? extra.decisions.find((row) => row.version_id === current.id)
    : null;
  const clientFeedback =
    releasedToClient &&
    (latestDecision?.decision === "approved" ||
      latestDecision?.decision === "changes_requested")
      ? {
          decision: latestDecision.decision as "approved" | "changes_requested",
          comment: latestDecision.comment,
        }
      : null;

  const publication = extra.publications.find((row) => {
    if (row.assignment_deliverable_id !== card.assignmentDeliverableId) return false;
    if (card.assignmentPostScheduleId) {
      return row.assignment_post_schedule_id === card.assignmentPostScheduleId;
    }
    return !row.assignment_post_schedule_id;
  });

  const script = await loadCampaignScriptForUnit(db as never, {
    campaignHeaderId: card.campaignHeaderId,
    assignmentDeliverableId: card.assignmentDeliverableId,
    assignmentPostScheduleId: card.assignmentPostScheduleId,
  });

  const received = extra.contentAssetCount > 0 || Boolean(current);
  const status = projectCreatorUnitStatus({
    received,
    releasedToClient,
    clientDecision: clientFeedback?.decision ?? null,
    postStatus: card.postStatus,
    hasPublicationUrl: Boolean(publication?.content_url?.trim()),
    publicationStatus: publication?.status ?? null,
  });

  const versionMap = new Map<string, CreatorUnitVersionView>();
  for (const asset of assets) {
    for (const version of asset.versions) {
      if (!versionCountsAsClientContent(version) && !version.onBehalfLabel) continue;
      const decision = extra.decisions.find((row) => row.version_id === version.id);
      versionMap.set(version.id, {
        id: version.id,
        versionNumber: version.versionNumber,
        fileName: version.fileName,
        mimeType: version.mimeType,
        fileSize: version.fileSize,
        uploadedAt: version.uploadedAt,
        onBehalfLabel: version.onBehalfLabel,
        changeSummary: version.changeSummary,
        decision:
          decision?.decision === "approved" || decision?.decision === "changes_requested"
            ? decision.decision
            : null,
        decisionComment: decision?.comment ?? null,
      });
    }
  }
  const versions = [...versionMap.values()].sort((a, b) => b.versionNumber - a.versionNumber);

  if (current && !versionMap.has(current.id)) {
    const decision = extra.decisions.find((row) => row.version_id === current.id);
    versions.unshift({
      id: current.id,
      versionNumber: current.versionNumber,
      fileName: current.fileName,
      mimeType: current.mimeType,
      fileSize: current.fileSize,
      uploadedAt: current.uploadedAt,
      onBehalfLabel: current.onBehalfLabel,
      changeSummary: current.changeSummary,
      decision:
        decision?.decision === "approved" || decision?.decision === "changes_requested"
          ? decision.decision
          : null,
      decisionComment: decision?.comment ?? null,
    });
  }

  return {
    ...card,
    status,
    statusLabel: creatorFacingStatusLabel({
      status,
      dueDate: card.dueDate,
      expectsPublicationUrl: unitExpectsPublicationUrl(card.deliverableType),
      publicationUrl: publication?.content_url ?? null,
    }),
    received,
    hasScript: Boolean(script),
    script: script
      ? {
          sourceLanguage: script.sourceLanguage,
          bodyEn: script.bodyEn,
          bodyAr: script.bodyAr,
          originalFileName: script.originalFileName,
          hasOriginalDocument: Boolean(script.originalStoragePath),
        }
      : null,
    currentVersionId: current?.id ?? null,
    currentFileName: current?.fileName ?? null,
    currentMimeType: current?.mimeType ?? null,
    currentFileSize: current?.fileSize ?? null,
    currentUploadedAt: current?.uploadedAt ?? null,
    currentVersionNumber: current?.versionNumber ?? null,
    versions,
    onBehalfLabel: current?.onBehalfLabel ?? null,
    comments: (detail?.comments ?? [])
      .filter((row) => row.audience === "creator")
      .map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        authorDisplayName: row.authorDisplayName,
      })),
    clientFeedback,
    publicationUrl: publication?.content_url ?? null,
    publicationStatus: publication?.status ?? null,
    expectsPublicationUrl: unitExpectsPublicationUrl(card.deliverableType),
    uploadAssetType: defaultDeliverableAssetType(card.deliverableType),
    uploadPrompt: creatorUploadPrompt(card.shortLabel),
  };
}
