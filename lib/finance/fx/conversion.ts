export function convertAmount(input: {
  amount: number;
  exchange_rate: number;
}): number {
  return Math.round(input.amount * input.exchange_rate * 100) / 100;
}

export function formatFxRate(rate: number): string {
  return rate.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}
