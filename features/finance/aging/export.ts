import { AGING_BUCKET_LABELS } from "@/lib/collections/aging";
import type { AgingBucket } from "@/lib/collections/aging/types";

import type { AgingWorkspaceData } from "./types";

const BUCKET_KEYS: AgingBucket[] = [
  "current",
  "1_30",
  "31_60",
  "61_90",
  "90_plus",
];

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildAgingSummaryCsv(data: AgingWorkspaceData): string {
  const headers = [
    "Client",
    "Currency",
    "Total outstanding",
    ...BUCKET_KEYS.map((b) => AGING_BUCKET_LABELS[b]),
    "Invoice count",
  ];

  const rows = data.client_rows.map((row) => [
    row.client_name,
    row.currency,
    row.total_outstanding.toFixed(2),
    ...BUCKET_KEYS.map((b) => row.buckets[b].toFixed(2)),
    row.invoice_count,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

export function buildAgingDetailCsv(data: AgingWorkspaceData): string {
  const headers = [
    "Client",
    "Currency",
    "Invoice",
    "Issue date",
    "Due date",
    "Days aged",
    "Aging bucket",
    "Outstanding",
  ];

  const rows = data.detail_rows.flatMap((client) =>
    client.invoices.map((inv) => [
      client.client_name,
      client.currency,
      inv.document_number ?? inv.id,
      inv.issue_date ?? "",
      inv.due_date ?? "",
      inv.days_aged,
      AGING_BUCKET_LABELS[inv.aging_bucket],
      inv.outstanding.toFixed(2),
    ])
  );

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

export function buildAgingCsv(data: AgingWorkspaceData): string {
  return data.view === "detailed"
    ? buildAgingDetailCsv(data)
    : buildAgingSummaryCsv(data);
}
