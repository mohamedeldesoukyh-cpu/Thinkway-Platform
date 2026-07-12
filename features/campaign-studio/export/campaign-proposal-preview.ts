import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  buildCampaignProposalDocumentHtml,
  type ProposalBranding,
  type ProposalVendor,
} from "./campaign-proposal-document";

/** Open proposal preview in a new browser tab (print / Save as PDF). */
export function openCampaignProposalPreview(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = [],
  branding: ProposalBranding = {}
): void {
  const html = buildCampaignProposalDocumentHtml(campaignObject, hydratedVendors, branding);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
