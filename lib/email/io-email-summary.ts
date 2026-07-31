import {
  isClientIoAssignmentSnapshotV1,
  type ClientIoAssignmentSnapshotV1,
} from "@/lib/io/client-io-assignment-snapshot";

export function formatIoCampaignDuration(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  const start = formatIoShortDate(startDate);
  const end = formatIoShortDate(endDate);
  if (start === "—" && end === "—") return "—";
  if (start === "—") return end;
  if (end === "—") return start;
  return `${start} – ${end}`;
}

export function formatIoShortDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatIoAgreedAmount(
  amount: number | null | undefined,
  currencyCode: string | null | undefined
): string {
  const value = Number(amount);
  const currency = currencyCode?.trim() || "USD";
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function sumClientIoSnapshotAgreedAmount(
  snapshot: unknown
): { amount: number; currencyCode: string } | null {
  if (!isClientIoAssignmentSnapshotV1(snapshot)) return null;
  return sumClientIoLinesAgreedAmount(snapshot);
}

export function sumClientIoLinesAgreedAmount(
  snapshot: Pick<ClientIoAssignmentSnapshotV1, "lines">
): { amount: number; currencyCode: string } | null {
  if (!snapshot.lines.length) return null;
  const currencyCode = snapshot.lines[0]?.currency_code?.trim() || "USD";
  const amount = snapshot.lines.reduce(
    (sum, line) => sum + (Number(line.revenue) || 0),
    0
  );
  return { amount, currencyCode };
}
