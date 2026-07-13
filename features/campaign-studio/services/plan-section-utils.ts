/** Parse numeric fee from estimateCreatorPostFee output. */
export function parseFeeAmount(priceEstimate?: string): number | undefined {
  if (!priceEstimate?.trim()) return undefined;
  const digits = priceEstimate.replace(/[^\d.]/g, "");
  const value = Number.parseFloat(digits);
  return Number.isFinite(value) ? value : undefined;
}
