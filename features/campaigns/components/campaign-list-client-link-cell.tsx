"use client";

import { ClientWorkspaceListLinkCell } from "@/features/client-workspace/components/client-workspace-list-link-cell";
import type { CampaignClientWorkspaceLink } from "@/features/client-workspace/client-review-selection";

type Props = {
  campaignHeaderId: string;
  campaignName?: string;
  link?: CampaignClientWorkspaceLink;
};

export function CampaignListClientLinkCell({ campaignHeaderId, link, campaignName }: Props) {
  return <ClientWorkspaceListLinkCell source="campaign" id={campaignHeaderId} link={link} campaignName={campaignName} />;
}
