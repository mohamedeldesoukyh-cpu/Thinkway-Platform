"use client";

import { format } from "date-fns";

import {
  DetailField,
  DetailPanelHeader,
  DetailPill,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import type { CampaignActivityItem } from "@/features/campaigns/types";
import { initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";

type ActivityDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CampaignActivityItem | null;
  campaignName: string;
};

export function ActivityDetailSheet({
  open,
  onOpenChange,
  row,
  campaignName,
}: ActivityDetailSheetProps) {
  const actorName = row?.actor?.full_name ?? row?.actor?.email ?? "System";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Activity details"
      description={`Activity details for ${campaignName}`}
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading activity details…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {campaignName}
                <span className="text-muted-foreground/60"> / </span>
                <span className="text-foreground/80 capitalize">{row.action}</span>
              </>
            }
            avatarInitials={initialsFromName(actorName)}
            title={<span className="capitalize">{row.summary}</span>}
            badges={
              <>
                <DetailPill className="capitalize">{row.entity_type}</DetailPill>
                <DetailPill className="capitalize">{row.action}</DetailPill>
              </>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="px-1">
              <DetailField label="Summary" valueClassName="capitalize text-left">
                {row.summary}
              </DetailField>
              <DetailField label="Action" valueClassName="capitalize">
                {row.action}
              </DetailField>
              <DetailField label="Entity" valueClassName="capitalize">
                {row.entity_type}
              </DetailField>
              <DetailField label="Actor">{actorName}</DetailField>
              <DetailField label="When">
                {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
              </DetailField>
            </div>
          </div>
        </>
      )}
    </OperationalDetailSheet>
  );
}
