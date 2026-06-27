import type { CampaignLineOperationalStatus } from "@/lib/domains/campaign/types";

/** User-facing Ops column labels — billing state lives on Billing column only. */
export const LINE_OPERATIONAL_STATUS_LABELS: Record<CampaignLineOperationalStatus, string> = {
  draft: "Draft",
  io_generated: "IO generated",
  io_revised: "IO revised",
  locked: "Locked",
  moved_to_billing: "IO generated",
  partially_invoiced: "Locked",
  invoiced: "Locked",
  reopened: "IO revised",
  closed: "Closed",
};

export const LINE_OPERATIONAL_STATUS_VARIANT: Record<
  CampaignLineOperationalStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  io_generated: "default",
  io_revised: "outline",
  locked: "default",
  moved_to_billing: "default",
  partially_invoiced: "outline",
  invoiced: "default",
  reopened: "outline",
  closed: "secondary",
};

/** Tailwind classes for row tint (assignments + billing queue). */
export const LINE_OPERATIONAL_ROW_CLASS: Record<CampaignLineOperationalStatus, string> = {
  draft: "border-l-4 border-l-muted-foreground/30 bg-muted/10",
  io_generated: "border-l-4 border-l-sky-500/70 bg-sky-500/5",
  io_revised: "border-l-4 border-l-orange-500/70 bg-orange-500/5",
  locked: "border-l-4 border-l-emerald-500/70 bg-emerald-500/5",
  moved_to_billing: "border-l-4 border-l-sky-500/70 bg-sky-500/5",
  partially_invoiced: "border-l-4 border-l-emerald-500/70 bg-emerald-500/5",
  invoiced: "border-l-4 border-l-emerald-500/70 bg-emerald-500/5",
  reopened: "border-l-4 border-l-orange-500/70 bg-orange-500/5",
  closed: "border-l-4 border-l-muted-foreground/40 bg-muted/20",
};
