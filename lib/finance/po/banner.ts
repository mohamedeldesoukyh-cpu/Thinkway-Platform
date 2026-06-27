import type { PoHealth } from "@/lib/finance/po/calculations";

export type PoBannerLevel = "safe" | "near_limit" | "exceeded";

export const PO_BANNER_FRAME: Record<PoBannerLevel, string> = {
  safe: "border-2 border-emerald-500/70 bg-emerald-500/10 text-foreground",
  near_limit: "border-2 border-amber-500/70 bg-amber-500/10 text-amber-950 dark:text-amber-50",
  exceeded: "border-2 border-red-500/70 bg-red-500/10 text-red-950 dark:text-red-50",
};

export const PO_BANNER_TEXT: Record<PoBannerLevel, string> = {
  safe: "text-success",
  near_limit: "text-warning",
  exceeded: "text-destructive",
};

export function resolvePoBannerLevel(input: {
  po_amount: number;
  consumed: number;
  po_exceeded?: boolean;
}): PoBannerLevel | null {
  const poAmount = Math.max(input.po_amount, 0);
  if (poAmount <= 0) return null;
  const consumed = Math.max(input.consumed, 0);
  const pct = (consumed / poAmount) * 100;
  if (input.po_exceeded || pct > 100) return "exceeded";
  if (pct >= 85) return "near_limit";
  return "safe";
}

export function poHealthToBannerLevel(health: PoHealth): PoBannerLevel | null {
  if (health === "inactive") return null;
  if (health === "exceeded") return "exceeded";
  if (health === "near_limit") return "near_limit";
  return "safe";
}

export function formatPoBannerCopy(input: {
  level: PoBannerLevel;
  consumed: number;
  po_amount: number;
  formatMoney: (amount: number, currency: string) => string;
  currency: string;
}): { primary: string; secondary: string } {
  const consumed = Math.max(input.consumed, 0);
  const poAmount = Math.max(input.po_amount, 0);
  const pct = poAmount > 0 ? Math.round((consumed / poAmount) * 100) : 0;
  const exceededBy = Math.max(consumed - poAmount, 0);

  if (input.level === "exceeded") {
    return {
      primary: `PO exceeded: ${input.formatMoney(consumed, input.currency)} of ${input.formatMoney(poAmount, input.currency)}`,
      secondary: `Exceeded by ${input.formatMoney(exceededBy, input.currency)}`,
    };
  }

  return {
    primary: `PO consumed: ${input.formatMoney(consumed, input.currency)} of ${input.formatMoney(poAmount, input.currency)}`,
    secondary: `${pct}% consumed`,
  };
}
