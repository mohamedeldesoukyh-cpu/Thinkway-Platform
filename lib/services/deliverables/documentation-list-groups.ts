/**
 * Group documentation units by creator → deliverable type so operators
 * pick a slot (Reel #1 vs Story #3) instead of scanning a flat dump.
 */

import {
  deliverableTypeLabel,
  deliverableTypeShortLabel,
} from "@/lib/campaigns/deliverable-taxonomy";

import {
  documentationReceiptStatus,
  type DocumentationReceiptStatus,
  type DocumentationUnitSummary,
} from "./documentation-types";

export type DocumentationTypeGroup = {
  groupKey: string;
  platform: string | null;
  deliverableType: string | null;
  typeLabel: string;
  shortLabel: string;
  units: DocumentationUnitSummary[];
  receivedCount: number;
  incompleteCount: number;
  missingCount: number;
};

export type DocumentationCreatorGroup = {
  creatorId: string | null;
  creatorName: string | null;
  types: DocumentationTypeGroup[];
  receivedCount: number;
  unitCount: number;
};

export type DocumentationTypeOption = {
  groupKey: string;
  label: string;
};

export function documentationTypeGroupKey(unit: {
  platform: string | null;
  deliverableType: string | null;
  label: string;
}): string {
  return `${unit.platform ?? "other"}:${unit.deliverableType ?? unit.label}`;
}

export function documentationTypeGroupLabel(unit: {
  deliverableType: string | null;
  label: string;
}): string {
  const stripped = unit.label.replace(/\s*\(#\d+\)\s*$/, "").trim();
  if (unit.deliverableType) {
    const fromTaxonomy = deliverableTypeLabel(unit.deliverableType);
    const underscored = unit.deliverableType.replace(/_/g, " ");
    if (fromTaxonomy !== underscored) return fromTaxonomy;
  }
  return stripped || "Deliverable";
}

export function documentationTypeShortLabel(unit: {
  deliverableType: string | null;
  label: string;
}): string {
  if (unit.deliverableType) {
    const short = deliverableTypeShortLabel(unit.deliverableType);
    const underscored = unit.deliverableType.replace(/_/g, " ");
    if (short !== underscored) return short;
  }
  return documentationTypeGroupLabel(unit);
}

/** Right-panel headline: "Instagram reel #1". */
export function documentationSlotTitle(unit: {
  label: string;
  deliverableType: string | null;
  sequenceNumber: number | null;
  quantity: number;
}): string {
  const typeLabel = documentationTypeGroupLabel(unit);
  if (unit.sequenceNumber != null && unit.quantity > 1) {
    return `${typeLabel} #${unit.sequenceNumber}`;
  }
  return typeLabel;
}

export function documentationSlotDestinationLabel(unit: {
  label: string;
  deliverableType: string | null;
  sequenceNumber: number | null;
  quantity: number;
  creatorName: string | null;
}): string {
  const title = documentationSlotTitle(unit);
  const creator = unit.creatorName?.trim();
  return creator ? `${title} · ${creator}` : title;
}

/** Row label inside a type group: "#1" when qty>1, otherwise the type name. */
export function documentationSlotRowLabel(unit: {
  label: string;
  deliverableType: string | null;
  sequenceNumber: number | null;
  quantity: number;
}): string {
  if (unit.sequenceNumber != null && unit.quantity > 1) {
    return `#${unit.sequenceNumber}`;
  }
  return documentationSlotTitle(unit);
}

export function listDocumentationTypeOptions(
  units: DocumentationUnitSummary[]
): DocumentationTypeOption[] {
  const seen = new Map<string, string>();
  for (const unit of units) {
    const key = documentationTypeGroupKey(unit);
    if (!seen.has(key)) {
      seen.set(key, documentationTypeGroupLabel(unit));
    }
  }
  return [...seen.entries()].map(([groupKey, label]) => ({ groupKey, label }));
}

function tallyTypeGroup(units: DocumentationUnitSummary[]): {
  receivedCount: number;
  incompleteCount: number;
  missingCount: number;
} {
  let receivedCount = 0;
  let incompleteCount = 0;
  let missingCount = 0;
  for (const unit of units) {
    const status: DocumentationReceiptStatus = documentationReceiptStatus(unit);
    if (status === "received") receivedCount += 1;
    else if (status === "incomplete") incompleteCount += 1;
    else missingCount += 1;
  }
  return { receivedCount, incompleteCount, missingCount };
}

export function groupDocumentationUnits(
  units: DocumentationUnitSummary[]
): DocumentationCreatorGroup[] {
  const creators: DocumentationCreatorGroup[] = [];
  const creatorIndex = new Map<string, DocumentationCreatorGroup>();

  for (const unit of units) {
    const creatorKey = unit.creatorId ?? `name:${unit.creatorName ?? "unassigned"}`;
    let creator = creatorIndex.get(creatorKey);
    if (!creator) {
      creator = {
        creatorId: unit.creatorId,
        creatorName: unit.creatorName,
        types: [],
        receivedCount: 0,
        unitCount: 0,
      };
      creatorIndex.set(creatorKey, creator);
      creators.push(creator);
    }

    const typeKey = documentationTypeGroupKey(unit);
    let typeGroup = creator.types.find((entry) => entry.groupKey === typeKey);
    if (!typeGroup) {
      typeGroup = {
        groupKey: typeKey,
        platform: unit.platform,
        deliverableType: unit.deliverableType,
        typeLabel: documentationTypeGroupLabel(unit),
        shortLabel: documentationTypeShortLabel(unit),
        units: [],
        receivedCount: 0,
        incompleteCount: 0,
        missingCount: 0,
      };
      creator.types.push(typeGroup);
    }
    typeGroup.units.push(unit);
    creator.unitCount += 1;
    if (unit.received) creator.receivedCount += 1;
  }

  for (const creator of creators) {
    for (const typeGroup of creator.types) {
      const tally = tallyTypeGroup(typeGroup.units);
      typeGroup.receivedCount = tally.receivedCount;
      typeGroup.incompleteCount = tally.incompleteCount;
      typeGroup.missingCount = tally.missingCount;
    }
  }

  return creators;
}

export function defaultOpenTypeGroupKeys(
  groups: DocumentationCreatorGroup[],
  selectedKey: string | null
): Set<string> {
  const open = new Set<string>();
  for (const creator of groups) {
    for (const typeGroup of creator.types) {
      const containsSelected = typeGroup.units.some(
        (unit) => unit.unitKey === selectedKey
      );
      if (containsSelected) {
        open.add(typeGroup.groupKey);
        continue;
      }
      if (typeGroup.units.length <= 6) {
        open.add(typeGroup.groupKey);
      }
    }
  }
  if (open.size === 0) {
    const first = groups[0]?.types[0]?.groupKey;
    if (first) open.add(first);
  }
  return open;
}
