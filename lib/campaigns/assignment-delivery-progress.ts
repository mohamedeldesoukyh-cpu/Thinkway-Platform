import { deliveryKind, requiresPublication, publicationDeliveryCoverage, type DeliveryPublication } from "./publication-delivery-coverage";
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
    const coverage = publicationDeliveryCoverage(line.id, deliverables, publications);
    const hasLive = coverage.some(count => count > 0) || Boolean(line.went_live_date) || deliverables.some(d =>
      d.posts.length ? d.posts.some(isLive) : isLive(d));
    // Stories need no separate verification, but an untouched story-only package is not complete.
    const fullyVerified = deliverables.length > 0 && hasLive && deliverables.every((d, index) => {
      if (deliveryKind(d.deliverable_type) === 'story') return true;
      if (requiresPublication(d.deliverable_type)) return coverage[index] >= Math.max(1, d.quantity);
      // Offline services use their recorded delivery; no extra verification workflow.
      return Boolean(line.went_live_date) || (d.posts.length > 0
        ? d.posts.length >= Math.max(1, d.quantity) && d.posts.every(isLive)
        : isLive(d));
    });
    if (hasLive || fullyVerified || (!deliverables.length && liveStatuses.has(line.assignment_status))) live++;
    if (fullyVerified) verified++;
  }
  // Do not round an unfinished campaign up to 100%.
  const percent = (count: number) => !lines.length ? 0 : count === lines.length ? 100 : Math.min(99, Math.round(count / lines.length * 100));
  return { live, verified, total: lines.length, progressPercent: percent(live), completionPercent: percent(verified) };
}
