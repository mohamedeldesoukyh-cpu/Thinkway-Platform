import { deliverableTypeLabel } from "@/lib/campaigns/deliverable-taxonomy";
import { platformLabel } from "@/lib/campaigns/line-assignment";
import type { AssignmentHierarchyGroup } from "@/lib/domains/campaign/assignment-hierarchy-types";
import type { CampaignLineWorkspace } from "@/lib/domains/campaign/workspace-types";
import { formatPercent } from "@/lib/campaigns/utils";
import { formatDesignDate } from "@/lib/design/format-design-date";

export function formatAssignmentDetailDate(value: string | null | undefined): string {
  return formatDesignDate(value);
}

export function resolveAssignmentPrimaryHandle(line: CampaignLineWorkspace): string {
  const accounts = line.creator_platform_accounts ?? [];
  const primaryPlatform = line.platform ?? accounts[0]?.platform;
  const match =
    accounts.find((account) => account.platform === primaryPlatform) ?? accounts[0];
  if (match?.handle?.trim()) return match.handle.trim();
  if (line.assignment?.platforms?.[0]?.handle?.trim()) {
    return line.assignment.platforms[0].handle.trim();
  }
  return line.influencer_name?.trim() || line.name;
}

export function resolveAssignmentPlatformLabels(group: AssignmentHierarchyGroup): string[] {
  const deliverables = Array.isArray(group.deliverables) ? group.deliverables : [];
  const platforms = [
    ...new Set(
      deliverables.map((row) => row.platform).filter((value): value is string => Boolean(value))
    ),
  ];
  if (platforms.length > 0) {
    return platforms.map((platform) => platformLabel(platform));
  }
  if (group.line.platform) return [platformLabel(group.line.platform)];
  return [];
}

export function resolveAssignmentDeliverableLabels(group: AssignmentHierarchyGroup): string[] {
  const deliverables = Array.isArray(group.deliverables) ? group.deliverables : [];
  if (deliverables.length > 0) {
    return [
      ...new Set(
        deliverables.map(
          (row) => row.deliverable_type_label || deliverableTypeLabel(row.deliverable_type)
        )
      ),
    ];
  }

  const assignmentPlatforms = group.line.assignment?.platforms ?? [];
  const fromAssignment = assignmentPlatforms.flatMap((platform) =>
    platform.deliverables.map((type) => deliverableTypeLabel(type))
  );
  return [...new Set(fromAssignment)];
}

export function resolveAssignmentFirstLiveDate(
  group: AssignmentHierarchyGroup
): string | null {
  const dates: string[] = [];
  for (const deliverable of group.deliverables ?? []) {
    if (deliverable.live_date) dates.push(deliverable.live_date);
    for (const post of deliverable.posts ?? []) {
      if (post.live_date) dates.push(post.live_date);
    }
  }
  if (dates.length === 0) return group.line.start_date;
  dates.sort();
  return dates[0] ?? null;
}

export function isAssignmentLiveDateOverdue(
  liveDate: string | null,
  assignmentStatus: string
): boolean {
  if (!liveDate) return false;
  if (["posted", "verified", "invoiced", "paid", "closed"].includes(assignmentStatus)) {
    return false;
  }
  const parsed = new Date(liveDate);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed < today;
}

export function resolvePaymentRequestedPercent(line: CampaignLineWorkspace): string {
  const total = Number(line.cost_before_vat ?? line.cost) || 0;
  if (total <= 0) return "0%";
  const received = Number(line.cost_received) || 0;
  return formatPercent((received / total) * 100);
}

export function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}
