/** Spec §2 — one Discovery date formatter. Relative ages only for similar-creators. */

const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const ALREADY =
  /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2}(?:\s*·\s*\d{2}:\d{2})?$/i;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fromDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())} ${MON[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

const MON_IX: Record<string, number> = Object.fromEntries(
  MON.map((m, i) => [m, i])
);

function parseLoose(v: string): Date | null {
  // Pack shapes — prefer explicit before Date.parse (locale-sensitive).
  let m = v.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})$/);
  if (m) {
    const mi = MON_IX[m[1]!];
    if (mi != null) {
      const d = new Date(Number(m[3]), mi, Number(m[2]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = v.match(/^(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{2}|\d{4})$/);
  if (m) {
    const mi = MON_IX[m[2]!];
    if (mi != null) {
      let y = Number(m[3]);
      if (y < 100) y += 2000;
      const d = new Date(y, mi, Number(m[1]));
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  const iso = Date.parse(v);
  if (!Number.isNaN(iso)) return new Date(iso);
  return null;
}

/**
 * Returns `DD Mon YY`. Passes through unparseable / already-formatted strings unchanged.
 * Accepts ISO, Date, epoch ms, `DD/MM/YYYY`, or already-formatted.
 */
export function formatDiscoveryDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return fromDate(v) || String(v);
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    return fromDate(d) || String(v);
  }
  const s = String(v).trim();
  if (!s) return "";
  if (ALREADY.test(s)) return s;
  const d = parseLoose(s);
  if (!d) return s;
  return fromDate(d) || s;
}

/** `DD Mon YY · HH:MM` */
export function formatDiscoveryDateTime(v: unknown): string {
  if (v == null || v === "") return "";
  const base = formatDiscoveryDate(v);
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "number") d = new Date(v);
  else d = parseLoose(String(v));
  if (!d || Number.isNaN(d.getTime())) return base;
  return `${fromDate(d)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Range `03–05 Aug 26` (en dash, no spaces around dash when same month). */
export function formatDiscoveryDateRange(start: unknown, end: unknown): string {
  const a = start instanceof Date ? start : parseLoose(String(start ?? ""));
  const b = end instanceof Date ? end : parseLoose(String(end ?? ""));
  if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
    const left = formatDiscoveryDate(start);
    const right = formatDiscoveryDate(end);
    if (left && right) return `${left}–${right}`;
    return left || right || "";
  }
  if (
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  ) {
    return `${pad2(a.getDate())}–${pad2(b.getDate())} ${MON[a.getMonth()]} ${String(a.getFullYear()).slice(-2)}`;
  }
  return `${formatDiscoveryDate(a)}–${formatDiscoveryDate(b)}`;
}
