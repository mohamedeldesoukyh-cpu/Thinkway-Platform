import type { DocumentationUnitSummary } from './documentation-types';

export function isMirroredDeliverable(unit: Pick<DocumentationUnitSummary, 'deliverableType'>): boolean {
  return /(^|[\s_-])mirrored([\s_-]|$)/i.test(unit.deliverableType ?? '');
}
export function canReuseCreatorVideo(target: DocumentationUnitSummary, source: DocumentationUnitSummary): boolean {
  return isMirroredDeliverable(target) && Boolean(target.creatorId) && target.creatorId === source.creatorId &&
    target.campaignHeaderId === source.campaignHeaderId && target.unitKey !== source.unitKey &&
    !(target.quantity > 1 && !target.assignmentPostScheduleId);
}
