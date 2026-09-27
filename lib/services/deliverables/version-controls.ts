export const VERSION_STATUSES = ['draft', 'ready_for_review', 'internally_approved', 'final'] as const;
export type VersionStatus = typeof VERSION_STATUSES[number];
export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  draft: 'Draft', ready_for_review: 'Ready for review', internally_approved: 'Internally approved', final: 'Final',
};
export function versionControls(metadata: unknown) {
  const m = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  return {
    status: VERSION_STATUSES.includes(m.production_status as VersionStatus) ? m.production_status as VersionStatus : 'draft' as VersionStatus,
    hidden: Boolean(m.client_hidden_at), removed: Boolean(m.version_removed_at),
  };
}
export type VersionEdit = { name?: string; status?: VersionStatus; visibility?: 'show' | 'hide' | 'remove' | 'restore' };
export function editVersionMetadata(metadata: unknown, edit: VersionEdit, actorId: string, now: string) {
  const previous = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  if (edit.status !== undefined && !VERSION_STATUSES.includes(edit.status)) throw new Error('Invalid version status.');
  if (edit.name !== undefined && (!edit.name.trim() || edit.name.trim().length > 200)) throw new Error('Enter a name between 1 and 200 characters.');
  if (edit.visibility !== undefined && !['show', 'hide', 'remove', 'restore'].includes(edit.visibility)) throw new Error('Invalid visibility.');
  const next = { ...previous };
  if (edit.status !== undefined) next.production_status = edit.status;
  if (edit.visibility === 'hide') next.client_hidden_at = now;
  if (edit.visibility === 'remove') next.version_removed_at = now;
  if (edit.visibility === 'restore') { next.version_removed_at = null; next.client_hidden_at = now; }
  if (edit.visibility === 'show') { next.client_hidden_at = null; next.version_removed_at = null; next.released_to_client_at = previous.released_to_client_at || now; }
  next.version_edited_at = now;
  next.version_edited_by = actorId;
  return next;
}
