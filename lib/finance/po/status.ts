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
