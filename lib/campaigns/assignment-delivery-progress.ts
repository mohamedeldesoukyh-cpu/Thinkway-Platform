import type { DeliveryPublication } from "./publication-delivery-coverage";
/** Billing is deliberately excluded: an advance invoice is not delivery evidence. */
type Post = { id?: string; workflow_status: string; live_date: string | null };
type Deliverable = Post & { platform?: string; deliverable_type?: string; quantity: number; posts: Post[] };
type Line = { id: string; assignment_status: string; went_live_date?: string | null };
type Group = { line: Line; deliverables: Deliverable[] };
const liveStatuses = new Set(['posted', 'published', 'live', 'verified']);
const isLive = (row: Post) => row.workflow_status !== 'cancelled' &&
  (Boolean(row.live_date) || liveStatuses.has(row.workflow_status));

export function assignmentDeliveryProgress(lines: Line[], groups: Group[], publications: DeliveryPublication[] = []) {
  const byId = new Map(groups.map(group => [group.line.id, group]));
  let live = 0;
  let verified = 0;
  for (const line of lines) {
    const deliverables = byId.get(line.id)?.deliverables ?? [];
    const hasPublication = publications.some(publication =>
      publication.campaign_line_id === line.id && Boolean(publication.content_url?.trim()) &&
      liveStatuses.has(publication.status.trim().toLowerCase()));
    const hasLive = hasPublication || Boolean(line.went_live_date) || deliverables.some(d =>
      d.posts.length ? d.posts.some(isLive) : isLive(d));
    // Delivery completion follows Went live at assignment level. One Performance
    // publication confirms the whole package, regardless of platform or quantity.
    const complete = hasLive || (!deliverables.length && liveStatuses.has(line.assignment_status));
    if (complete) {
      live++;
      verified++;
    }
  }
  // Do not round an unfinished campaign up to 100%.
  const percent = (count: number) => !lines.length ? 0 : count === lines.length ? 100 : Math.min(99, Math.round(count / lines.length * 100));
  return { live, verified, total: lines.length, progressPercent: percent(live), completionPercent: percent(verified) };
}
