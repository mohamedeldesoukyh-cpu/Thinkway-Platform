import { DownloadIcon, EyeIcon, PresentationIcon } from "lucide-react";

type CampaignProposalExportActionsProps = {
  campaignObjectId: string;
  conversationId?: string;
};

export type ProposalExportFormat = "html" | "pdf" | "pptx";

export function buildProposalExportHref(
  campaignObjectId: string,
  format: ProposalExportFormat,
  conversationId?: string
) {
  const params = new URLSearchParams({ format });
  if (conversationId) {
    params.set("conversationId", conversationId);
  }
  return `/api/ai/campaign-objects/${campaignObjectId}/export?${params.toString()}`;
}

const ACTION_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-[#1D9E75]/40 bg-[#1D9E75]/5 px-3 py-1.5 text-xs font-semibold text-[#1D9E75] transition-colors hover:bg-[#1D9E75]/10";

/** Preview the proposal in a new tab, or download it as PDF / PowerPoint. */
export function CampaignProposalExportActions({
  campaignObjectId,
  conversationId,
}: CampaignProposalExportActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={buildProposalExportHref(campaignObjectId, "html", conversationId)}
        target="_blank"
        rel="noreferrer"
        className={ACTION_CLASS}
      >
        <EyeIcon className="size-3.5" />
        Preview
      </a>
      <a
        href={buildProposalExportHref(campaignObjectId, "pdf", conversationId)}
        className={ACTION_CLASS}
      >
        <DownloadIcon className="size-3.5" />
        PDF
      </a>
      <a
        href={buildProposalExportHref(campaignObjectId, "pptx", conversationId)}
        className={ACTION_CLASS}
      >
        <PresentationIcon className="size-3.5" />
        PowerPoint
      </a>
    </div>
  );
}
