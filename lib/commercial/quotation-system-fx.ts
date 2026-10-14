/** Foreign quotation rows can inherit the EGP identity placeholder before rate resolution. */
export function needsQuotationSystemFx(currency: string, rate: number | null | undefined): boolean {
  return currency.trim().toUpperCase() !== "EGP" && (!Number.isFinite(rate) || Number(rate) <= 0 || Number(rate) === 1);
}
