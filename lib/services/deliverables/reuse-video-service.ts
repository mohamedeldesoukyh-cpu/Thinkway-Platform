import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { defaultDeliverableAssetType, type DocumentationUnitSummary } from './documentation-types';
import { canReuseCreatorVideo, isMirroredDeliverable } from './reuse-video-policy';
import { isVersionReleasedToClient, versionReleaseMetadata } from './client-release';
import { versionControls } from './version-controls';

/** Units come from the server's authorized campaign hierarchy, never browser input. */
export async function reuseDeliverableVideo(db: SupabaseClient<Database>, input: {
  campaignHeaderId: string; targetUnitKey: string; sourceVersionId: string; actorId: string;
}, units: DocumentationUnitSummary[]): Promise<{ ok: true } | { ok: false; message: string }> {
  const fail = (message: string) => ({ ok: false as const, message });
  const target = units.find(u => u.unitKey === input.targetUnitKey && u.campaignHeaderId === input.campaignHeaderId);
  if (!target || !isMirroredDeliverable(target) || !target.creatorId || (target.quantity > 1 && !target.assignmentPostScheduleId)) return fail('Choose an individual mirrored deliverable for this creator.');
  const version = await db.from('deliverable_asset_versions').select('id,asset_id,storage_bucket,storage_path,file_name,file_size,mime_type,metadata').eq('id', input.sourceVersionId).maybeSingle();
  const v = version.data;
  if (version.error || !v || !v.mime_type?.startsWith('video/') || !v.storage_bucket || !v.storage_path || !isVersionReleasedToClient(v.metadata)) return fail('Choose an available, client-visible video. Hidden or removed versions cannot be linked.');
  const asset = await db.from('deliverable_assets').select('id,assignment_deliverable_id,assignment_post_schedule_id,current_version_id,medium').eq('id', v.asset_id).eq('campaign_header_id', input.campaignHeaderId).is('archived_at', null).maybeSingle();
  const a = asset.data;
  const source = a && units.find(u => u.assignmentDeliverableId === a.assignment_deliverable_id && u.assignmentPostScheduleId === a.assignment_post_schedule_id);
  if (asset.error || !a || a.medium !== 'file' || a.current_version_id !== v.id || !source || !canReuseCreatorVideo(target, source)) return fail('Select the current video from the same creator in this campaign. Reload if it has changed.');
  const assetId = randomUUID();
  const versionId = randomUUID();
  const created = await db.from('deliverable_assets').insert({ id:assetId, campaign_header_id:input.campaignHeaderId,
    assignment_deliverable_id:target.assignmentDeliverableId, assignment_post_schedule_id:target.assignmentPostScheduleId,
    asset_type:defaultDeliverableAssetType(target.deliverableType), medium:'file', label:v.file_name, created_by:input.actorId });
  if (created.error) return fail('Could not link the video. Please retry.');
  const linked = await db.from('deliverable_asset_versions').insert({ id:versionId, asset_id:assetId, version_number:1,
    storage_bucket:v.storage_bucket, storage_path:v.storage_path, file_name:v.file_name, file_size:v.file_size, mime_type:v.mime_type,
    uploaded_by:input.actorId, change_summary:'Reused an existing video for a mirrored deliverable.',
    metadata:{ ...versionReleaseMetadata(true), production_status:versionControls(v.metadata).status,
      linked_source_version_id:v.id, linked_source_asset_id:a.id } });
  if (linked.error) {
    await db.from('deliverable_assets').update({ archived_at:new Date().toISOString() }).eq('id',assetId);
    return fail('Could not link the video version. Please retry.');
  }
  const updated = await db.from('deliverable_assets').update({ current_version_id:versionId }).eq('id',assetId);
  if (updated.error) return fail('The version was linked but its status could not be updated. Reload before trying again.');
  // Reuse the same stored bytes. Each deliverable keeps its own review and visibility.
  await db.from('deliverable_documentation_events').insert({ campaign_header_id:input.campaignHeaderId,
    assignment_deliverable_id:target.assignmentDeliverableId, assignment_post_schedule_id:target.assignmentPostScheduleId,
    asset_id:assetId, version_id:versionId, event_type:'upload', actor_user_id:input.actorId,
    payload:{ linked_source_version_id:v.id, action:'reuse_video' } });
  return { ok:true };
}
