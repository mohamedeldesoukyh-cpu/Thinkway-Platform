import type { ClientIoMilestoneDraft } from "@/lib/io/client-io-milestones";

export function invoiceMilestoneDueDate(milestone: ClientIoMilestoneDraft, dates: {
  invoiceDate: string; approvedAt?: string | null; sentAt?: string | null; eventDate?: string | null;
}): string | null {
  const net = /\bnet\s*\d+\s*days?\b/i.test(milestone.label);
  const anchor = milestone.dueDate || (net ? dates.invoiceDate :
    milestone.dueTrigger === "on_approval" ? dates.approvedAt :
    milestone.dueTrigger === "on_send" ? dates.sentAt : dates.eventDate);
  if (!anchor || !/^\d{4}-\d{2}-\d{2}/.test(anchor)) return null;
  const date = new Date(`${anchor.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  if (!milestone.dueDate) date.setUTCDate(date.getUTCDate() + (milestone.dueOffsetDays ?? 0));
  return date.toISOString().slice(0, 10);
}
