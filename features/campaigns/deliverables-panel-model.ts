import type { DocumentationUnitSummary } from '@/lib/services/deliverables/documentation-types';
import { readContentReviewDates, contentReviewDateUpdatedAt } from '@/lib/services/deliverables/content-review-schedule';
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
    scriptDocuments?: Record<string, { originalFileName: string | null; originalMimeType: string | null; hasOriginalDocument: boolean }>;
};
export type PanelRow = DocumentationUnitSummary & {
    status: PanelStatus;
    hasScript: boolean;
    scriptDocument?: NonNullable<PanelSnapshot["scriptDocuments"]>[string];
    caption: string | null;
    reviewDate: string | null;
    reviewDateUpdatedAt?: string;
    scriptSource?: DocumentationUnitSummary;
    packagePlatforms?: string;
    file: PanelAsset | null;
};
export function buildPanelRows(units: DocumentationUnitSummary[], snapshot: PanelSnapshot): PanelRow[] {
    const individual = units.map(unit => {
        const assets = snapshot.assets.filter(a => !(unit.quantity > 1 && !unit.assignmentPostScheduleId) && a.deliverableId === unit.assignmentDeliverableId &&
            (a.postId === unit.assignmentPostScheduleId || (unit.quantity === 1 && a.postId === null)));
        const content = assets.filter(a => a.hasContent && a.type !== 'caption' && a.type !== 'brief')
            .sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''));
        const file = content[0] ?? null;
        const status: PanelStatus = !file ? 'missing' : file.decision === 'approved' ? 'approved' :
            file.releasedAt && file.decision !== 'changes_requested' ? 'review' : 'uploaded';
        return { ...unit, status, file,
            hasScript: snapshot.scripts.includes(unit.unitKey),
            scriptDocument: snapshot.scriptDocuments?.[unit.unitKey],
            caption: assets.find(a => a.type === 'caption')?.text ?? null,
            reviewDateUpdatedAt: contentReviewDateUpdatedAt(snapshot.metadata[unit.assignmentDeliverableId], unit.quantity > 1 ? unit.sequenceNumber : null),
            reviewDate: readContentReviewDates(snapshot.metadata[unit.assignmentDeliverableId] as Record<string, unknown> | null | undefined, unit.quantity > 1 ? unit.sequenceNumber : null).draft,
        };
    });
    const groups = new Map<string, PanelRow[]>();
    for (const row of individual) { const key = row.reviewGroupKey ?? row.unitKey; groups.set(key, [...(groups.get(key) ?? []), row]); }
    return [...groups.values()].map(members => {
        if (!members[0].reviewGroupKey) return members[0];
        // Keep existing uploads editable, including content previously saved on a component.
        const row = [...members].sort((a,b) => (b.file?.uploadedAt ?? '').localeCompare(a.file?.uploadedAt ?? ''))[0];
        const dated = [...members].sort((a,b) => (b.reviewDateUpdatedAt ?? '').localeCompare(a.reviewDateUpdatedAt ?? ''));
        const reviewDate = dated[0].reviewDateUpdatedAt ? dated[0].reviewDate : members.find(item => item.reviewDate)?.reviewDate ?? null;
        return { ...row, label: row.reviewGroupLabel ?? row.label, hasScript: members.some(item => item.hasScript), scriptSource: members.find(item => item.scriptDocument?.hasOriginalDocument) ?? members.find(item => item.hasScript), scriptDocument: members.find(item => item.scriptDocument?.hasOriginalDocument)?.scriptDocument ?? members.find(item => item.hasScript)?.scriptDocument, packagePlatforms: [...new Set(members.map(item => item.platform).filter(Boolean))].join(" + "), caption: row.caption ?? members.find(item => item.caption)?.caption ?? null, reviewDate };
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
