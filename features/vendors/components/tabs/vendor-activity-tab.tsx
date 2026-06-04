"use client";

import { format } from "date-fns";

import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  CampaignOperationalTable,
  CampaignOperationalTableBody,
  CampaignOperationalTableCell,
  CampaignOperationalTableHead,
  CampaignOperationalTableHeader,
  CampaignOperationalTableHeaderRow,
  CampaignOperationalTableRow,
} from "@/features/campaigns/components/campaign-operational-table";
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorActivityTab({ workspace }: { workspace: VendorWorkspace }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Activity & audit
            </h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Profile edits, assignments, and operational changes.
            </p>
          </div>
        }
      >
        {workspace.activity.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-muted-foreground md:px-5">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/40 px-4 md:px-5">
            {workspace.activity.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-4 last:pb-4"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-medium capitalize text-foreground">
                    {item.summary}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.actor?.full_name ?? item.actor?.email ?? "System"}
                  </p>
                </div>
                <time className="shrink-0 text-[10px] text-muted-foreground">
                  {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </OperationalTableSection>

      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Recent deliverables
          </h2>
        }
      >
        {workspace.deliverables.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-muted-foreground md:px-5">
            No deliverables.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <CampaignOperationalTable>
              <CampaignOperationalTableHeader>
                <CampaignOperationalTableHeaderRow>
                  <CampaignOperationalTableHead>Deliverable</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead>Campaign</CampaignOperationalTableHead>
                  <CampaignOperationalTableHead>Status</CampaignOperationalTableHead>
                </CampaignOperationalTableHeaderRow>
              </CampaignOperationalTableHeader>
              <CampaignOperationalTableBody>
                {workspace.deliverables.slice(0, 10).map((d) => (
                  <CampaignOperationalTableRow key={d.id}>
                    <CampaignOperationalTableCell>
                      <span className="font-medium text-foreground">{d.title}</span>
                      {d.document_number ? (
                        <p className="text-[10px] text-muted-foreground">
                          <DocumentNumber value={d.document_number} />
                        </p>
                      ) : null}
                    </CampaignOperationalTableCell>
                    <CampaignOperationalTableCell className="text-muted-foreground">
                      {d.campaign_name ?? "—"}
                    </CampaignOperationalTableCell>
                    <CampaignOperationalTableCell className="capitalize text-muted-foreground">
                      {d.status.replace(/_/g, " ")}
                    </CampaignOperationalTableCell>
                  </CampaignOperationalTableRow>
                ))}
              </CampaignOperationalTableBody>
            </CampaignOperationalTable>
          </div>
        )}
      </OperationalTableSection>
    </div>
  );
}
