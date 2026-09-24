import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";

export type CollectionsPageData = {
  asOf: string;
  invoices: CollectionInvoiceRow[];
  clients: { id: string; name: string }[];
  paymentHistory?: CollectionPayment[];
  receipts: { client_id: string; currency: string; amount: number; paid_at: string | null }[];
  warnings: string[];
  contacts: Record<string, string>;
};

export const COLLECTION_TABS = [
  ["dash", "Collections dashboard"], ["aging", "A/R aging"],
  ["overdue", "Overdue management"], ["stmt", "Client statements"],
  ["fcast", "Collections forecast"], ["record", "Record client payment"],
] as const;
export type CollectionsTab = typeof COLLECTION_TABS[number][0];
export function collectionTab(value: string | null): CollectionsTab {
  const aliases: Record<string, CollectionsTab> = { dashboard: "dash", statements: "stmt", forecast: "fcast", allocation: "record" };
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

// Sort within the selected presentation currency, never by adding native currencies.
export function statementClientList(clients: CollectionsPageData["clients"], invoices: CollectionInvoiceRow[], currency: string, all: boolean, search: string) {
  const rows = clients.map(c => {
    const own = invoices.filter(r => r.client_id === c.id);
    return { ...c, rows: own, balance: own.some(r => r.outstanding > 0), amount: own.filter(r => r.currency === currency).reduce((sum, r) => sum + r.outstanding, 0) };
  }).sort((a, b) => b.amount - a.amount || Number(b.balance) - Number(a.balance) || a.name.localeCompare(b.name));
  return { withBalance: rows.filter(r => r.balance).length, visible: rows.filter(r => (all || r.balance) && r.name.toLowerCase().includes(search.trim().toLowerCase())) };
}

export type CollectionPayment = {id:string;document_number:string;invoice_id:string;client_id:string;amount:number;currency:string;paid_at:string|null;payment_method:string;reference_number:string|null;notes:string|null;status:string;revision:number};
