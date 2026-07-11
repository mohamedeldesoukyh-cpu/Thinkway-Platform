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

const BASE_CLASS =
  "inline-flex items-center gap-1.5 rounded-[11px] px-3.5 py-2 text-xs font-bold transition-all hover:-translate-y-px active:translate-y-0";

/** Preview the proposal in a new tab, or download it as PDF / PowerPoint. */
export function CampaignProposalExportActions({
  campaignObjectId,
  conversationId,
}: CampaignProposalExportActionsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Export campaign proposal"
    >
      <a
        href={buildProposalExportHref(campaignObjectId, "html", conversationId)}
        target="_blank"
        rel="noreferrer"
        className={`${BASE_CLASS} border border-[#0B0F1A]/8 bg-white text-foreground shadow-[0_1px_2px_rgba(6,8,16,0.05)] hover:border-[#0057FF]/25 dark:border-border dark:bg-background`}
        aria-label="Preview proposal in a new tab"
      >
        <EyeIcon className="size-3.5" aria-hidden />
        Preview
      </a>
      <a
        href={buildProposalExportHref(campaignObjectId, "pdf", conversationId)}
        className={`${BASE_CLASS} bg-gradient-to-br from-[#0040CC] via-[#0057FF] to-[#1A6FFF] text-white shadow-[0_10px_22px_rgba(0,87,255,0.35)]`}
        aria-label="Download proposal as PDF"
      >
        <DownloadIcon className="size-3.5" aria-hidden />
        Export PDF
      </a>
      <a
        href={buildProposalExportHref(campaignObjectId, "pptx", conversationId)}
        className={`${BASE_CLASS} bg-gradient-to-br from-[#B7472A] to-[#D2571F] text-white shadow-[0_10px_22px_rgba(178,70,30,0.3)]`}
        aria-label="Download proposal as PowerPoint"
      >
        <PresentationIcon className="size-3.5" aria-hidden />
        PowerPoint
      </a>
    </div>
  );
}
