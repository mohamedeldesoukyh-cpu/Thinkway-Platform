/** Design spec §3 — one date format everywhere: `DD Mon YY`. */

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

const MISSING_LABEL = "not set";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function out(d: number, month: string, y: string | number, t?: string): string {
  return `${pad(d)} ${month} ${String(y).slice(-2)}${t ? ` · ${t}` : ""}`;
}

/**
 * Spec `D()` — empty string when missing. Accepts the live platform's mixed inputs.
 * Extra patterns (ISO datetime, `DD.MM.YYYY`) are mapped onto the same output.
 */
export function formatDesignDateRaw(value: unknown): string {
  if (value == null) return "";
  const x = String(value).trim();
  if (!x || x === "—" || x === MISSING_LABEL) return "";

  let m: RegExpMatchArray | null;
  if ((m = x.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/))) {
    const month = MON[Number(m[2]) - 1];
    if (!month) return x;
    return out(Number(m[3]), month, m[1], `${m[4]}:${m[5]}`);
  }
  if ((m = x.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    const month = MON[Number(m[2]) - 1];
    if (!month) return x;
    return out(Number(m[3]), month, m[1]);
  }
  if ((m = x.match(/^(\d{2})\.(\d{2})\.(\d{4})$/))) {
    const month = MON[Number(m[2]) - 1];
    if (!month) return x;
    return out(Number(m[1]), month, m[3]);
  }
  if ((m = x.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}:\d{2}))?/))) {
    const month = MON[Number(m[2]) - 1];
    if (!month) return x;
    return out(Number(m[1]), month, m[3], m[4]);
  }
  if (
    (m = x.match(
      /^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{2}:\d{2}))?/
    ))
  ) {
    return out(Number(m[2]), m[1], m[3], m[4]);
  }
  if ((m = x.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{2}:\d{2})/))) {
    return out(Number(m[2]), m[1], 2026, m[3]);
  }
  if (
    (m = x.match(
      /^(\d{1,2})\s*([A-Z][a-z]{2})\s*[–-]\s*(\d{1,2})\s*([A-Z][a-z]{2})$/
    ))
  ) {
    return m[2] === m[4]
      ? `${pad(Number(m[1]))}–${pad(Number(m[3]))} ${m[2]} 26`
      : `${pad(Number(m[1]))} ${m[2]} – ${pad(Number(m[3]))} ${m[4]} 26`;
  }
  if ((m = x.match(/^([A-Z][a-z]{2})\s+(\d{2})$/))) {
    return `${m[1]} ${m[2]}`;
  }
  return x;
}

export function isDesignDateMissing(value: unknown): boolean {
  return formatDesignDateRaw(value) === "";
}

/** Display helper — missing dates are `not set`, never `—`. */
export function formatDesignDate(value: unknown): string {
  const raw = formatDesignDateRaw(value);
  return raw === "" ? MISSING_LABEL : raw;
}

export function formatDesignDateRange(
  start: unknown,
  end: unknown
): string {
  const a = formatDesignDateRaw(start);
  const b = formatDesignDateRaw(end);
  if (!a && !b) return MISSING_LABEL;
  if (!b || a === b) return a || MISSING_LABEL;
  if (!a) return b;

  const parseParts = (s: string) => {
    const m = s.match(/^(\d{2}) ([A-Z][a-z]{2}) (\d{2})(?: · .+)?$/);
    if (!m) return null;
    return { d: m[1], mon: m[2], yy: m[3] };
  };
  const left = parseParts(a);
  const right = parseParts(b);
  if (left && right && left.mon === right.mon && left.yy === right.yy) {
    return `${left.d}–${right.d} ${left.mon} ${left.yy}`;
  }
  return `${a} – ${b}`;
}

export const DESIGN_DATE_MISSING_LABEL = MISSING_LABEL;
