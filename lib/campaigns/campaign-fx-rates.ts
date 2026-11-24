/** Campaign reporting rates are separate from platform rates and issued documents. */
export function readCampaignFxRates(metadata: unknown): Record<string, number> {
  if (!metadata || typeof metadata !== "object") return {};
  const rates = (metadata as Record<string, unknown>).fx_rates_to_egp;
  if (!rates || typeof rates !== "object" || Array.isArray(rates)) return {};
  return Object.fromEntries(Object.entries(rates).filter(([currency, rate]) =>
    /^[A-Z]{3}$/.test(currency) && currency !== "EGP" && typeof rate === "number"
      && Number.isFinite(rate) && rate > 0 && rate <= 1e9));
}

export function applyCampaignFxRates(
  custom: Record<string, number>, target: string,
  ratesToEgp: Map<string, number>, systemDirectRates: Record<string, number>,
): Record<string, number> {
  const direct = { ...systemDirectRates };
  if (!Object.keys(custom).length) return direct;
  for (const [currency, rate] of Object.entries(custom)) ratesToEgp.set(currency, rate);
  ratesToEgp.set("EGP", 1);
  const targetRate = ratesToEgp.get(target);
  if (!targetRate) throw new Error(`Missing campaign FX rate for ${target}`);
  for (const [currency, rate] of ratesToEgp) {
    // Preserve direct system pairs unless one end has a campaign override.
    if (custom[currency] !== undefined || custom[target] !== undefined) direct[currency] = rate / targetRate;
  }
  direct[target] = 1;
  return direct;
}
