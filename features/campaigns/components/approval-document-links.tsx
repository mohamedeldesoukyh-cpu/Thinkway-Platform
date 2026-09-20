import type { CampaignApprovalRow } from "@/features/campaigns/types";

/** File links preserve the IO endpoint's existing read permissions. */
export function ApprovalDocumentLinks({ row }: { row: CampaignApprovalRow }) {
  if (row.status !== "approved") return <span className="text-muted-foreground">—</span>;
  if (!row.document_url && !row.attachment_url) {
    return <span className="text-muted-foreground">Not linked</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {row.attachment_url ? (
        <a href={row.attachment_url} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          title={`Open ${row.attachment_label?.toLowerCase() ?? "attachment"} for ${row.document_number} in a new tab`}>
          {row.attachment_label ?? "Attachment"}
        </a>
      ) : null}
      {row.document_url ? (
        <a href={row.document_url} target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
          title={`Open the generated PDF for approved ${row.document_number} in a new tab. This is not a signed copy.`}>
          IO PDF
        </a>
      ) : null}
    </div>
  );
}
