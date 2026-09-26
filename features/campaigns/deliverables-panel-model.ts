import type { DocumentationUnitSummary } from '@/lib/services/deliverables/documentation-types';
import { readContentReviewDates } from '@/lib/services/deliverables/content-review-schedule';
export const DELIVERABLE_COLUMNS = 'minmax(190px,.75fr) minmax(84px,.85fr) minmax(128px,1.1fr) minmax(86px,.85fr) minmax(100px,1fr) minmax(108px,1.05fr) 56px minmax(118px,1.4fr)';
export type PanelStatus = 'missing' | 'uploaded' | 'review' | 'approved';
export type PanelAsset = {
    deliverableId: string;
    postId: string | null;
    assetId: string;
    type: string;
    medium: string;
    versionId: string | null;
    version: number | null;
    fileName: string | null;
    size: number | null;
    mime: string | null;
    uploadedAt: string | null;
    releasedAt: string | null;
    hasContent: boolean;
    text: string | null;
    decision: string | null;
};
export type PanelSnapshot = {
    assets: PanelAsset[];
    metadata: Record<string, unknown>;
    scripts: string[];
};
export type PanelRow = DocumentationUnitSummary & {
    status: PanelStatus;
    hasScript: boolean;
    caption: string | null;
    reviewDate: string | null;
    file: PanelAsset | null;
};
export function buildPanelRows(units: DocumentationUnitSummary[], snapshot: PanelSnapshot): PanelRow[] {
    return units.map(unit => {
        const assets = snapshot.assets.filter(a => !(unit.quantity > 1 && !unit.assignmentPostScheduleId) && a.deliverableId === unit.assignmentDeliverableId &&
            (a.postId === unit.assignmentPostScheduleId || (unit.quantity === 1 && a.postId === null)));
        const content = assets.filter(a => a.hasContent && a.type !== 'caption' && a.type !== 'brief')
            .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));
        const file = content[0] ?? null;
        const status: PanelStatus = !file ? 'missing' : file.decision === 'approved' ? 'approved' :
            file.releasedAt && file.decision !== 'changes_requested' ? 'review' : 'uploaded';
        return { ...unit, status, file,
            hasScript: snapshot.scripts.includes(unit.unitKey),
            caption: assets.find(a => a.type === 'caption')?.text ?? null,
            reviewDate: readContentReviewDates(snapshot.metadata[unit.assignmentDeliverableId] as Record<string, unknown> | null | undefined, unit.quantity > 1 ? unit.sequenceNumber : null).draft,
        };
    });
}
export function filterPanelRows(rows: PanelRow[], filter: PanelStatus | 'all', search: string) {
    const query = search.trim().toLowerCase();
    return rows.filter(r => (filter === 'all' || r.status === filter) &&
        (!query || `${r.creatorName ?? ''} ${r.label} ${r.platform ?? ''} ${r.file?.fileName ?? ''}`.toLowerCase().includes(query)));
}
export const PANEL_UPLOAD_ACCEPT = '.mp4,.m4v,.mov,.webm,.jpg,.jpeg,.png,.webp,.pdf';
export function validatePanelUpload(file: {
    fileName: string;
    fileSize: number;
    mimeType: string;
}) {
    const types: Record<string, string[]> = { mp4: ['video/mp4'], m4v: ['video/mp4', 'video/x-m4v'], mov: ['video/quicktime'], webm: ['video/webm'], jpg: ['image/jpeg'], jpeg: ['image/jpeg'], png: ['image/png'], webp: ['image/webp'], pdf: ['application/pdf'] };
    const extension = file.fileName.split('.').pop()?.toLowerCase() ?? '';
    if (!types[extension]?.includes(file.mimeType))
        return 'Choose an MP4, M4V, MOV, WEBM, JPG, PNG, WEBP or PDF file.';
    if (!Number.isFinite(file.fileSize) || file.fileSize <= 0 || file.fileSize > 150 * 1024 * 1024)
        return 'Choose a non-empty file up to 150 MB.';
    return null;
}
