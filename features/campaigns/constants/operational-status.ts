import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";

export const LINE_OPERATIONAL_STATUS_LABELS: Record<CampaignLineOperationalStatus, string> = {
  draft: "Draft",
  io_generated: "IO generated",
  moved_to_billing: "Moved to billing",
  partially_invoiced: "Partially invoiced",
  invoiced: "Invoiced",
  reopened: "Reopened",
  closed: "Closed",
};

export const LINE_OPERATIONAL_STATUS_VARIANT: Record<
  CampaignLineOperationalStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  io_generated: "default",
  moved_to_billing: "default",
  partially_invoiced: "outline",
  invoiced: "default",
  reopened: "destructive",
  closed: "secondary",
};

/** Tailwind classes for row tint (assignments + billing queue). */
export const LINE_OPERATIONAL_ROW_CLASS: Record<CampaignLineOperationalStatus, string> = {
  draft: "border-l-4 border-l-muted-foreground/30 bg-muted/10",
  io_generated: "border-l-4 border-l-sky-500/70 bg-sky-500/5",
  moved_to_billing: "border-l-4 border-l-violet-500/60 bg-violet-500/5",
  partially_invoiced: "border-l-4 border-l-amber-500/70 bg-amber-500/5",
  invoiced: "border-l-4 border-l-emerald-500/70 bg-emerald-500/5",
  reopened: "border-l-4 border-l-orange-500/70 bg-orange-500/5",
  closed: "border-l-4 border-l-muted-foreground/40 bg-muted/20",
};
