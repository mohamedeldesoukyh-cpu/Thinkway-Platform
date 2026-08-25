"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  DetailField,
  DetailPanelHeader,
  DetailPill,
  DetailTabList,
  DETAIL_TAB_TRIGGER_CLASS,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import { DeliverableBillingBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-billing-badge";
import { DeliverableWorkflowBadge } from "@/features/campaigns/components/assignment-hierarchy/deliverable-workflow-badge";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import type { OperationalDeliverableExplorerRow } from "@/features/campaigns/types/operational-deliverable-explorer";
import { formatAssignmentDetailDate, initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type DeliverableDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: OperationalDeliverableExplorerRow | null;
  campaignName: string;
  onUploadContent?: () => void;
};

export function DeliverableDetailSheet({
  open,
  onOpenChange,
  row,
  campaignName,
  onUploadContent,
}: DeliverableDetailSheetProps) {
  const title = row?.label ?? "Deliverable";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${title} deliverable details`}
      description={`Deliverable details for ${campaignName}`}
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading deliverable details…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {campaignName}
                <span className="text-muted-foreground/60"> / </span>
                <span className="text-foreground/80">{row.assignment_title}</span>
              </>
            }
            avatarInitials={initialsFromName(row.creator_name ?? row.label)}
            title={row.label}
            badges={
              <>
                <DeliverableWorkflowBadge status={row.workflow_status} />
                {row.billing_status === "legacy" ? (
                  <Badge variant="outline" className="text-[10px]">
                    Legacy
                  </Badge>
                ) : (
                  <DeliverableBillingBadge
                    status={row.billing_status as AssignmentDeliverableBillingStatus}
                  />
                )}
                <DetailPill>{row.platform_label}</DetailPill>
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
                <TabsTrigger value="workflow" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Workflow
                </TabsTrigger>
                <TabsTrigger value="content" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Content
                </TabsTrigger>
              </TabsList>
            </DetailTabList>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="general" className="mt-0 outline-none">
                <div className="px-1">
                  <DetailField label="Assignment">{row.assignment_title}</DetailField>
                  <DetailField label="Creator">
                    {row.influencer_id ? (
                      <Link
                        href={`/vendors/${row.influencer_id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {row.creator_name ?? "—"}
                      </Link>
                    ) : (
                      row.creator_name ?? "—"
                    )}
                  </DetailField>
                  <DetailField label="Type">
                    <DetailPill>{row.deliverable_type_label}</DetailPill>
                  </DetailField>
                  <DetailField label="Platform">
                    <DetailPill>{row.platform_label}</DetailPill>
                  </DetailField>
                  <DetailField label="Due date">
                    {formatAssignmentDetailDate(row.live_date)}
                  </DetailField>
                  {row.sequence_number != null ? (
                    <DetailField label="Sequence">#{row.sequence_number}</DetailField>
                  ) : null}
                  <DetailField label="Row kind" valueClassName="capitalize">
                    {row.row_kind}
                  </DetailField>
                </div>
              </TabsContent>
              <TabsContent value="workflow" className="mt-0 outline-none">
                <div className="px-1">
                  <DetailField label="Workflow status">
                    <DeliverableWorkflowBadge status={row.workflow_status} />
                  </DetailField>
                  <DetailField label="Billing status">
                    {row.billing_status === "legacy" ? (
                      <Badge variant="outline" className="text-[10px]">
                        Legacy
                      </Badge>
                    ) : (
                      <DeliverableBillingBadge
                        status={row.billing_status as AssignmentDeliverableBillingStatus}
                      />
                    )}
                  </DetailField>
                  <DetailField label="Publication status" valueClassName="capitalize">
                    {row.publication_status?.replace(/_/g, " ") ?? "—"}
                  </DetailField>
                  <DetailField label="Synthetic row">
                    {row.is_synthetic ? "Yes" : "No"}
                  </DetailField>
                  <DetailField label="Virtual post">
                    {row.is_virtual_post ? "Yes" : "No"}
                  </DetailField>
                </div>
              </TabsContent>
              <TabsContent value="content" className="mt-0 outline-none">
                <div className="px-1">
                  <DetailField label="Notes" valueClassName="max-w-[60%] text-left">
                    {row.notes?.trim() ? (
                      <span className="whitespace-pre-wrap">{row.notes}</span>
                    ) : (
                      "—"
                    )}
                  </DetailField>
                  {onUploadContent ? (
                    <div className="mt-4">
                      <Button
                        type="button"
                        size="sm"
                        className="thinkway-campaign-btn thinkway-campaign-btn-primary h-[30px] text-[11px]"
                        onClick={() => {
                          onOpenChange(false);
                          onUploadContent();
                        }}
                      >
                        Upload content for client review
                      </Button>
                    </div>
                  ) : null}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </OperationalDetailSheet>
  );
}
