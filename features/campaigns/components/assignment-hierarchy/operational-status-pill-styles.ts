import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";

/** Shared pill colors for Ops + Billing columns in assignment hierarchy. */
export const OPERATIONAL_PILL_CLASS: Record<CampaignLineOperationalStatus, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  io_generated: "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-transparent",
  moved_to_billing: "bg-violet-500/15 text-violet-900 dark:text-violet-100 border-transparent",
  partially_invoiced: "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-transparent",
  invoiced: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-transparent",
  reopened: "bg-orange-500/15 text-orange-900 dark:text-orange-100 border-transparent",
  closed: "bg-muted/80 text-muted-foreground border-transparent",
};

export const OPERATIONAL_STATUS_PILL_BASE =
  "inline-flex text-[10px] font-medium capitalize border";

export { normalizeOperationalStatus } from "@/lib/campaigns/operational-status-utils";
