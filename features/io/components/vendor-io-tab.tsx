"use client";

import { useMemo } from "react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableCellMono,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { formatOperationalAmount } from "@/features/campaigns/components/assignment-hierarchy/operational-amount";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { VendorIoRowContextMenu } from "@/features/io/components/vendor-io-row-context-menu";
import { VendorIoUngenerateTrigger } from "@/features/io/components/vendor-io-ungenerate-dialog";
import { sendVendorIoAction } from "@/features/io/actions";
import type { VendorIoRow } from "@/features/io/types";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  campaignId: string;
  rows: VendorIoRow[];
};

export function VendorIoTab({ campaignId, rows }: Props) {
  const [state, formAction, pending] = useActionState(sendVendorIoAction, INITIAL_STATE);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [rows]
  );

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <CampaignOperationalSectionHeader
          title="Vendor IO"
          description="Auto-generated per assignment when status becomes assigned/confirmed. IO status never blocks campaign execution."
        />
      }
    >
      {sorted.length === 0 ? (
        <p className="px-4 py-8 text-[11px] text-muted-foreground">
          No assignment IO drafts generated yet.
        </p>
      ) : (
        <CampaignOperationalTable>
          <CampaignOperationalTableHeader>
            <CampaignOperationalTableHeaderRow>
              <CampaignOperationalTableHead>IO #</CampaignOperationalTableHead>
              <CampaignOperationalTableHead>Assignment</CampaignOperationalTableHead>
              <CampaignOperationalTableHead>Influencer</CampaignOperationalTableHead>
              <CampaignOperationalTableHead className="text-right">Amount</CampaignOperationalTableHead>
              <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
              <CampaignOperationalTableHead>Sent</CampaignOperationalTableHead>
              <CampaignOperationalTableHead>Approved</CampaignOperationalTableHead>
              <CampaignOperationalTableHead className="text-right">Actions</CampaignOperationalTableHead>
            </CampaignOperationalTableHeaderRow>
          </CampaignOperationalTableHeader>
          <CampaignOperationalTableBody>
            {sorted.map((row) => (
              <VendorIoRowContextMenu key={row.id} row={row}>
                <CampaignOperationalTableRow>
                  <CampaignOperationalTableCellMono>
                    {row.document_number ?? "—"}
                  </CampaignOperationalTableCellMono>
                  <CampaignOperationalTableCellMono>
                    {row.assignment_document_number ?? "—"}
                  </CampaignOperationalTableCellMono>
                  <CampaignOperationalTableCell>{row.influencer_name}</CampaignOperationalTableCell>
                  <CampaignOperationalTableCellAmount>
                    {formatOperationalAmount(row.amount)}
                  </CampaignOperationalTableCellAmount>
                  <CampaignOperationalTableCell>
                    <IoStatusBadge status={row.status} />
                  </CampaignOperationalTableCell>
                  <CampaignOperationalTableCell className="text-muted-foreground">
                    {row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"}
                  </CampaignOperationalTableCell>
                  <CampaignOperationalTableCell className="text-muted-foreground">
                    {row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}
                  </CampaignOperationalTableCell>
                  <CampaignOperationalTableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/ios/vendor?campaign=${campaignId}&io=${row.id}`}>View</a>
                      </Button>
                      <form action={formAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input
                          type="hidden"
                          name="campaign_header_id"
                          value={row.campaign_header_id}
                        />
                        <Button size="sm" type="submit" disabled={pending}>
                          {row.status === "sent" ? "Resend" : "Send"}
                        </Button>
                      </form>
                      <VendorIoUngenerateTrigger
                        row={row}
                        disabled={!row.ungenerate_eligible}
                        title={row.ungenerate_ineligible_reason ?? undefined}
                      />
                    </div>
                  </CampaignOperationalTableCell>
                </CampaignOperationalTableRow>
              </VendorIoRowContextMenu>
            ))}
          </CampaignOperationalTableBody>
        </CampaignOperationalTable>
      )}
    </OperationalTableSection>
  );
}
