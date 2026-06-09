"use client";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  DetailField,
  DetailPanelHeader,
  DetailPill,
  DetailTabList,
  DETAIL_TAB_TRIGGER_CLASS,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import type { CampaignApprovalRow } from "@/features/campaigns/types";
import { initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ApprovalDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CampaignApprovalRow | null;
  campaignName: string;
};

function formatApprovalDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "MMM d, yyyy");
}

export function ApprovalDetailSheet({
  open,
  onOpenChange,
  row,
  campaignName,
}: ApprovalDetailSheetProps) {
  const title = row?.title ?? "Approval";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${title} approval details`}
      description={`Approval details for ${campaignName}`}
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading approval details…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {campaignName}
                <span className="text-muted-foreground/60"> / </span>
                <DocumentNumber value={row.document_number} className="text-foreground/80" />
              </>
            }
            avatarInitials={initialsFromName(row.assigned_to_name ?? row.title)}
            title={row.title}
            badges={
              <>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {row.status.replace(/_/g, " ")}
                </Badge>
                <DetailPill className="capitalize">{row.entity_type}</DetailPill>
                <DocumentNumber
                  value={row.document_number}
                  className="text-[11px] text-muted-foreground"
                />
              </>
            }
          />

          <Tabs defaultValue="general" className="flex min-h-0 flex-1 flex-col">
            <DetailTabList>
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-4 rounded-none bg-transparent p-0"
              >
                <TabsTrigger value="general" className={DETAIL_TAB_TRIGGER_CLASS}>
                  General
                </TabsTrigger>
                <TabsTrigger value="activity" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Activity
                </TabsTrigger>
              </TabsList>
            </DetailTabList>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="general" className="mt-0 outline-none">
                <div className="px-1">
                  <DetailField label="Approval #">
                    <DocumentNumber value={row.document_number} />
                  </DetailField>
                  <DetailField label="Entity type" valueClassName="capitalize">
                    {row.entity_type}
                  </DetailField>
                  <DetailField label="Assignee">{row.assigned_to_name ?? "—"}</DetailField>
                  <DetailField label="Status" valueClassName="capitalize">
                    {row.status.replace(/_/g, " ")}
                  </DetailField>
                </div>
              </TabsContent>
              <TabsContent value="activity" className="mt-0 outline-none">
                <div className="px-1">
                  <DetailField label="Due date">{formatApprovalDate(row.due_at)}</DetailField>
                  <DetailField label="Decided at">{formatApprovalDate(row.decided_at)}</DetailField>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </OperationalDetailSheet>
  );
}
