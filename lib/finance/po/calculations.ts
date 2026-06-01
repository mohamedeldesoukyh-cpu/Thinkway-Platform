export type PoHealth = "healthy" | "near_limit" | "exceeded" | "inactive";

export type PoConsumptionSnapshot = {
  po_amount: number;
  consumed: number;
  remaining: number;
  remaining_percent: number | null;
  projected_consumed: number;
  projected_remaining: number;
  projected_remaining_percent: number | null;
  exceeded_amount: number;
  is_over_consumed: boolean;
  health: PoHealth;
};

export function calculatePoConsumption(input: {
  po_amount: number;
  consumed: number;
  projected_revenue?: number;
  exclude_line_revenue?: number;
  current_line_revenue?: number;
}): PoConsumptionSnapshot {
  const poAmount = Math.max(input.po_amount, 0);
  const consumed = Math.max(input.consumed, 0);
  const currentLineRevenue = input.current_line_revenue ?? 0;
  const exclude = input.exclude_line_revenue ?? 0;
  const baseConsumed = consumed - exclude;
  const projectedConsumed = baseConsumed + currentLineRevenue;
  const remaining = poAmount - consumed;
  const projectedRemaining = poAmount - projectedConsumed;
  const remainingPercent =
    poAmount > 0 ? roundPercent((remaining / poAmount) * 100) : null;
  const projectedRemainingPercent =
    poAmount > 0 ? roundPercent((projectedRemaining / poAmount) * 100) : null;
  const exceededAmount = Math.max(projectedConsumed - poAmount, 0);
  const isOverConsumed = poAmount > 0 && projectedConsumed > poAmount;

  let health: PoHealth = "inactive";
  if (poAmount > 0) {
    if (projectedConsumed > poAmount) {
      health = "exceeded";
    } else if (
      projectedRemainingPercent != null &&
      projectedRemainingPercent <= 15
    ) {
      health = "near_limit";
    } else {
      health = "healthy";
    }
  }

  return {
    po_amount: poAmount,
    consumed,
    remaining,
    remaining_percent: remainingPercent,
    projected_consumed: projectedConsumed,
    projected_remaining: projectedRemaining,
    projected_remaining_percent: projectedRemainingPercent,
    exceeded_amount: exceededAmount,
    is_over_consumed: isOverConsumed,
    health,
  };
}

export function convertPoAmount(input: {
  original_amount: number;
  exchange_rate: number;
}): number {
  return roundMoney(input.original_amount * input.exchange_rate);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}
