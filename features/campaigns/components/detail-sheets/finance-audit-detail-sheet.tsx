"use client";

import { format } from "date-fns";

import { DocumentNumber } from "@/components/ui/document-number";
import {
  DetailField,
  DetailPanelHeader,
  DetailPill,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import type { FinanceAuditTimelineEntry } from "@/lib/finance/queries/finance-audit";
import { initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";

type FinanceAuditDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: FinanceAuditTimelineEntry | null;
  campaignName: string;
};

export function FinanceAuditDetailSheet({
  open,
  onOpenChange,
  row,
  campaignName,
}: FinanceAuditDetailSheetProps) {
  const actorName = row?.actor_name ?? "System";
  const documentNumber =
    typeof row?.payload.document_number === "string" ? row.payload.document_number : null;

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Finance audit details"
      description={`Finance audit event for ${campaignName}`}
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading audit details…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {campaignName}
                <span className="text-muted-foreground/60"> / </span>
                <span className="text-foreground/80">{row.label}</span>
              </>
            }
            avatarInitials={initialsFromName(actorName)}
            title={row.label}
            badges={
              <>
                <DetailPill className="capitalize">{row.entity_type}</DetailPill>
                {documentNumber ? (
                  <DocumentNumber
                    value={documentNumber}
                    className="text-[11px] text-muted-foreground"
                  />
                ) : null}
              </>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="px-1">
              <DetailField label="Event">{row.label}</DetailField>
              <DetailField label="Event code">
                <DetailPill>{row.event}</DetailPill>
              </DetailField>
              <DetailField label="Entity type" valueClassName="capitalize">
                {row.entity_type}
              </DetailField>
              <DetailField label="Entity ID">
                {row.entity_id ?? "—"}
              </DetailField>
              <DetailField label="Actor">{actorName}</DetailField>
              <DetailField label="When">
                {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
              </DetailField>
              {documentNumber ? (
                <DetailField label="Document #">
                  <DocumentNumber value={documentNumber} />
                </DetailField>
              ) : null}
            </div>
          </div>
        </>
      )}
    </OperationalDetailSheet>
  );
}
