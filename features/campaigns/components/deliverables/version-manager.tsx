'use client';
import { useEffect, useState } from 'react';
import { editDeliverableVersionAction, getDeliverableDocumentationDetailAction } from '@/features/campaigns/actions/deliverable-documentation-actions';
import type { PanelRow } from '@/features/campaigns/deliverables-panel-model';
import type { DeliverableAssetView, DeliverableAssetVersionView } from '@/lib/services/deliverables/documentation-types';
import { VERSION_STATUSES, VERSION_STATUS_LABELS, type VersionStatus, type VersionEdit } from '@/lib/services/deliverables/version-controls';
import { DeliverableAssetPreview } from './deliverable-asset-preview';

export function InlineVersions({row,refresh}:{row:PanelRow;refresh:()=>Promise<void>}) {
  const [open,setOpen]=useState(false);
  const [assets,setAssets]=useState<DeliverableAssetView[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(false);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    if (!open) return;
    let cancelled=false; setLoading(true); setError(null);
    getDeliverableDocumentationDetailAction(row).then(r=>{
      if (cancelled) return;
      if (!r.ok) setError(r.message); else setAssets((r.data?.assets ?? []).filter(a=>a.medium==='file'||a.medium==='external_link'));
    }).catch(()=>{if(!cancelled)setError('Could not load versions. Close and retry.');}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[open,row.unitKey,row.file?.versionId,revision]);
  return <div onClick={e=>e.stopPropagation()}>
    <button className="tw-b sm" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Close versions':'Videos & versions'}</button>
    {open && <div>{loading && <p role="status">Loading versions…</p>}{error && <p role="alert">{error}</p>}{assets.map(asset=>asset.versions.map(version=><VersionManager key={version.id + version.fileName + version.status + version.hidden + version.removed} row={row} asset={asset} version={version} onSaved={async()=>{await refresh();setRevision(n=>n+1);}}/>))}</div>}
  </div>;
}

export function VersionManager({row,asset,version,onSaved}:{row:PanelRow;asset:DeliverableAssetView;version:DeliverableAssetVersionView;onSaved:()=>Promise<void>}) {
  const [name,setName] = useState(version.fileName ?? asset.label ?? 'Video');
  const [status,setStatus] = useState<VersionStatus>(version.status ?? 'draft');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  async function save(edit:VersionEdit) {
    setBusy(true); setError(null);
    try {
      const result = await editDeliverableVersionAction({...row,versionId:version.id,edit});
      if (!result.ok) throw new Error(result.message);
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save version.'); }
    finally { setBusy(false); }
  }
  return <article className="pad2" aria-label={`Version ${version.versionNumber}`} style={{borderBottom:'1px solid #dce4f2'}}>
    <strong>V{version.versionNumber} · {VERSION_STATUS_LABELS[version.status ?? 'draft']}</strong>
    <p>{version.removed ? 'Removed — recoverable' : version.releasedToClientAt ? 'Visible to client' : 'Hidden from client'}</p>
    {!version.removed && <DeliverableAssetPreview {...row} asset={{...asset,currentVersion:version}}/>}
    <label className="tw-lbl" htmlFor={`version-name-${version.id}`}>Video name</label>
    <input className="tw-in" id={`version-name-${version.id}`} value={name} maxLength={200} disabled={busy} onChange={e=>setName(e.target.value)}/>
    <label className="tw-lbl" htmlFor={`version-status-${version.id}`}>Production status</label>
    <select className="tw-in" id={`version-status-${version.id}`} value={status} disabled={busy} onChange={e=>setStatus(e.target.value as VersionStatus)}>
      {VERSION_STATUSES.map(s=><option value={s} key={s}>{VERSION_STATUS_LABELS[s]}</option>)}
    </select>
    {version.contentDecision && <p>Client/reviewer decision: {version.contentDecision.decision.replaceAll('_',' ')} · {version.contentDecision.comment}</p>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
      <button className="tw-b sm" disabled={busy || !name.trim()} onClick={()=>void save({name,status})}>Save version</button>
      {version.removed ? <button className="tw-b sm" disabled={busy} onClick={()=>void save({visibility:'restore'})}>Restore as hidden</button> : <>
        <button className="tw-b sm" disabled={busy} onClick={()=>void save({visibility:version.releasedToClientAt ? 'hide' : 'show'})}>{version.releasedToClientAt ? 'Hide from client' : 'Show to client'}</button>
        <button className="tw-b sm" disabled={busy} onClick={()=>void save({visibility:'remove'})}>Remove version</button>
      </>}
    </div>
    <p className="tw-hint">Removal is recoverable. Client feedback stays in history. Restored versions stay hidden until you show them.</p>
    {error && <p role="alert">{error}</p>}
  </article>;
}
