import { useState } from 'react';
import type { PanelRow } from '@/features/campaigns/deliverables-panel-model';
import { canReuseCreatorVideo, isMirroredDeliverable } from '@/lib/services/deliverables/reuse-video-policy';

export function ReuseDeliverableVideo({ row, rows, busy, onLink }: {
  row: PanelRow; rows: PanelRow[]; busy: boolean; onLink: (versionId: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [versionId, setVersionId] = useState('');
  if (!isMirroredDeliverable(row)) return null;
  const choices = rows.filter(source => canReuseCreatorVideo(row, source) && source.file?.medium === 'file' &&
    source.file.mime?.startsWith('video/') && source.file.versionId && source.file.hasContent && source.file.releasedAt);
  return <div className="dv-reuse-video" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
    <button type="button" className="tw-b sm" disabled={busy} aria-expanded={open} onClick={() => setOpen(!open)}>Use existing video</button>
    {open && <div className="dv-reuse-video__choices">
      <label>Video from this creator<select className="tw-in" disabled={busy || !choices.length} value={versionId} onChange={e => setVersionId(e.target.value)}>
        <option value="">Choose a video</option>
        {choices.map(source => <option key={source.unitKey} value={source.file!.versionId!}>{source.label} · {source.file!.fileName} · v{source.file!.version}</option>)}
      </select></label>
      <p>{choices.length ? 'Reuses this video version without another upload. The client can view it here too. Future versions and review decisions stay separate.' : 'No available video for this creator yet. Upload a video to another deliverable in this campaign first.'}</p>
      <button type="button" className="tw-b sm" disabled={busy || !choices.some(c => c.file?.versionId === versionId)} onClick={async () => { if (await onLink(versionId)) { setOpen(false); setVersionId(''); } }}>{busy ? 'Please wait…' : 'Link video'}</button>
    </div>}
  </div>;
}
