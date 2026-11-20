/** Billing is deliberately excluded: an advance invoice is not delivery evidence. */
type Post = { workflow_status: string; live_date: string | null };
type Deliverable = Post & { quantity: number; posts: Post[] };
type Line = { id: string; assignment_status: string; went_live_date?: string | null };
type Group = { line: Line; deliverables: Deliverable[] };
const liveStatuses = new Set(['posted', 'published', 'live', 'verified']);
const isLive = (row: Post) => row.workflow_status !== 'cancelled' &&
  (Boolean(row.live_date) || liveStatuses.has(row.workflow_status));

export function assignmentDeliveryProgress(lines: Line[], groups: Group[]) {
  const byId = new Map(groups.map(group => [group.line.id, group]));
  let live = 0;
  let verified = 0;
  for (const line of lines) {
    const deliverables = byId.get(line.id)?.deliverables ?? [];
    const hasLive = Boolean(line.went_live_date) || deliverables.some(d =>
      d.posts.length ? d.posts.some(isLive) : isLive(d));
    // Child evidence takes precedence over a legacy assignment rollup.
    const fullyVerified = deliverables.length > 0
      ? deliverables.every(d => d.posts.length > 0
        ? d.posts.length >= Math.max(1, d.quantity) && d.posts.every(p => p.workflow_status === 'verified')
        : d.workflow_status === 'verified')
      : line.assignment_status === 'verified';
    if (hasLive || fullyVerified || (!deliverables.length && liveStatuses.has(line.assignment_status))) live++;
    if (fullyVerified) verified++;
  }
  // Do not round an unfinished campaign up to 100%.
  const percent = (count: number) => !lines.length ? 0 : count === lines.length ? 100 : Math.min(99, Math.round(count / lines.length * 100));
  return { live, verified, total: lines.length, progressPercent: percent(live), completionPercent: percent(verified) };
}
