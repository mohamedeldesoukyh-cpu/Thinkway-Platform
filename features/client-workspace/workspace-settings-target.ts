export type ClientWorkspaceChoiceRow = {
  id: string;
  journey_id: string | null;
  campaign_name: string | null;
  source: string;
  status: string;
  review_number: number;
  created_at: string;
};

/** Linked quotations/shortlists resolve to one settings row and one usage counter. */
export function groupClientWorkspaceChoices(rows: ClientWorkspaceChoiceRow[]) {
  const choices = new Map<string, { reviewId: string; workspaceId: string; label: string }>();
  for (const row of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))) {
    const workspaceId = row.journey_id || row.id;
    if (choices.has(workspaceId)) continue;
    choices.set(workspaceId, {
      reviewId: row.id, workspaceId,
      label: `${row.campaign_name || "Untitled campaign"} · ${row.source} v${row.review_number}${row.status === "revoked" ? " · link off" : ""}`,
    });
  }
  return [...choices.values()];
}
