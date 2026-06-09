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
import type { CampaignPublicationRow } from "@/features/campaigns/queries/publications";
import { formatAssignmentDetailDate, initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PublicationDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CampaignPublicationRow | null;
  campaignName: string;
};

export function PublicationDetailSheet({
  open,
  onOpenChange,
  row,
  campaignName,
}: PublicationDetailSheetProps) {
  const title = row?.publication_type_label ?? "Publication";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${title} publication details`}
      description={`Publication details for ${campaignName}`}
    >
      {!row ? (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
          Loading publication details…
        </div>
      ) : (
        <>
          <DetailPanelHeader
            breadcrumb={
              <>
                {campaignName}
                <span className="text-muted-foreground/60"> / </span>
                <span className="text-foreground/80">{row.platform_label}</span>
              </>
            }
            avatarInitials={initialsFromName(row.influencer_name ?? title)}
            title={row.publication_type_label}
            badges={
              <>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {row.status.replace(/_/g, " ")}
                </Badge>
                <DetailPill>{row.platform_label}</DetailPill>
                {row.auto_detected ? (
                  <DetailPill className="border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200">
                    Auto-detected
                  </DetailPill>
                ) : null}
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
                <TabsTrigger value="content" className={DETAIL_TAB_TRIGGER_CLASS}>
                  Content
                </TabsTrigger>
              </TabsList>
            </DetailTabList>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value="general" className="mt-0 outline-none">
                <div className="px-1">
                  <DetailField label="Creator">
                    {row.influencer_id ? (
                      <Link
                        href={`/vendors/${row.influencer_id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {row.influencer_name ?? "—"}
                      </Link>
                    ) : (
                      row.influencer_name ?? "—"
                    )}
                  </DetailField>
                  <DetailField label="Assignee">{row.assignee_name ?? "—"}</DetailField>
                  <DetailField label="Publication date">
                    {formatAssignmentDetailDate(row.publication_date)}
                  </DetailField>
                  <DetailField label="Status" valueClassName="capitalize">
                    {row.status.replace(/_/g, " ")}
                  </DetailField>
                  <DetailField label="Platform">
                    <DetailPill>{row.platform_label}</DetailPill>
                  </DetailField>
                  <DetailField label="Created">
                    {formatAssignmentDetailDate(row.created_at)}
                  </DetailField>
                </div>
              </TabsContent>
              <TabsContent value="content" className="mt-0 outline-none">
                <div className="px-1">
                  <DetailField label="Content URL" valueClassName="max-w-[60%]">
                    {row.content_url ? (
                      <a
                        href={row.content_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all hover:text-primary hover:underline"
                      >
                        {row.content_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </DetailField>
                  <DetailField label="Caption" valueClassName="max-w-[60%] text-left">
                    {row.caption?.trim() ? (
                      <span className="whitespace-pre-wrap">{row.caption}</span>
                    ) : (
                      "—"
                    )}
                  </DetailField>
                  <DetailField label="Hashtags" valueClassName="max-w-[60%]">
                    {row.hashtags?.trim() || "—"}
                  </DetailField>
                  <DetailField label="Notes" valueClassName="max-w-[60%] text-left">
                    {row.notes?.trim() ? (
                      <span className="whitespace-pre-wrap">{row.notes}</span>
                    ) : (
                      "—"
                    )}
                  </DetailField>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </OperationalDetailSheet>
  );
}
