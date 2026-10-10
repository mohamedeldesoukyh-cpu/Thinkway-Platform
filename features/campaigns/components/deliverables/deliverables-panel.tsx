"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { CreatorAvatarImage } from '@/components/creator/creator-avatar-image';
import { PlatformIcon } from '@/lib/performance/platform-icon';
import './deliverables-card.css';
import { VersionManager, InlineVersions } from './version-manager';
import { ReuseDeliverableVideo } from './reuse-deliverable-video';
import { DeliverableUploadProgress, type CardUploadProgress } from './deliverable-upload-progress';
import { VERSION_STATUSES, VERSION_STATUS_LABELS, type VersionStatus } from '@/lib/services/deliverables/version-controls';
import '@/app/styles/deliverables-suite.css';
import './deliverable-upload-progress.css';
import type { CampaignWorkspace } from '@/features/campaigns/types';
import type { AssignmentHierarchy } from '@/features/campaigns/types/assignment-hierarchy';
import { buildDocumentationUnitsFromHierarchy } from '@/lib/services/deliverables/build-documentation-units';
import { buildPanelRows, filterPanelRows, DELIVERABLE_COLUMNS, PANEL_UPLOAD_ACCEPT, validatePanelUpload, type PanelRow, type PanelStatus, type PanelSnapshot } from '@/features/campaigns/deliverables-panel-model';
import { reuseDeliverablesPanelVideoAction, getDeliverablesPanelSnapshotAction, beginDeliverablesPanelUploadAction, completeDeliverablesPanelUploadAction, getDeliverableDocumentationDetailAction, getContentReviewDatesAction, saveContentReviewDatesAction, addDeliverableTextAssetAction, addDeliverableExternalLinkAction } from '@/features/campaigns/actions/deliverable-documentation-actions';
import { addDeliverableOnBehalfTextAction, addDeliverableOnBehalfExternalLinkAction, addDeliverableOnBehalfCreatorNoteAction, submitDeliverableOnBehalfPublicationAction } from '@/features/campaigns/actions/deliverable-on-behalf-actions';
import { putDeliverableAssetToSignedUrl } from '@/features/campaigns/deliverable-asset-upload';
import { defaultDeliverableAssetType, resolveDeliverableUploadMime, type DocumentationUnitDetail } from '@/lib/services/deliverables/documentation-types';
import { DeliverableAssetPreview } from './deliverable-asset-preview';
import { DocumentationUnitScriptSheet } from '@/features/campaigns/components/script/documentation-unit-script-sheet';
import type { ContentReviewDates } from '@/lib/services/deliverables/content-review-schedule';
const STATUS = { missing: 'Missing', uploaded: 'Uploaded', review: 'With client', approved: 'Approved' };
const EMPTY: PanelSnapshot = { assets: [], metadata: {}, scripts: [] };
function date(value: string | null) { return value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : 'not set'; }
function creator(row: PanelRow) { return row.creatorName || 'Unassigned creator'; }
function Avatar({ row }: { row: PanelRow }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [row.creatorAvatarUrl]);
    return row.creatorAvatarUrl && !failed
        ? <CreatorAvatarImage avatarUrl={row.creatorAvatarUrl} alt={creator(row)} size="xs" sizeClassName="dv-creator-avatar" onFailed={() => setFailed(true)}/>
        : <span className="tw-av" aria-label={creator(row)}>{creator(row).replace(/^@/, '').slice(0, 2).toUpperCase()}</span>;
}
function Mark({ platform }: { platform: string | null }) {
    return platform ? <PlatformIcon platform={platform} size="xs" variant="logo" className="dv-platform-logo"/> : <span aria-label="Platform not set">—</span>;
}
function Pill({ status }: {
    status: PanelStatus;
}) { return <span className={`tw-p ${status === 'missing' ? 'p-y' : status === 'approved' ? 'p-g' : 'p-b'}`}>{STATUS[status]}</span>; }
export function DeliverablesPanel({ workspace, assignmentHierarchy, active: panelActive = true, initialUpload = false, initialDeliverableId, initialPostScheduleId }: {
    workspace: CampaignWorkspace;
    assignmentHierarchy: AssignmentHierarchy;
    active?: boolean;
    initialUpload?: boolean;
    initialDeliverableId?: string | null;
    initialPostScheduleId?: string | null;
}) {
    const units = useMemo(() => buildDocumentationUnitsFromHierarchy(assignmentHierarchy, workspace.id, new Map()), [assignmentHierarchy, workspace.id]);
    const [snapshot, setSnapshot] = useState<PanelSnapshot>(EMPTY);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'sch' | 'up'>(initialUpload ? 'up' : 'sch');
    const [filter, setFilter] = useState<PanelStatus | 'all'>('all');
    const [uploadStatus,setUploadStatus] = useState<VersionStatus>('draft');
    const [query, setQuery] = useState('');
    const [closed, setClosed] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [current, setCurrent] = useState<string | null>(null);
    const [min, setMin] = useState(false);
    const [actingAsCreator, setActingAsCreator] = useState(false);
    const [script, setScript] = useState<PanelRow | null>(null);
    const [sort, setSort] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<CardUploadProgress | null>(null);
    const [bulkDate, setBulkDate] = useState<string | null>(null);
    const root = useRef<HTMLDivElement>(null);
    const sheet = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLElement | null>(null);
    const request = useRef(0);
    const busyRef = useRef(false);
    const rows = useMemo(() => { const result = buildPanelRows(units, snapshot); return sort ? result.sort((a, b) => creator(a).localeCompare(creator(b)) || a.label.localeCompare(b.label)) : result; }, [units, snapshot, sort]);
    // Filtered count, visibility, collapse classes and ARIA state are render output.
    // Never port the fragment's imperative apply() into a mount effect.
    const visible = useMemo(() => filterPanelRows(rows, filter, query), [rows, filter, query]);
    const groups = useMemo(() => Array.from(new Set(rows.map(r => r.creatorId ?? r.assignmentLineId))).map(id => ({ id, rows: rows.filter(r => (r.creatorId ?? r.assignmentLineId) === id), visible: visible.filter(r => (r.creatorId ?? r.assignmentLineId) === id) })), [rows, visible]);
    const counts = Object.fromEntries(['missing', 'uploaded', 'review', 'approved'].map(status => [status, rows.filter(r => r.status === status).length]));
    const active = rows.find(r => r.unitKey === current) ?? null;
    const index = active ? rows.indexOf(active) : -1;
    const refresh = useCallback(async () => {
        const id = ++request.current;
        try {
            const result = await getDeliverablesPanelSnapshotAction({ campaignHeaderId: workspace.id });
            if (id !== request.current)
                return;
            if (!result.ok) {
                setError(result.message);
                return;
            }
            setSnapshot(result.data);
            setLoaded(true);
            setError(null);
        }
        catch {
            if (id === request.current)
                setError('Could not load content status. Retry to see the current files and review dates.');
        }
    }, [workspace.id]);
    useEffect(() => { setLoaded(false); setSnapshot(EMPTY); setSelected(new Set()); setCurrent(null); setScript(null); setClosed(new Set()); void refresh(); return () => { request.current++; }; }, [refresh]);
    useEffect(() => { if (initialDeliverableId) {
        const row = units.find(u => u.assignmentDeliverableId === initialDeliverableId && (!initialPostScheduleId || u.assignmentPostScheduleId === initialPostScheduleId));
        if (row)
            setCurrent(row.unitKey);
    } }, [initialDeliverableId, initialPostScheduleId, units]);
    const close = useCallback(() => { setCurrent(null); setScript(null); setMin(false); requestAnimationFrame(() => trigger.current?.focus()); }, []);
    useEffect(() => { if (!panelActive)
        close(); }, [panelActive, close]);
    function open(row: PanelRow, element?: HTMLElement) { trigger.current = element ?? document.activeElement as HTMLElement; setCurrent(row.unitKey); setMin(false); }
    useEffect(() => { if (!active)
        return; const old = document.body.style.paddingBottom; document.body.style.paddingBottom = min ? '84px' : '52vh'; return () => { document.body.style.paddingBottom = old; }; }, [active?.unitKey, min]);
    useEffect(() => { if (active && !script)
        sheet.current?.querySelector<HTMLElement>('.sh__t')?.focus(); }, [active?.unitKey, script]);
    useEffect(() => {
        const key = (event: KeyboardEvent) => {
            if (script)
                return;
            if (event.key === 'Escape') {
                if (current) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    close();
                }
                else if (selected.size) {
                    event.preventDefault();
                    setSelected(new Set());
                }
                return;
            }
            if (event.key === 'Tab' && current && sheet.current) {
                const focusable = Array.from(sheet.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')).filter(el => el.getClientRects().length > 0);
                const first = focusable[0], last = focusable.at(-1);
                if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement as HTMLElement))) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && (document.activeElement === last || !sheet.current.contains(document.activeElement))) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', key, true);
        return () => document.removeEventListener('keydown', key, true);
    }, [current, selected.size, script, close]);
    async function reuseVideo(row: PanelRow, sourceVersionId: string): Promise<boolean> {
        if (busyRef.current) return false;
        busyRef.current = true; setBusy(true);
        try {
            const result = await reuseDeliverablesPanelVideoAction({ campaignHeaderId: workspace.id, targetUnitKey: row.unitKey, sourceVersionId });
            if (!result.ok) throw new Error(result.message);
            toast.success('Video linked and visible to the client.');
            await refresh(); return true;
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not link the video.'); return false; }
        finally { busyRef.current = false; setBusy(false); }
    }
    async function upload(row: PanelRow, file: File) {
        if (busyRef.current)
            return;
        busyRef.current = true;
        setBusy(true);
        setProgress({ unitKey: row.unitKey, fileName: file.name, phase: 'preparing', loaded: 0, total: file.size });
        try {
            if (row.quantity > 1 && !row.assignmentPostScheduleId)
                throw new Error('Create individual post slots in Assignments before uploading to this deliverable.');
            const mimeType = resolveDeliverableUploadMime({ browserType: file.type, fileName: file.name, header: new Uint8Array(await file.slice(0, 32).arrayBuffer()) });
            const input = { campaignHeaderId: workspace.id, assignmentDeliverableId: row.assignmentDeliverableId, assignmentPostScheduleId: row.assignmentPostScheduleId, assetType: defaultDeliverableAssetType(row.deliverableType), fileName: file.name, fileSize: file.size, mimeType, assetId: row.file?.assetId ?? snapshot.assets.find(a=>a.deliverableId === row.assignmentDeliverableId && a.postId === row.assignmentPostScheduleId && a.medium === 'file')?.assetId };
            const validation = validatePanelUpload(input);
            if (validation)
                throw new Error(validation);
            const start = await beginDeliverablesPanelUploadAction(input);
            if (!start.ok)
                throw new Error(start.message);
            const sent = await putDeliverableAssetToSignedUrl({ ...start.data, file, mimeType, onProgress: p => setProgress({ unitKey: row.unitKey, fileName: file.name, phase: 'uploading', loaded: p.loaded, total: p.total }) });
            if (!sent.ok)
                throw new Error(sent.message);
            setProgress({ unitKey: row.unitKey, fileName: file.name, phase: 'finishing', loaded: file.size, total: file.size });
            const finish = await completeDeliverablesPanelUploadAction({ ...input, ...start.data, actingAsCreator: row.unitKey === current && actingAsCreator, productionStatus:uploadStatus });
            if (!finish.ok)
                throw new Error(finish.message);
            toast.success('Version uploaded and visible to the client.');
            await refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : 'Upload failed. Please retry.');
        }
        finally {
            busyRef.current = false;
            setBusy(false);
            setProgress(null);
        }
    }
    // Uploads are client-visible; visibility is managed per version.
    const allClosed = groups.filter(g => g.visible.length).every(g => closed.has(g.id));
    return <div className="tw-c dv" ref={root}>
    <div className="tw-ch"><span className="tw-ct">Deliverables</span><span className="tw-cs">{rows.length} of {rows.length} · synced from assignments</span><span className="tw-sp"/><span className="tw-p p-y">{loaded ? counts.missing : '—'} need a file</span><button className="tw-b sm" aria-pressed={sort} onClick={() => setSort(!sort)}>Sort by creator</button></div>
    <div className="tw-ms2">{[['Deliverables', rows.length], ['Need a file', loaded ? counts.missing : '—'], ['Uploaded', loaded ? counts.uploaded : '—'], ['With client', loaded ? counts.review : '—'], ['Approved', loaded ? counts.approved : '—'], ['No review date', loaded ? rows.filter(r => !r.reviewDate).length : '—']].map(([label, value]) => <div key={label}><i>{label}</i><b>{value}</b></div>)}</div>
    <div className="tw-ch dv__tabs"><span className="tw-seg" id="dvTabs">{(['sch', 'up'] as const).map(t => <button key={t} data-t={t} aria-pressed={tab === t} onClick={() => { close(); setTab(t); }}>{t === 'sch' ? 'Schedule' : 'Content & uploads'}{t === 'up' && loaded && <em>{counts.missing}</em>}</button>)}</span><span className="tw-sp"/><span className="tw-cs" id="dvHint">{tab === 'sch' ? 'Every deliverable, its date and status' : 'Filter, then drop a file straight onto any deliverable'}</span></div>
    {error && <p role="alert" style={{ padding: 15 }}>{error} <button className="tw-b sm" onClick={() => void refresh()}>Retry</button></p>}
    {!loaded && !error && <p role="status" style={{ padding: 15 }}>Loading saved files and review dates…</p>}

    <section data-p="sch" hidden={tab !== 'sch'} aria-label="Deliverables schedule"><div className="tw-sc"><div style={{ minWidth: 1030, '--cols': DELIVERABLE_COLUMNS } as CSSProperties}>
      <div className="tw-g tw-hr"><span>Deliverable</span><span>Type</span><span>Creator</span><span>Platform</span><span>Client review</span><span>Status</span><span>Ver</span><span></span></div>
      {rows.map(row => <div className={`tw-g tw-r ${loaded && row.status === 'missing' ? 'wrn' : ''}`} key={row.unitKey}>
        <span className="nm"><Mark platform={row.platform}/><b title={row.label}>{row.label}</b></span><span><span className="tw-p p-n">{row.deliverableType?.replaceAll('_', ' ') || '—'}</span></span><span className="tw-cr"><Avatar row={row}/><span style={{ minWidth: 0 }}><b>{creator(row)}</b></span></span><span className="tw-t">{row.platform || '—'}</span><span className={row.reviewDate ? 'tw-t' : 'tw-miss'} style={{ fontFamily: 'var(--font-geist-mono), monospace' }}>{loaded ? date(row.reviewDate) : '—'}</span><span>{loaded ? <Pill status={row.status}/> : <span>—</span>}</span><span className="tw-t">{row.file?.version ? `v${row.file.version}` : '—'}</span><span style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="tw-b sm" data-go={row.unitKey} onClick={e => open(row, e.currentTarget)}>{loaded && row.status === 'missing' ? 'Upload' : 'Open'}</button></span>
      </div>)}
      <div className="tw-g tw-ft"><span>{rows.length} deliverables</span><span></span><span>{groups.length} creators</span><span></span><span>{loaded ? rows.filter(r => !r.reviewDate).length : '—'} without a date</span><span>{loaded ? counts.missing : '—'} missing</span><span></span><span></span></div>
    </div></div>{!rows.length && <p style={{ padding: 20 }}>No deliverables assigned yet. Add creator deliverables in Assignments to build this schedule.</p>}</section>
    <section data-p="up" hidden={tab !== 'up'} aria-label="Content and uploads"><div className="pad2"><label className="tw-lbl" htmlFor="dv-upload-status">Status for the next upload</label><select className="tw-in" id="dv-upload-status" value={uploadStatus} onChange={e=>setUploadStatus(e.target.value as VersionStatus)}>{VERSION_STATUSES.map(s=><option key={s} value={s}>{VERSION_STATUS_LABELS[s]}</option>)}</select><p className="tw-hint">All uploads, including drafts, are visible to the client. Open Play / versions to rename, change status, hide or remove a version.</p></div><div className="bar"><span className="dv__lbl">Show</span>{(['missing', 'uploaded', 'review', 'approved', 'all'] as const).map(f => <button key={f} data-f={f} aria-pressed={filter === f} className={`ch ${f === 'missing' ? 'ch-y' : f === 'approved' ? 'ch-g' : f === 'all' ? '' : 'ch-b'} ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'missing' ? 'Need a file' : STATUS[f]} <em>{loaded ? (f === 'all' ? rows.length : counts[f]) : '—'}</em></button>)}<span className="tw-sp"/><input className="tw-in" id="dvFind" aria-label="Find creator or deliverable" placeholder="Find creator or deliverable" value={query} onChange={e => setQuery(e.target.value)} style={{ width: 210, height: 28 }}/><button className="tw-b sm" id="dvAll" onClick={() => setClosed(allClosed ? new Set() : new Set(groups.filter(g => g.visible.length).map(g => g.id)))}>{allClosed ? 'Expand all' : 'Collapse all'}</button></div>
      <p className="bar__n" id="dvCount" aria-live="polite">{loaded ? `${visible.length} deliverable${visible.length === 1 ? '' : 's'} across ${groups.filter(g => g.visible.length).length} creator${groups.filter(g => g.visible.length).length === 1 ? '' : 's'}${filter === 'all' ? '' : ' · filtered'}` : 'Loading current content status…'}</p>
      {loaded && groups.map(g => <section className={`gp ${closed.has(g.id) || !g.visible.length ? 'is-shut' : ''}`} hidden={!g.visible.length} data-gp={g.id} data-need={g.rows.filter(r => r.status === 'missing').length} key={g.id}>
        <button className="gp__h" aria-expanded={Boolean(g.visible.length) && !closed.has(g.id)} onClick={() => setClosed(old => { const next = new Set(old); next.has(g.id) ? next.delete(g.id) : next.add(g.id); return next; })}><s className="gp__x" aria-hidden="true"/><Avatar row={g.rows[0]}/><b>{creator(g.rows[0])}</b><span className="gp__d" aria-hidden="true"><s className={g.rows.some(r => r.status === 'missing') ? 'on' : ''}/></span><span className="gp__c">{g.visible.length} visible of {g.rows.length}</span><span className="tw-sp"/><span className="tw-p p-y">{g.rows.filter(r => r.status === 'missing').length} need a file</span></button>
        <div className="gp__b"><div className="slots">{g.visible.map(row => <article className={`sl ${row.status === 'missing' ? 'e-wrn' : row.status === 'approved' ? 'e-ok' : 'e-blue'} ${selected.has(row.unitKey) ? 'is-sel' : ''}`} key={row.unitKey} data-card={row.unitKey} data-go={row.unitKey} data-st={row.status} data-c={creator(row)} onClick={e => { if ((e.target as HTMLElement).closest('input,button,a,.dz'))
                return; open(row, e.currentTarget); }} tabIndex={0} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                open(row, e.currentTarget);
            } }} aria-label={`Open ${creator(row)} ${row.label}`}>
          <div className="sl__h"><input type="checkbox" className="tw-ck sl__k" aria-label={`Select ${creator(row)} ${row.label}`} checked={selected.has(row.unitKey)} onClick={e => e.stopPropagation()} onChange={() => setSelected(old => { const next = new Set(old); next.has(row.unitKey) ? next.delete(row.unitKey) : next.add(row.unitKey); return next; })}/><Mark platform={row.platform}/><span className="sl__t"><b>{row.label}</b><u>{creator(row)}</u></span><span className="tw-sp"/><Pill status={row.status}/></div>
          {progress?.unitKey === row.unitKey ? <DeliverableUploadProgress progress={progress}/> : row.file ? <div className="pv"><span className="pv__t" aria-hidden="true"><s /></span><div className="pv__m"><b>{row.file.fileName || 'Content link'}</b><u>v{row.file.version} · {row.file.size ? `${(row.file.size / 1024 / 1024).toFixed(1)} MB · ` : ''}{date(row.file.uploadedAt)}</u><div className="pv__a"><button className="tw-b sm" onClick={e => open(row, e.currentTarget)}>Open / add version</button></div></div></div> : <DropZone disabled={busy} onFile={file => void upload(row, file)}/>}
          <ReuseDeliverableVideo row={row} rows={rows} busy={busy} onLink={versionId => reuseVideo(row, versionId)}/>
          <div className="pad2"><InlineVersions row={row} refresh={refresh}/></div><div className="sl__f">{[['Script', row.hasScript ? 'Yes' : null], ['Caption', row.caption ? 'Yes' : null], ['Review', row.reviewDate ? date(row.reviewDate) : null]].map(([label, value]) => <div className={`fl ${value ? 'is-on' : ''}`} key={label}><i>{label}</i>{value ? <b>{value}</b> : <em>{label === 'Review' ? 'not set' : '—'}</em>}</div>)}</div><div className="sl__b"><span className="sl__s">{row.file?.decision === 'changes_requested' ? 'Changes requested — upload a revision' : row.status === 'missing' ? 'No file yet' : row.status === 'uploaded' ? 'Not sent to the client' : row.status === 'review' ? 'Awaiting client approval' : 'Approved by client'}</span><span className="tw-sp"/><button className="tw-b sm" onClick={e => open(row, e.currentTarget)}>Open</button></div>
        </article>)}</div></div>
      </section>)}
      {loaded && !visible.length && <p style={{ padding: 20 }}>No deliverables match this filter. Choose All or clear the search to see other content.</p>}
    </section>
    <div className="tw-selbar" id="dvBar" hidden={!selected.size || Boolean(active) || tab !== 'up'}><span className="n"><b id="dvN">{selected.size}</b> selected <button className="x" id="dvX" aria-label="Clear selection" onClick={() => setSelected(new Set())}>✕</button></span><span className="sum"><span><i>Need a file</i><b id="dvNeed">{rows.filter(r => selected.has(r.unitKey) && r.status === 'missing').length}</b></span><span><i>Uploaded / changes requested</i><b className="g" id="dvRdy">{rows.filter(r => selected.has(r.unitKey) && r.status === 'uploaded').length}</b></span></span><span className="acts">{bulkDate !== null && <input type="date" className="tw-in" aria-label="Selected deliverables review date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}/>}<button className="tw-b sm" disabled={busy} onClick={async () => { if (bulkDate === null) {
        setBulkDate('');
        return;
    } setBusy(true); try {
        for (const row of rows.filter(r => selected.has(r.unitKey))) {
            const previous = await getContentReviewDatesAction(row);
            if (!previous.ok)
                throw new Error(previous.message);
            const saved = await saveContentReviewDatesAction({ ...row, previous: previous.data, dates: { ...previous.data, draft: bulkDate || null } });
            if (!saved.ok)
                throw new Error(saved.message);
        }
        setBulkDate(null);
        await refresh();
        toast.success('Review dates saved.');
    }
    catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save dates.');
        await refresh();
    }
    finally {
        setBusy(false);
    } }}>{bulkDate === null ? 'Set review date' : 'Save dates'}</button></span></div>
    <div className="sh__scrim" data-scrim hidden={!active || Boolean(script)} onClick={close}/>
    <div className={`sh ${min ? 'is-min' : ''}`} hidden={!active || Boolean(script)} ref={sheet} role="dialog" aria-modal="true" aria-labelledby="deliverable-sheet-title">
      {active && <><div className="sh__h"><s className="sh__grip" aria-hidden="true"/><button className="tw-b sm" data-back aria-label="Back to deliverables" onClick={close}>← Back</button><Mark platform={active.platform}/><Avatar row={active}/><span className="sh__t" id="deliverable-sheet-title" tabIndex={-1}><b>{active.label}</b><u>{creator(active)} · {active.deliverableType?.replaceAll('_', ' ')}</u></span><Pill status={active.status}/><span className="tw-sp"/><span className="sh__nav"><button className="tw-b sm" aria-label="Previous deliverable" disabled={index <= 0} onClick={() => { setCurrent(rows[index - 1].unitKey); setMin(false); }}>‹</button><em>{index + 1} of {rows.length}</em><button className="tw-b sm" aria-label="Next deliverable" disabled={index >= rows.length - 1} onClick={() => { setCurrent(rows[index + 1].unitKey); setMin(false); }}>›</button></span><span className="act"><i>Acting as</i><span className="tw-seg"><button aria-pressed={!actingAsCreator} onClick={() => setActingAsCreator(false)}>Thinkway</button><button disabled={!active.creatorId} aria-pressed={actingAsCreator} onClick={() => setActingAsCreator(true)}>{creator(active)}</button></span></span><button className="tw-b sm" data-min aria-expanded={!min} onClick={() => setMin(!min)}>{min ? 'Expand' : 'Minimise'}</button><button className="tw-b sm" aria-label="Dismiss deliverable" onClick={close}>✕</button></div>
      <PanelEditor progress={progress?.unitKey === active.unitKey ? progress : null} uploadStatus={uploadStatus} setUploadStatus={setUploadStatus} key={active.unitKey} actingAsCreator={actingAsCreator} row={active} busy={busy} upload={file => void upload(active, file)} onScript={() => setScript(active)} refresh={refresh}/></>}
    </div>
    <DocumentationUnitScriptSheet open={Boolean(script)} onOpenChange={value => { if (!value)
        setScript(null); }} unit={script} campaignId={workspace.id} intent="edit" onPresenceChange={() => void refresh()}/>
  </div>;
}
function DropZone({ onFile, disabled }: {
    onFile: (file: File) => void;
    disabled: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [over, setOver] = useState(false);
    return <div className={`dz ${over ? 'is-over' : ''}`} onClick={e => { e.stopPropagation(); if (!disabled && e.target !== input.current)
        input.current?.click(); }} onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (!disabled)
        setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); if (!disabled && e.dataTransfer.files[0])
        onFile(e.dataTransfer.files[0]); }}><s className="dz__i" aria-hidden="true"/><b>Drop the video here</b><u>or <button type="button" className="lk" disabled={disabled} onClick={e => { e.stopPropagation(); input.current?.click(); }}>browse</button> · MP4 MOV WEBM JPG PNG PDF · up to 150 MB</u><input type="file" ref={input} hidden accept={PANEL_UPLOAD_ACCEPT} disabled={disabled} onClick={e => e.stopPropagation()} onChange={e => { const file = e.target.files?.[0]; if (file)
        onFile(file); e.target.value = ''; }}/></div>;
}
function PanelEditor({ row, actingAsCreator, busy, upload, onScript, refresh, uploadStatus, setUploadStatus, progress }: {
    progress: CardUploadProgress | null;
    uploadStatus: VersionStatus;
    setUploadStatus: (status:VersionStatus)=>void;
    row: PanelRow;
    actingAsCreator: boolean;
    busy: boolean;
    upload: (file: File) => void;
    onScript: () => void;
    refresh: () => Promise<void>;
}) {
    const [detail, setDetail] = useState<DocumentationUnitDetail | null>(null);
    const [dates, setDates] = useState<ContentReviewDates | null>(null);
    const [review, setReview] = useState(row.reviewDate ?? '');
    const [caption, setCaption] = useState('');
    const [external, setExternal] = useState('');
    const [publication, setPublication] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reload, setReload] = useState(0);
    useEffect(() => { let ignore = false; void Promise.all([getDeliverableDocumentationDetailAction(row), getContentReviewDatesAction(row)]).then(([d, r]) => { if (ignore)
        return; if (!d.ok || !r.ok) {
        setError(!d.ok ? d.message : !r.ok ? r.message : 'Could not load details.');
        return;
    } setDetail(d.data); setDates(r.data); setReview(r.data.draft ?? ''); }).catch(() => { if (!ignore)
        setError('Could not load details. Retry before saving.'); }); return () => { ignore = true; }; }, [row.unitKey, row.file?.versionId, reload]);
    async function save() {
        setSaving(true);
        setError(null);
        try {
            if (!dates)
                throw new Error('Wait for the saved dates to load.');
            if (review !== (dates.draft ?? '')) {
                const r = await saveContentReviewDatesAction({ ...row, dates: { ...dates, draft: review || null }, previous: dates });
                if (!r.ok)
                    throw new Error(r.message);
                setDates(r.data);
            }
            if (caption.trim()) {
                const r = await (actingAsCreator ? addDeliverableOnBehalfTextAction : addDeliverableTextAssetAction)({ ...row, assetType: 'caption', textBody: caption });
                if (!r.ok)
                    throw new Error(r.message);
                setCaption('');
            }
            if (external.trim()) {
                const r = await (actingAsCreator ? addDeliverableOnBehalfExternalLinkAction : addDeliverableExternalLinkAction)({ ...row, assetType: defaultDeliverableAssetType(row.deliverableType), externalUrl: external, deferRelease: false });
                if (!r.ok)
                    throw new Error(r.message);
                setExternal('');
            }
            if (note.trim()) {
                const r = await addDeliverableOnBehalfCreatorNoteAction({ ...row, body: note });
                if (!r.ok)
                    throw new Error(r.message);
                setNote('');
            }
            if (publication.trim()) {
                const r = await submitDeliverableOnBehalfPublicationAction({ ...row, contentUrl: publication, platform: row.platform ?? '', deliverableType: row.deliverableType ?? '' });
                if (!r.ok)
                    throw new Error(r.message);
                setPublication('');
            }
            await refresh();
            setReload(n => n + 1);
            toast.success('Deliverable saved.');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save.');
            await refresh();
        }
        finally {
            setSaving(false);
        }
    }
    return <><div className="sh__b"><div className="sh__col"><section className="bl"><div className="bl__h"><s className="n n1">1</s>The file<span className="tw-sp"/><span className="tw-cs">{row.file?.releasedAt ? 'Shared with client' : 'Not sent to the client'}</span></div>
      {detail?.assets.filter(a => a.medium === 'file' || a.medium === 'external_link').map(asset => <div key={asset.id}>{asset.versions.map(version => <VersionManager key={version.id + version.fileName + version.status + version.hidden + version.removed} row={row} asset={asset} version={version} onSaved={async()=>{await refresh();setReload(n=>n+1);}}/>)}</div>)}<label className="tw-lbl" htmlFor="dv-sheet-upload-status">New version status</label><select className="tw-in" id="dv-sheet-upload-status" value={uploadStatus} onChange={e=>setUploadStatus(e.target.value as VersionStatus)}>{VERSION_STATUSES.map(s=><option key={s} value={s}>{VERSION_STATUS_LABELS[s]}</option>)}</select><p className="tw-hint">New versions are visible to the client immediately.</p>{progress ? <DeliverableUploadProgress progress={progress}/> : <DropZone disabled={busy || saving} onFile={upload}/>}</section>
      <section className="bl"><div className="bl__h"><s className="n n2">2</s>Script & caption</div><div className="pad2"><div className="fw"><span className="tw-lbl">Script</span><button className="tw-b sm" onClick={onScript}>{row.hasScript ? 'View / edit script' : 'Add script'}</button></div><div className="fw" style={{ marginTop: 11 }}><label className="tw-lbl" htmlFor="dv-caption">Caption / copy</label>{row.caption && <p>{row.caption}</p>}<textarea className="tw-in ta" id="dv-caption" rows={3} placeholder="Add caption as published…" value={caption} onChange={e => setCaption(e.target.value)}/><p className="tw-hint">A caption alone does not mark the deliverable received — only a file or link does.</p></div></div></section></div>
      <div className="sh__col"><section className="bl"><div className="bl__h"><s className="n n3">3</s>Dates</div><div className="pad2"><div className="fw"><label className="tw-lbl" htmlFor="dv-review">Expected with client for review</label><input className="tw-in" id="dv-review" type="date" value={review} disabled={!dates || saving} onChange={e => setReview(e.target.value)}/><p className="tw-hint">Appears in the client's review calendar.</p></div><div className="fw" style={{ marginTop: 11 }}><label className="tw-lbl" htmlFor="dv-live">Go-live date</label><input className="tw-in" id="dv-live" type="date" value={row.dueDate?.slice(0, 10) ?? ''} readOnly/><p className="tw-hint">Set on the publication plan — shown here so both read together.</p></div></div></section>
      <section className="bl"><div className="bl__h"><s className="n n4">4</s>Links & activity</div><div className="pad2"><label className="tw-lbl" htmlFor="dv-external">External link</label><input className="tw-in" id="dv-external" placeholder="https://drive.google.com/…" value={external} onChange={e => setExternal(e.target.value)}/><div className="fw" style={{ marginTop: 11 }}><label className="tw-lbl" htmlFor="dv-publication">Publication URL</label><input className="tw-in" id="dv-publication" placeholder="https://instagram.com/p/…" value={publication} onChange={e => setPublication(e.target.value)}/></div><div className="fw" style={{ marginTop: 11 }}><label className="tw-lbl" htmlFor="dv-note">Note to creator</label><textarea className="tw-in ta" id="dv-note" rows={2} placeholder="Visible in Creator Workspace…" value={note} onChange={e => setNote(e.target.value)}/></div>{detail?.comments.slice(0, 5).map(c => <p key={c.id}>{c.body}</p>)}</div></section></div></div>
    {error && <p role="alert" style={{ padding: '0 16px' }}>{error} <button className="tw-b sm" onClick={() => setReload(n => n + 1)}>Reload</button></p>}
    <div className="sh__f"><span className="tw-cs">Uploads are visible to the client. Manage visibility on each version.</span><span className="tw-sp"/><button className="tw-b" disabled={busy || saving || !dates} onClick={() => void save()}>{saving ? 'Saving…' : 'Save'}</button></div></>;
}
