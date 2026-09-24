import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
import type { VendorPayableRow } from "@/lib/vendor-payables/load-payables";

export type CollectionsPageData = {
  asOf: string;
  invoices: CollectionInvoiceRow[];
  payables: VendorPayableRow[];
  clients: { id: string; name: string }[];
  receipts: { client_id: string; currency: string; amount: number; paid_at: string | null }[];
  warnings: string[];
  contacts: Record<string, string>;
  dueDates: Record<string, string>;
  vendorIos: Record<string, string>;
  assignmentClients: Record<string, string>;
};

export const COLLECTION_TABS = [
  ["dash", "Collections dashboard"], ["aging", "A/R aging"],
  ["overdue", "Overdue management"], ["stmt", "Client statements"],
  ["fcast", "Collections forecast"], ["record", "Record client payment"],
  ["pay", "Vendor payables"],
] as const;
export type CollectionsTab = typeof COLLECTION_TABS[number][0];
export function collectionTab(value: string | null): CollectionsTab {
  const aliases: Record<string, CollectionsTab> = { dashboard: "dash", statements: "stmt", forecast: "fcast", allocation: "record", payables: "pay" };
  return COLLECTION_TABS.some(([key]) => key === value) ? value as CollectionsTab : aliases[value ?? ""] ?? "dash";
}
export const BUCKETS = ["Current", "1–30", "31–60", "61–90", "90+"];
export const money = (value: number) => value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function dateLabel(value: string | null | undefined) {
  if (!value) return "not set";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "not set" : `${String(d.getUTCDate()).padStart(2, "0")} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}
export function daysOverdue(due: string | null, asOf: string): number | null {
  if (!due) return null;
  const end = Date.parse(asOf.slice(0, 10));
  const start = Date.parse(due.slice(0, 10));
  return Number.isFinite(start) ? Math.max(0, Math.floor((end - start) / 86400000)) : null;
}
export function bucketIndex(due: string | null, asOf: string): number | null {
  const days = daysOverdue(due, asOf);
  return days === null ? null : days === 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
}
export function summarizeInvoices(rows: CollectionInvoiceRow[], asOf: string) {
  const buckets = BUCKETS.map(() => ({ amount: 0, count: 0 }));
  const open = rows.filter(r => r.outstanding > 0);
  let total = 0, overdue = 0, undated = 0;
  for (const row of open) {
    total += row.outstanding;
    const index = bucketIndex(row.due_date, asOf);
    if (index === null) undated += 1;
    else {
      buckets[index].amount += row.outstanding;
      buckets[index].count += 1;
      if (index > 0) overdue += row.outstanding;
    }
  }
  return { buckets, total, overdue, undated, count: open.length, percent: total > 0 ? overdue / total * 100 : null };
}
export function groupCurrency<T extends { currency: string }>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const code = row.currency?.trim().toUpperCase() || "Unspecified";
    groups.set(code, [...(groups.get(code) ?? []), row]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
