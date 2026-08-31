import {
  prettyIsoDate,
  relativeFromToday,
  todayIso,
  toIsoDate,
  unitCalendarTone,
  unitStatusPill,
  type UnitActionSignal,
} from "@/features/creator-workspace/chrome";
import type { CreatorUnitStatus } from "@/features/creator-workspace/unit-status";
import type { CreatorCampaignRow } from "@/features/portals/types";

export type CreatorCalendarDueItem = {
  kind: "due";
  date: string;
  title: string;
  campaignName: string;
  campaignHeaderId: string;
  href: string;
  platform: string | null;
  status: CreatorUnitStatus;
  statusLabel: string;
  tone: ReturnType<typeof unitCalendarTone>;
};

export type CreatorCalendarMilestoneItem = {
  kind: "start" | "end";
  date: string;
  title: string;
  campaignName: string;
  campaignHeaderId: string;
  href: string;
  documentNumber: string;
};

export type CreatorCalendarItem = CreatorCalendarDueItem | CreatorCalendarMilestoneItem;

export type CreatorCalendarUnitInput = UnitActionSignal & {
  label: string;
  campaignName: string;
  campaignHeaderId: string;
  platform?: string | null;
  statusLabel: string;
};

export function buildCreatorCalendarItems(input: {
  campaigns: Pick<
    CreatorCampaignRow,
    "campaign_header_id" | "campaign_name" | "campaign_document_number" | "start_date" | "end_date"
  >[];
  units: CreatorCalendarUnitInput[];
}): CreatorCalendarItem[] {
  const items: CreatorCalendarItem[] = [];

  for (const unit of input.units) {
    const date = toIsoDate(unit.dueDate);
    if (!date) continue;
    items.push({
      kind: "due",
      date,
      title: unit.label,
      campaignName: unit.campaignName,
      campaignHeaderId: unit.campaignHeaderId,
      href: `/creator-portal/campaigns/${unit.campaignHeaderId}?tab=deliverables`,
      platform: unit.platform ?? null,
      status: unit.status,
      statusLabel: unit.statusLabel,
      tone: unitCalendarTone(unit.status),
    });
  }

  for (const campaign of input.campaigns) {
    const href = `/creator-portal/campaigns/${campaign.campaign_header_id}`;
    const start = toIsoDate(campaign.start_date);
    const end = toIsoDate(campaign.end_date);
    if (start) {
      items.push({
        kind: "start",
        date: start,
        title: campaign.campaign_name,
        campaignName: campaign.campaign_name,
        campaignHeaderId: campaign.campaign_header_id,
        href,
        documentNumber: campaign.campaign_document_number,
      });
    }
    if (end) {
      items.push({
        kind: "end",
        date: end,
        title: campaign.campaign_name,
        campaignName: campaign.campaign_name,
        campaignHeaderId: campaign.campaign_header_id,
        href,
        documentNumber: campaign.campaign_document_number,
      });
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

export function upcomingCreatorCalendarItems(
  items: CreatorCalendarItem[],
  limit: number,
  today: string = todayIso()
): CreatorCalendarItem[] {
  return items.filter((item) => item.date >= today).slice(0, limit);
}

export function calendarItemWhen(item: CreatorCalendarItem, today: string = todayIso()): string {
  return relativeFromToday(item.date, today);
}

export function calendarItemMeta(item: CreatorCalendarItem, today: string = todayIso()): string {
  const when = calendarItemWhen(item, today);
  if (item.kind === "due") {
    return `${item.campaignName} · ${prettyIsoDate(item.date)} · ${when}`;
  }
  return `${item.documentNumber} · ${prettyIsoDate(item.date)} · ${when}`;
}

export function calendarDueStatusPill(item: CreatorCalendarDueItem) {
  return unitStatusPill(item.statusLabel, item.status);
}
