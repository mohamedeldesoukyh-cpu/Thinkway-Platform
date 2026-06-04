import Link from "next/link";

import { DocumentNumber } from "@/components/ui/document-number";

import { Badge } from "@/components/ui/badge";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableCellAmount,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { AssignmentStatusBadge } from "@/features/campaigns/components/assignment-status-badge";
import { LINE_BILLING_STATUS_LABELS, VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";
import { cn } from "@/lib/utils";

export function VendorAssignmentsTab({ workspace }: { workspace: VendorWorkspace }) {
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Assignment history
            </h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Campaign lines, deliverables, commercial terms, and operational status.
            </p>
          </div>
        }
      >
        {workspace.assignments.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-muted-foreground md:px-5">
            No campaign assignments yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <CampaignOperationalTable>
              <CampaignOperationalTableHeader>
                <CampaignOperationalTableHeaderRow>
                  <CampaignOperationalTableHead>Campaign</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead>Assignment line</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead>Ops status</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead>Billing</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead className="text-right">
                    Revenue
                  </CampaignOperationalTableHead>
                  <CampaignOperationalTableHead className="text-right">Cost</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead className="text-right">GP</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead>Payout</CampaignOperationalTableHead>
                </CampaignOperationalTableHeaderRow>
              </CampaignOperationalTableHeader>
              <CampaignOperationalTableBody>
                {workspace.assignments.map((a) => (
                  <CampaignOperationalTableRow key={a.id}>
                    <CampaignOperationalTableCell>
                      {a.campaign_id ? (
                        <Link
                          href={`/campaigns/${a.campaign_id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {a.campaign_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {a.campaign_document_number ? (
                        <p className="text-[10px] text-muted-foreground">
                          <DocumentNumber value={a.campaign_document_number} />
                        </p>
                      ) : null}
                    </CampaignOperationalTableCell>
                    <CampaignOperationalTableCell>
                      <span className="font-medium text-foreground">{a.line_name ?? "—"}</span>
                      {a.line_document_number ? (
                        <p className="text-[10px] text-muted-foreground">
                          <DocumentNumber value={a.line_document_number} />
                        </p>
                      ) : null}
                    </CampaignOperationalTableCell>
                    <CampaignOperationalTableCell>
                      {a.assignment_status ? (
                        <AssignmentStatusBadge
                          status={
                            a.assignment_status as import("@/features/campaigns/types").CampaignLineAssignmentStatus
                          }
                        />
                      ) : (
                        "—"
                      )}
                    </CampaignOperationalTableCell>
                    <CampaignOperationalTableCell>
                      <Badge
                        variant="outline"
                        className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
                      >
                        {a.billing_status
                          ? LINE_BILLING_STATUS_LABELS[a.billing_status]
                          : "—"}
                      </Badge>
                    </CampaignOperationalTableCell>
                    <CampaignOperationalTableCellAmount>
                      {formatMoney(a.revenue, a.currency || currency)}
                    </CampaignOperationalTableCellAmount>
                    <CampaignOperationalTableCellAmount>
                      {formatMoney(a.cost, a.currency || currency)}
                    </CampaignOperationalTableCellAmount>
                    <CampaignOperationalTableCellAmount>
                      {formatMoney(a.gp, a.currency || currency)}
                    </CampaignOperationalTableCellAmount>
                    <CampaignOperationalTableCell>
                      {a.vendor_payment_status ? (
                        <Badge
                          variant="secondary"
                          className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
                        >
                          {VENDOR_PAYMENT_STATUS_LABELS[a.vendor_payment_status]}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </CampaignOperationalTableCell>
                  </CampaignOperationalTableRow>
                ))}
              </CampaignOperationalTableBody>
            </CampaignOperationalTable>
          </div>
        )}
      </OperationalTableSection>

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Platform performance summary
          </h2>
        }
      >
        <p className="px-4 py-4 text-[11px] leading-snug text-muted-foreground md:px-5">
          GP contribution: {formatMoney(workspace.financials.total_gp, currency)} (
          {formatPercent(workspace.financials.margin_percent)} margin) across{" "}
          {workspace.counts.assignments} assignment(s).
        </p>
      </OperationalTableSection>
    </div>
  );
}
