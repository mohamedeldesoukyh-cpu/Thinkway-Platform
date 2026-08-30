import type { CreatorPaymentRow, CreatorVendorIoRow } from "@/features/portals/types";
import type { CreatorUnitStatus } from "@/features/creator-workspace/unit-status";

export type CreatorHomeNextActionKind =
  | "vendor_io"
  | "changes_requested"
  | "deliverable"
  | "script"
  | "publication"
  | "payment";

export type CreatorHomeNextAction = {
  id: string;
  kind: CreatorHomeNextActionKind;
  priority: number;
  title: string;
  description: string;
  href: string;
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
  payments: CreatorPaymentRow[];
};

function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function buildCreatorHomeNextActions(
  input: CreatorHomeNextActionInput
): CreatorHomeNextAction[] {
  const actions: CreatorHomeNextAction[] = [];

  for (const io of input.vendorIos) {
    if (io.status !== "sent") continue;
    actions.push({
      id: `vendor-io:${io.id}`,
      kind: "vendor_io",
      priority: 10,
      title: "Review your agreement",
      description: io.campaign_name,
      href: `/creator-portal/campaigns/${io.campaign_header_id}`,
      campaignHeaderId: io.campaign_header_id,
      vendorIoId: io.id,
    });
  }

  const changes = input.units.filter((unit) => unit.status === "changes_requested");
  if (changes.length === 1) {
    actions.push({
      id: `unit:changes:${changes[0].unitKey}`,
      kind: "changes_requested",
      priority: 20,
      title: "1 submission needs changes",
      description: `${changes[0].label} · ${changes[0].campaignName}`,
      href: `/creator-portal/campaigns/${changes[0].campaignHeaderId}`,
      campaignHeaderId: changes[0].campaignHeaderId,
    });
  } else if (changes.length > 1) {
    actions.push({
      id: "unit:changes",
      kind: "changes_requested",
      priority: 20,
      title: `${changes.length} submissions need changes`,
      description: changes[0].campaignName,
      href: "/creator-portal/deliverables",
    });
  }

  const dueToday = input.units.filter(
    (unit) => unit.status === "to_do" && isDueToday(unit.dueDate)
  );
  if (dueToday.length === 1) {
    actions.push({
      id: `unit:due:${dueToday[0].unitKey}`,
      kind: "deliverable",
      priority: 25,
      title: "1 deliverable due today",
      description: `${dueToday[0].label} · ${dueToday[0].campaignName}`,
      href: `/creator-portal/campaigns/${dueToday[0].campaignHeaderId}`,
      campaignHeaderId: dueToday[0].campaignHeaderId,
    });
  } else if (dueToday.length > 1) {
    actions.push({
      id: "unit:due",
      kind: "deliverable",
      priority: 25,
      title: `${dueToday.length} deliverables due today`,
      description: dueToday[0].campaignName,
      href: "/creator-portal/deliverables",
    });
  }

  const toDo = input.units.filter(
    (unit) => unit.status === "to_do" && !isDueToday(unit.dueDate)
  );
  if (toDo.length === 1) {
    actions.push({
      id: `unit:todo:${toDo[0].unitKey}`,
      kind: "deliverable",
      priority: 30,
      title: "Submit your deliverable",
      description: `${toDo[0].label} · ${toDo[0].campaignName}`,
      href: `/creator-portal/campaigns/${toDo[0].campaignHeaderId}`,
      campaignHeaderId: toDo[0].campaignHeaderId,
    });
  } else if (toDo.length > 1) {
    actions.push({
      id: "unit:todo",
      kind: "deliverable",
      priority: 30,
      title: `Complete ${toDo.length} deliverables`,
      description: toDo[0].campaignName,
      href: "/creator-portal/deliverables",
    });
  }

  const scriptReady = input.units.filter(
    (unit) => unit.status === "to_do" && unit.hasScript
  );
  if (scriptReady.length === 1) {
    actions.push({
      id: `unit:script:${scriptReady[0].unitKey}`,
      kind: "script",
      priority: 32,
      title: "1 script ready",
      description: `${scriptReady[0].label} · ${scriptReady[0].campaignName}`,
      href: `/creator-portal/campaigns/${scriptReady[0].campaignHeaderId}`,
      campaignHeaderId: scriptReady[0].campaignHeaderId,
    });
  } else if (scriptReady.length > 1) {
    actions.push({
      id: "unit:script",
      kind: "script",
      priority: 32,
      title: `${scriptReady.length} scripts ready`,
      description: scriptReady[0].campaignName,
      href: "/creator-portal/deliverables",
    });
  }

  const publicationNeeded = input.units.filter(
    (unit) =>
      unit.expectsPublicationUrl &&
      !unit.publicationUrl &&
      (unit.status === "approved" || unit.status === "uploaded" || unit.status === "under_review")
  );
  if (publicationNeeded.length === 1) {
    actions.push({
      id: `unit:pub:${publicationNeeded[0].unitKey}`,
      kind: "publication",
      priority: 35,
      title: "1 publication link required",
      description: `${publicationNeeded[0].label} · ${publicationNeeded[0].campaignName}`,
      href: `/creator-portal/campaigns/${publicationNeeded[0].campaignHeaderId}`,
      campaignHeaderId: publicationNeeded[0].campaignHeaderId,
    });
  } else if (publicationNeeded.length > 1) {
    actions.push({
      id: "unit:pub",
      kind: "publication",
      priority: 35,
      title: `${publicationNeeded.length} publication links required`,
      description: publicationNeeded[0].campaignName,
      href: "/creator-portal/deliverables",
    });
  }

  const pendingPayments = input.payments.filter(
    (row) => row.payment_status !== "Paid"
  );
  if (pendingPayments.length === 1) {
    actions.push({
      id: `payment:${pendingPayments[0].assignment_id}`,
      kind: "payment",
      priority: 40,
      title: "Payment in progress",
      description: pendingPayments[0].campaign_name,
      href: "/creator-portal/profile?section=payments",
    });
  } else if (pendingPayments.length > 1) {
    actions.push({
      id: "payment:pending",
      kind: "payment",
      priority: 40,
      title: `${pendingPayments.length} payments in progress`,
      description: pendingPayments[0].campaign_name,
      href: "/creator-portal/profile?section=payments",
    });
  }

  return actions.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

export function creatorFirstName(displayName: string | null | undefined): string {
  const trimmed = displayName?.trim() ?? "";
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? "there";
}
