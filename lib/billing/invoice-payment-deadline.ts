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

/** Older IOs stored a whole advance/completion schedule as one free-text milestone. */
export function legacySplitPaymentMilestones(text: string): ClientIoMilestoneDraft[] | null {
  const match = text.match(/(\d+(?:\.\d+)?)%\s+advance\s+payment\s+upon\s+confirmation,?\s*(?:and\s+)?(?:the\s+)?remaining\s+(\d+(?:\.\d+)?)%\s+(?:payable\s+)?within\s+(\d+)\s+days\s+from\s+(?:the\s+)?campaign\s+completion/i);
  if (!match || Number(match[1]) + Number(match[2]) !== 100) return null;
  return [
    {id:"legacy-advance", label:"Advance on confirmation", percent:Number(match[1]), milestoneKind:"upfront", dueTrigger:"on_approval", dueOffsetDays:0, dueDate:null, notes:null, sortOrder:1},
    {id:"legacy-completion", label:`Balance within ${match[3]} days of completion`, percent:Number(match[2]), milestoneKind:"completion", dueTrigger:"on_completion", dueOffsetDays:Number(match[3]), dueDate:null, notes:null, sortOrder:2},
  ];
}
