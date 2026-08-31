import { isAgencyBrandCreatorLabel } from "@/features/creator-workspace/identity";
import {
  todayIso,
  unitIsOverdueForCreator,
  unitNeedsCreatorAction,
} from "@/features/creator-workspace/chrome";
import { unitNeedsPublicationLink, type CreatorUnitStatus } from "@/features/creator-workspace/unit-status";
import type { CreatorPaymentRow, CreatorVendorIoRow } from "@/features/portals/types";

export type CreatorHomeNextActionKind =
  | "vendor_io"
  | "overdue"
  | "changes_requested"
  | "publication"
  | "deliverable";

export type CreatorHomeNextActionTone = "red" | "amber" | "green" | "blue";

export type CreatorHomeNextAction = {
  id: string;
  kind: CreatorHomeNextActionKind;
  priority: number;
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: CreatorHomeNextActionTone;
  campaignHeaderId?: string;
  vendorIoId?: string;
};

export type CreatorHomeUnitSignal = {
  unitKey: string;
  campaignHeaderId: string;
  campaignName: string;
  label: string;
  status: CreatorUnitStatus;
  dueDate: string | null;
  hasScript: boolean;
  expectsPublicationUrl: boolean;
  publicationUrl: string | null;
};

export type CreatorHomeNextActionInput = {
  vendorIos: CreatorVendorIoRow[];
  units: CreatorHomeUnitSignal[];
  /** Ignored — payment is informational, never a creator action. */
  payments?: CreatorPaymentRow[];
};

function summarize(units: CreatorHomeUnitSignal[]): string {
  const shown = units.slice(0, 2).map((unit) => `${unit.label} · ${unit.campaignName}`);
  if (units.length > 2) shown.push(`+${units.length - 2} more`);
  return shown.join("  ·  ");
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function buildCreatorHomeNextActions(
  input: CreatorHomeNextActionInput
): CreatorHomeNextAction[] {
  const actions: CreatorHomeNextAction[] = [];
  const today = todayIso();

  for (const io of input.vendorIos) {
    if (io.status !== "sent") continue;
    actions.push({
      id: `vendor-io:${io.id}`,
      kind: "vendor_io",
      priority: 10,
      title: "Review your agreement",
      description: io.campaign_name,
      href: `/creator-portal/campaigns/${io.campaign_header_id}?tab=agreement`,
      cta: "Review agreement",
      tone: "blue",
      campaignHeaderId: io.campaign_header_id,
      vendorIoId: io.id,
    });
  }

  const overdue = input.units.filter((unit) => unitIsOverdueForCreator(unit, today));
  if (overdue.length > 0) {
    actions.push({
      id: "unit:overdue",
      kind: "overdue",
      priority: 15,
      title: plural(
        overdue.length,
        "1 deliverable overdue",
        `${overdue.length} deliverables overdue`
      ),
      description: summarize(overdue),
      href: overdue.length === 1
        ? `/creator-portal/campaigns/${overdue[0].campaignHeaderId}?tab=deliverables`
        : "/creator-portal/deliverables",
      cta: "Open",
      tone: "red",
      campaignHeaderId: overdue.length === 1 ? overdue[0].campaignHeaderId : undefined,
    });
  }

  const changes = input.units.filter(
    (unit) => unit.status === "changes_requested" && !unitIsOverdueForCreator(unit, today)
  );
  if (changes.length > 0) {
    actions.push({
      id: "unit:changes",
      kind: "changes_requested",
      priority: 20,
      title: plural(
        changes.length,
        "1 needs changes before re-upload",
        `${changes.length} need changes before re-upload`
      ),
      description: summarize(changes),
      href: changes.length === 1
        ? `/creator-portal/campaigns/${changes[0].campaignHeaderId}?tab=deliverables`
        : "/creator-portal/deliverables",
      cta: "Fix and re-upload",
      tone: "amber",
      campaignHeaderId: changes.length === 1 ? changes[0].campaignHeaderId : undefined,
    });
  }

  const publicationNeeded = input.units.filter(
    (unit) =>
      unitNeedsPublicationLink(unit) && !unitIsOverdueForCreator(unit, today)
  );
  if (publicationNeeded.length > 0) {
    actions.push({
      id: "unit:pub",
      kind: "publication",
      priority: 35,
      title: plural(
        publicationNeeded.length,
        "1 approved — ready to publish",
        `${publicationNeeded.length} approved — ready to publish`
      ),
      description: summarize(publicationNeeded),
      href: publicationNeeded.length === 1
        ? `/creator-portal/campaigns/${publicationNeeded[0].campaignHeaderId}?tab=deliverables`
        : "/creator-portal/deliverables",
      cta: "Add live link",
      tone: "green",
      campaignHeaderId:
        publicationNeeded.length === 1 ? publicationNeeded[0].campaignHeaderId : undefined,
    });
  }

  const toUpload = input.units.filter(
    (unit) => unit.status === "to_do" && !unitIsOverdueForCreator(unit, today)
  );
  if (toUpload.length > 0) {
    actions.push({
      id: "unit:todo",
      kind: "deliverable",
      priority: 30,
      title: plural(
        toUpload.length,
        "1 deliverable to upload",
        `${toUpload.length} deliverables to upload`
      ),
      description: summarize(toUpload),
      href: toUpload.length === 1
        ? `/creator-portal/campaigns/${toUpload[0].campaignHeaderId}?tab=deliverables`
        : "/creator-portal/deliverables",
      cta: "Upload",
      tone: "blue",
      campaignHeaderId: toUpload.length === 1 ? toUpload[0].campaignHeaderId : undefined,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function countUnitsNeedingCreator(units: CreatorHomeUnitSignal[]): number {
  return units.filter(unitNeedsCreatorAction).length;
}

export function creatorFirstName(displayName: string | null | undefined): string {
  const trimmed = displayName?.trim() ?? "";
  if (!trimmed || isAgencyBrandCreatorLabel(trimmed)) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}
