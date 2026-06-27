import { DEFAULT_VALIDITY_DAYS } from "@/lib/domains/commercial/quotation-constants";

export function defaultValidityDateFromIssue(issueDate: string | Date): string {
  const base =
    typeof issueDate === "string"
      ? new Date(`${issueDate.slice(0, 10)}T00:00:00Z`)
      : issueDate;
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + DEFAULT_VALIDITY_DAYS);
  return next.toISOString().slice(0, 10);
}

export function validDaysRemaining(validityDate: string | null, asOf = new Date()): number | null {
  if (!validityDate) return null;
  const end = new Date(`${validityDate.slice(0, 10)}T23:59:59Z`);
  const ms = end.getTime() - asOf.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function isQuotationExpired(
  validityDate: string | null,
  asOf = new Date()
): boolean {
  const days = validDaysRemaining(validityDate, asOf);
  return days != null && days < 0;
}

export function formatValidityLabel(validityDate: string | null): string {
  const days = validDaysRemaining(validityDate);
  if (days == null) return "—";
  if (days < 0) return "Expired";
  if (days === 0) return "Valid until end of today";
  if (days === 1) return "Valid for 1 day";
  return `Valid for ${days} days`;
}

export function formatDateLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
