import { creatorPaymentIsOutstanding } from "@/features/creator-workspace/payment-copy";
import {
  unitNeedsPublicationLink,
  type CreatorUnitStatus,
} from "@/features/creator-workspace/unit-status";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function prettyIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]?.slice(0, 3) ?? ""} ${y}`.replace(/\s+/g, " ").trim();
}

export function relativeFromToday(iso: string, today: string = todayIso()): string {
  const days = Math.round(
    (Date.parse(`${iso}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function creatorInitials(name: string | null | undefined): string {
  const letters = (name ?? "").replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
  return letters || "–";
}

export function formatJoinedMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export type UnitActionSignal = {
  status: CreatorUnitStatus;
  dueDate?: string | null;
  expectsPublicationUrl?: boolean;
  publicationUrl?: string | null;
};

export function unitNeedsCreatorAction(unit: UnitActionSignal): boolean {
  return (
    unit.status === "to_do" ||
    unit.status === "changes_requested" ||
    unitNeedsPublicationLink(unit)
  );
}

export function unitIsOverdueForCreator(
  unit: UnitActionSignal,
  today: string = todayIso()
): boolean {
  const iso = toIsoDate(unit.dueDate);
  if (!iso) return false;
  if (unit.status === "published") return false;
  return iso < today;
}

export function unitCalendarTone(status: CreatorUnitStatus): "todo" | "changes" | "approved" | "review" | "published" {
  if (status === "to_do") return "todo";
  if (status === "changes_requested") return "changes";
  if (status === "approved" || status === "scheduled") return "approved";
  if (status === "published") return "published";
  return "review";
}

export function campaignStatusPill(status: string | null | undefined): {
  className: string;
  label: string;
} {
  const normalized = (status ?? "").trim().toLowerCase().replaceAll("_", " ");
  if (normalized === "live" || normalized === "active" || normalized === "in progress") {
    return { className: "pill pill--ok", label: "Live" };
  }
  if (
    normalized === "complete" ||
    normalized === "completed" ||
    normalized === "closed" ||
    normalized === "done"
  ) {
    return { className: "pill pill--mute", label: "Complete" };
  }
  if (!normalized || normalized === "draft") {
    return { className: "pill pill--mute", label: "Draft" };
  }
  return {
    className: "pill pill--mute",
    label: normalized.replace(/\b\w/g, (ch) => ch.toUpperCase()),
  };
}

export function paymentPendingPill(status: string | null | undefined): {
  className: string;
  label: string;
} {
  if (creatorPaymentIsOutstanding(status)) {
    return { className: "pill pill--pend", label: "Payment pending" };
  }
  return { className: "pill pill--ok", label: "Paid" };
}

export function unitStatusPill(statusLabel: string, status: CreatorUnitStatus): {
  className: string;
  label: string;
} {
  if (status === "changes_requested") {
    return { className: "pill pill--red", label: statusLabel };
  }
  if (status === "published") {
    return { className: "pill pill--ok", label: statusLabel };
  }
  if (status === "to_do") {
    return { className: "pill pill--mute", label: statusLabel === "Needs submission" ? "To do" : statusLabel };
  }
  if (status === "approved" || status === "scheduled") {
    return { className: "pill pill--blue", label: statusLabel };
  }
  return { className: "pill pill--blue", label: statusLabel };
}

export function campaignDeliveredPercent(published: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((published / total) * 100);
}

export const CREATOR_MONTH_NAMES = MONTHS;
export const CREATOR_DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
