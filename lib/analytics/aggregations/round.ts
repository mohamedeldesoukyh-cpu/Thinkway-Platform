export function roundMoney(value: number): number {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.round(safe * 100) / 100;
}
