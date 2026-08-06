import {
  isClientIoAssignmentSnapshotV1,
  type ClientIoAssignmentSnapshotV1,
} from "@/lib/io/client-io-assignment-snapshot";
import { formatMoneyDetail } from "@/lib/finance/currency-format";

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
  // null/undefined must not coerce via Number(null) === 0.
  if (amount == null) return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return formatMoneyDetail(value, currencyCode);
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
    (sum, line) =>
      sum + (Number(line.revenue_before_vat ?? line.revenue) || 0),
    0
  );
  return { amount, currencyCode };
}

/** Live preview total from selected composer assignments (before snapshot hydrate). */
export function sumClientIoComposerAgreedAmount(
  assignments: Array<{
    id: string;
    revenue_before_vat?: number | null;
    currency_code?: string | null;
  }>,
  selectedAssignmentIds: string[] | null | undefined,
  fallbackCurrencyCode?: string | null
): { amount: number; currencyCode: string } | null {
  const selected =
    selectedAssignmentIds && selectedAssignmentIds.length > 0
      ? assignments.filter((row) => selectedAssignmentIds.includes(row.id))
      : assignments;
  if (!selected.length) return null;
  // Campaign/workspace currency wins — line codes may be stale defaults.
  const currencyCode =
    fallbackCurrencyCode?.trim() ||
    selected[0]?.currency_code?.trim() ||
    "USD";
  const amount = selected.reduce(
    (sum, row) => sum + (Number(row.revenue_before_vat) || 0),
    0
  );
  return { amount, currencyCode };
}
