/** Compact follower count — matches add-creators panel mockup (e.g. 190.8K, 1.2M). */
export function formatPanelFollowers(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(count)) return "—";
  const n = Math.round(count);
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return n.toLocaleString();
}
