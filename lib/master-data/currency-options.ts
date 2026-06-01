export type CurrencyOption = {
  value: string;
  label: string;
  symbol: string | null;
  decimal_places: number;
};

export function buildCurrencyOptions(
  currencies: {
    code: string;
    name: string;
    symbol: string | null;
    decimal_places?: number;
  }[]
): CurrencyOption[] {
  return currencies.map((currency) => ({
    value: currency.code,
    label: `${currency.code} — ${currency.name}`,
    symbol: currency.symbol,
    decimal_places: currency.decimal_places ?? 2,
  }));
}

export function isValidCurrencyCode(
  code: string,
  activeCodes: string[]
): boolean {
  return activeCodes.includes(code.trim().toUpperCase());
}
