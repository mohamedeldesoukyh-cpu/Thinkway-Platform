import { csvEscapeRow } from "@/lib/security/csv-formula";

import type { VatWorkspaceData } from "./types";

export function buildVatAuditCsv(data: VatWorkspaceData, includeVatColumns = true) {
  const headers = includeVatColumns
    ? [
        "Invoice",
        "Issue date",
        "Client",
        "Country",
        "Revenue ex-VAT",
        "Output VAT",
        "Total inc-VAT",
        "Currency",
      ]
    : ["Invoice", "Issue date", "Client", "Revenue ex-VAT", "Currency"];

  const rows = data.invoices.map((inv) =>
    includeVatColumns
      ? [
          inv.document_number,
          inv.issue_date,
          inv.client_name,
          inv.country_code ?? "",
          inv.revenue_before_vat.toFixed(2),
          inv.output_vat.toFixed(2),
          inv.total_after_vat.toFixed(2),
          inv.currency,
        ]
      : [
          inv.document_number,
          inv.issue_date,
          inv.client_name,
          inv.revenue_before_vat.toFixed(2),
          inv.currency,
        ]
  );

  return [headers, ...rows].map((row) => csvEscapeRow(row)).join("\n");
}
