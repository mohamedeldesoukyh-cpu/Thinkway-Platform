/**
 * Discovery suite foundation helpers — Session 0 (00-FOUNDATION.md).
 * Pack names: D, F, AB, E, ini, pf (+ PFC).
 */

export {
  formatDiscoveryDate as D,
  formatDiscoveryDate,
  formatDiscoveryDateTime,
  formatDiscoveryDateRange,
} from "@/lib/discovery/format-discovery-date";

/** Locale thousands grouping (rounded) — missing → em dash. */
export function F(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n)).toLocaleString("en-US");
}

/** Compact abbrev: 1.2M / 183.9K / plain. */
export function AB(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

/** HTML escape — mandatory on every user string. */
export function E(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );
}

/** Initials from display name (max 2). */
export function ini(s: unknown): string {
  const t = String(s ?? "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
  if (!t) return "?";
  return t
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

export const PFC: Record<string, [string, string]> = {
  ig: ["ig", "IG"],
  tt: ["tt", "TT"],
  yt: ["yt", "YT"],
  fb: ["fb", "FB"],
  sc: ["sc", "SC"],
};

/** Platform mark HTML (comma-separated keys). */
export function pf(keys: string | null | undefined): string {
  if (!keys) return "";
  return `<span class="tw-pf">${keys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .map((k) => {
      const d = PFC[k] ?? (["ig", "?"] as [string, string]);
      return `<span class="${d[0]}">${d[1]}</span>`;
    })
    .join("")}</span>`;
}

/** Pack grid helpers (string HTML) — pages may use React equivalents with same --cols. */
export function grid(
  cols: string,
  minW: number,
  header: string,
  rows: string,
  foot: string | null = null
): string {
  return (
    `<div class="tw-g" style="min-width:${minW}px;--cols:${cols}">` +
    `<div class="tw-hd">${header}</div>${rows}` +
    (foot ? `<div class="tw-ft">${foot}</div>` : "") +
    `</div>`
  );
}

export function row(cols: string, cls: string, cells: string): string {
  void cols;
  return `<div class="tw-r${cls ? ` ${cls}` : ""}">${cells}</div>`;
}
