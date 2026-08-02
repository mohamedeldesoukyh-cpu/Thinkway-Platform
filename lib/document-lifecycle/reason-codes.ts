import type { DocumentLifecycleReasonCode } from "@/lib/document-lifecycle/types";

const LABELS: Record<DocumentLifecycleReasonCode, string> = {
  creator_price_changed: "Creator price changed",
  deliverables_changed: "Deliverables changed",
  payment_terms_changed: "Payment terms changed",
  campaign_budget_changed: "Campaign budget changed",
  creator_removed: "Creator removed from campaign",
  creator_replaced: "Creator replaced on campaign",
  campaign_cancelled: "Campaign cancelled",
  manual_revision: "Manual revision required",
  commercial_correction: "Commercial correction",
  document_superseded: "Superseded by a newer revision",
  document_cancelled: "Document cancelled",
  resent: "Document resent",
  accepted: "Document accepted",
  rejected: "Document rejected",
  generated: "Document generated",
  sent: "Document sent",
  delivered_manually: "Delivered manually",
  other: "Other",
};

export function formatLifecycleReasonLabel(
  code: string | null | undefined,
  detail?: string | null
): string | null {
  if (!code && !detail) return null;
  const known = code
    ? LABELS[code as DocumentLifecycleReasonCode] ?? code.replace(/_/g, " ")
    : null;
  if (known && detail && detail.trim() && detail.trim() !== known) {
    return `${known} — ${detail.trim()}`;
  }
  return detail?.trim() || known;
}

export function normalizeReasonCode(
  code: string | null | undefined
): DocumentLifecycleReasonCode | null {
  if (!code) return null;
  if (code in LABELS) return code as DocumentLifecycleReasonCode;
  return "other";
}
