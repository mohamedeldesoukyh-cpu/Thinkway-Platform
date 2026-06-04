export type PoStatus =
  | "draft"
  | "active"
  | "near_limit"
  | "exceeded"
  | "expired"
  | "closed";

export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft: "Draft",
  active: "Active",
  near_limit: "Near limit",
  exceeded: "Exceeded",
  expired: "Expired",
  closed: "Closed",
};

export const PO_STATUS_VARIANT: Record<
  PoStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  active: "default",
  near_limit: "secondary",
  exceeded: "destructive",
  expired: "destructive",
  closed: "outline",
};

/** Campaign PO alert card border/text by operational status. */
export const PO_ALERT_FRAME: Record<PoStatus, string> = {
  draft: "border-2 border-border/80 text-foreground",
  active: "border-2 border-emerald-500/70 text-foreground",
  near_limit: "border-2 border-amber-500 text-amber-950 dark:text-amber-50",
  exceeded: "border-2 border-red-500 text-red-950 dark:text-red-50",
  expired: "border-2 border-orange-500 text-orange-950 dark:text-orange-50",
  closed: "border-2 border-border/80 text-foreground",
};

export const PO_ALERT_TITLE: Record<PoStatus, string> = {
  draft: "PO draft",
  active: "PO active",
  near_limit: "PO near limit",
  exceeded: "PO exceeded",
  expired: "PO expired",
  closed: "PO closed",
};

export function resolvePoAlertStatus(input: {
  po_status: PoStatus;
  po_exceeded: boolean;
}): PoStatus | null {
  if (input.po_exceeded || input.po_status === "exceeded") {
    return "exceeded";
  }
  if (input.po_status === "near_limit" || input.po_status === "expired") {
    return input.po_status;
  }
  return null;
}

export function getPoHealthColor(
  health: "healthy" | "near_limit" | "exceeded" | "inactive"
): string {
  switch (health) {
    case "healthy":
      return "bg-emerald-500";
    case "near_limit":
      return "bg-amber-500";
    case "exceeded":
      return "bg-red-500";
    default:
      return "bg-muted";
  }
}

export function computePoStatus(input: {
  po_amount: number;
  consumed: number;
  remaining_percent: number | null;
  expiry_date: string | null;
  current_status?: PoStatus;
}): PoStatus {
  if (input.current_status === "closed") {
    return "closed";
  }

  if (input.po_amount <= 0) {
    return "draft";
  }

  if (input.expiry_date) {
    const expiry = new Date(`${input.expiry_date}T00:00:00`);
    if (expiry < new Date()) {
      return "expired";
    }
  }

  if (input.consumed > input.po_amount) {
    return "exceeded";
  }

  if (
    input.remaining_percent != null &&
    input.remaining_percent <= 15
  ) {
    return "near_limit";
  }

  return "active";
}
