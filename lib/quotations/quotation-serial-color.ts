/** Deterministic serial icon colors — stable across refreshes (see QUOTATION_SCHEMA §3). */
export const QUOTATION_SERIAL_ICON_COLORS = [
  "#f59e0b",
  "#0057FF",
  "#a855f7",
  "#ef4444",
] as const;

function hashString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function quotationSerialIconColor(quotationId: string): string {
  const index = hashString(quotationId) % QUOTATION_SERIAL_ICON_COLORS.length;
  return QUOTATION_SERIAL_ICON_COLORS[index] ?? QUOTATION_SERIAL_ICON_COLORS[0];
}
