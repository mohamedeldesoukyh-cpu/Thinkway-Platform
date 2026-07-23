/**
 * Campaign Brief SSOT reference on campaign object meta — links brief across modules.
 */

import type { CampaignObject, CampaignObjectMeta } from "@/features/campaign-intelligence";

export type CampaignBriefSource = "studio" | "outputs" | "discovery" | "quotation" | "media_plan";

export type CampaignBriefRef = {
  id: string;
  uploadedAt: string;
  source: CampaignBriefSource;
  textLength: number;
  fileRefs?: string[];
};

/** Pipeline timestamps for future Brief → Quotation → Campaign conversion reporting. */
export type CampaignBriefPipelineMeta = {
  briefAttachedAt?: string;
  quotationLinkedAt?: string;
  campaignCreatedAt?: string;
  mediaPlanGeneratedAt?: string;
};

function generateBriefId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `brief-${Date.now()}`;
}

/** Upsert brief reference when text is applied — preserves id when updating in place. */
export function upsertCampaignBriefRef(
  meta: CampaignObjectMeta,
  input: { briefText: string; source: CampaignBriefSource; fileRefs?: string[] }
): CampaignObjectMeta {
  const now = new Date().toISOString();
  const existing = meta.campaignBriefRef;

  const campaignBriefRef: CampaignBriefRef = {
    id: existing?.id ?? generateBriefId(),
    uploadedAt: now,
    source: input.source,
    textLength: input.briefText.trim().length,
    fileRefs: input.fileRefs ?? existing?.fileRefs,
  };

  const briefPipeline: CampaignBriefPipelineMeta = {
    ...(meta.briefPipeline ?? {}),
    briefAttachedAt: now,
    campaignCreatedAt: meta.briefPipeline?.campaignCreatedAt ?? now,
  };

  return { ...meta, campaignBriefRef, briefPipeline };
}

export function hasCampaignBriefRef(campaignObject?: CampaignObject): boolean {
  return Boolean(campaignObject?.meta.campaignBriefRef?.id);
}

export function recordMediaPlanGenerated(meta: CampaignObjectMeta): CampaignObjectMeta {
  if (!meta.campaignBriefRef) return meta;
  return {
    ...meta,
    briefPipeline: {
      ...(meta.briefPipeline ?? {}),
      mediaPlanGeneratedAt: new Date().toISOString(),
    },
  };
}
