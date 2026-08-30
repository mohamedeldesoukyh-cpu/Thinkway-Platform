import { documentationUnitKey } from "@/lib/services/deliverables/documentation-types";
import { deliverableTypeLabel, deliverableTypeShortLabel } from "@/lib/campaigns/deliverable-taxonomy";

export type CreatorDocumentationSlot = {
  campaignHeaderId: string;
  campaignName: string;
  campaignDocumentNumber: string;
  campaignLineId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  sequenceNumber: number | null;
  quantity: number;
  deliverableType: string;
  platform: string | null;
  dueDate: string | null;
  postStatus: string | null;
};

export type CreatorDocumentationUnitCard = CreatorDocumentationSlot & {
  unitKey: string;
  label: string;
  shortLabel: string;
};

export function buildCreatorDocumentationUnitsFromSlots(
  slots: CreatorDocumentationSlot[]
): CreatorDocumentationUnitCard[] {
  const byDeliverable = new Map<string, CreatorDocumentationSlot[]>();
  for (const slot of slots) {
    const list = byDeliverable.get(slot.assignmentDeliverableId) ?? [];
    list.push(slot);
    byDeliverable.set(slot.assignmentDeliverableId, list);
  }

  const units: CreatorDocumentationUnitCard[] = [];
  for (const group of byDeliverable.values()) {
    const first = group[0];
    if (!first) continue;
    const qty = Math.max(1, Number(first.quantity ?? 1));
    const typeLabel = deliverableTypeLabel(first.deliverableType);
    const shortLabel = deliverableTypeShortLabel(first.deliverableType);

    if (qty === 1) {
      units.push(
        toCard(
          {
            ...first,
            assignmentPostScheduleId: null,
            sequenceNumber: null,
            dueDate: first.dueDate,
          },
          typeLabel,
          shortLabel
        )
      );
      continue;
    }

    const posts = [...group]
      .filter((row) => row.assignmentPostScheduleId)
      .sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

    if (posts.length === 0) {
      units.push(toCard(first, `${typeLabel} (#1)`, shortLabel));
      continue;
    }

    for (const post of posts) {
      const sequence = post.sequenceNumber ?? 1;
      units.push(toCard(post, `${typeLabel} (#${sequence})`, shortLabel));
    }
  }

  return units.sort((a, b) => {
    const campaign = a.campaignName.localeCompare(b.campaignName);
    if (campaign !== 0) return campaign;
    const type = a.label.localeCompare(b.label);
    if (type !== 0) return type;
    return (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0);
  });
}

function toCard(
  slot: CreatorDocumentationSlot,
  label: string,
  shortLabel: string
): CreatorDocumentationUnitCard {
  return {
    ...slot,
    unitKey: documentationUnitKey(
      slot.assignmentDeliverableId,
      slot.assignmentPostScheduleId
    ),
    label,
    shortLabel,
  };
}
