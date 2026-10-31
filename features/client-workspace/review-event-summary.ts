export function eventSummary(type: string, payload: Record<string, unknown> | null): string {
  switch (type) {
    case "campaign_sent_for_review":
      return "Campaign sent for review";
    case "creator_selected":
      return `Creator selected${payload?.name ? `: ${payload.name}` : ""}`;
    case "creator_rejected":
      return `Creator rejected${payload?.name ? `: ${payload.name}` : ""}`;
    case "comment_added":
      return "Comment added";
    case "changes_requested":
      return "Changes requested";
    case "version_published":
      return `Version ${payload?.review_number ?? ""} published`.trim();
    case "client_approved":
      return "Client approved";
    case "client_rejected":
      return "Client rejected";
    case "shortlist_approved":
      return "Shortlist approved";
    case "quotation_approved":
      return "Quotation approved";
    case "creators_confirmed":
      return "Client selection confirmed";
    case "selection_reopened":
      return "Client reopened their selection";
    case "quotation_revision_published":
      return "Updated quotation sent for approval";
    case "review_viewed":
      return "Client opened this review";
    case "link_revoked":
      return "Client Workspace link stopped";
    case "link_restored":
      return "Client Workspace link turned on again";
    case "access_requested":
      return "Client requested access to an expired workspace link";
    default:
      return type.replaceAll("_", " ");
  }
}
