"use client";

import { format } from "date-fns";
import Link from "next/link";
import { ReceiptIcon } from "lucide-react";

import { CreatorQuotationPriceReferencePanel } from "@/components/creator/creator-quotation-price-reference-panel";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorQuotationsTab({
  workspace,
  onCancel,
}: {
  workspace: VendorWorkspace;
  onCancel?: () => void;
}) {
  const history = workspace.quotation_history ?? [];

  return (
    <VendorProfileTabShell
      title="Quotations"
      description="Quoted rates and historical prices for this commercial creator."
      onCancel={onCancel}
    >
      <div className="space-y-4 px-4 md:px-5">
        <CreatorQuotationPriceReferencePanel
          reference={workspace.quotation_price_reference}
        />

        <VendorFormSection
          icon={ReceiptIcon}
          title="Quotation history"
          description="Line-level quotes linked to this creator."
        >
          {history.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              No quotation history yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead className="border-b text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Quotation</th>
                    <th className="px-2 py-2 font-medium">Deliverables</th>
                    <th className="px-2 py-2 font-medium">Rate</th>
                    <th className="px-2 py-2 font-medium">Quoted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((row) => (
                    <tr key={`${row.quotation_id}-${row.quoted_at}-${row.cost}`}>
                      <td className="px-2 py-2.5">
                        <Link
                          href={`/quotations/${row.quotation_id}`}
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {row.quotation_serial ?? row.quotation_name ?? "Quotation"}
                        </Link>
                        {row.quotation_name && row.quotation_serial ? (
                          <p className="text-[11px] text-muted-foreground">
                            {row.quotation_name}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">
                        {row.deliverable_summary}
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">
                        {row.cost.toLocaleString()} {row.cost_currency}
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground">
                        {format(new Date(row.quoted_at), "dd MMM yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </VendorFormSection>
      </div>
    </VendorProfileTabShell>
  );
}
