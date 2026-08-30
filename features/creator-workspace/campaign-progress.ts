import type { CreatorUnitStatus } from "@/features/creator-workspace/unit-status";

export const CREATOR_CAMPAIGN_STAGES = [
  { id: "campaign", label: "Campaign" },
  { id: "brief", label: "Brief received" },
  { id: "create", label: "Content creation" },
  { id: "submitted", label: "Submitted" },
  { id: "review", label: "Under review" },
  { id: "approved", label: "Approved" },
  { id: "published", label: "Published" },
  { id: "payment", label: "Payment" },
] as const;

export type CreatorCampaignStageId = (typeof CREATOR_CAMPAIGN_STAGES)[number]["id"];

export type CreatorCampaignProgressInput = {
  hasBrief: boolean;
  vendorIoStatus: string | null;
  paymentStatus: string | null;
  units: Array<{ status: CreatorUnitStatus }>;
};

export function projectCreatorCampaignStage(
  input: CreatorCampaignProgressInput
): CreatorCampaignStageId {
  const units = input.units;
  const payment = (input.paymentStatus ?? "").toLowerCase();
  if (payment === "paid" && units.length > 0 && units.every((unit) => unit.status === "published")) {
    return "payment";
  }

  if (units.length === 0) {
    if (input.hasBrief) return "brief";
    return "campaign";
  }

  const allPublished = units.every((unit) => unit.status === "published");
  if (allPublished) return payment === "paid" ? "payment" : "published";

  const allApprovedOrLater = units.every(
    (unit) =>
      unit.status === "approved" ||
      unit.status === "scheduled" ||
      unit.status === "published"
  );
  if (allApprovedOrLater) return "approved";

  const anyReview =
    units.some((unit) => unit.status === "under_review" || unit.status === "changes_requested");
  const allReceived = units.every((unit) => unit.status !== "to_do");
  if (anyReview || (allReceived && units.some((unit) => unit.status === "under_review"))) {
    return "review";
  }

  const anySubmitted = units.some(
    (unit) =>
      unit.status === "uploaded" ||
      unit.status === "under_review" ||
      unit.status === "approved" ||
      unit.status === "scheduled" ||
      unit.status === "published"
  );
  if (anySubmitted && !allReceived) return "submitted";
  if (allReceived) return "submitted";

  if (input.hasBrief || input.vendorIoStatus === "approved" || input.vendorIoStatus === "sent") {
    return "create";
  }
  if (input.hasBrief) return "brief";
  return "campaign";
}

export function creatorCampaignStageIndex(stage: CreatorCampaignStageId): number {
  return CREATOR_CAMPAIGN_STAGES.findIndex((item) => item.id === stage);
}

export function creatorCampaignUnitCounts(units: Array<{ status: CreatorUnitStatus }>) {
  const total = units.length;
  const completed = units.filter(
    (unit) => unit.status === "published" || unit.status === "approved" || unit.status === "scheduled"
  ).length;
  const pending = units.filter(
    (unit) => unit.status === "to_do" || unit.status === "changes_requested"
  ).length;
  const approved = units.filter(
    (unit) =>
      unit.status === "approved" || unit.status === "scheduled" || unit.status === "published"
  ).length;
  const published = units.filter((unit) => unit.status === "published").length;
  const submitted = units.filter((unit) => unit.status !== "to_do").length;
  return { total, completed, pending, approved, published, submitted };
}
