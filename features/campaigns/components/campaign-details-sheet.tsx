"use client";

import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CampaignEditSheet } from "@/features/campaigns/components/campaign-edit-sheet";
import { CampaignOverviewDetails } from "@/features/campaigns/components/campaign-overview-details";
import { DocumentNumber } from "@/components/ui/document-number";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { formatPlatformLabel } from "@/features/campaigns/utils";
import type { CampaignWorkspace } from "@/features/campaigns/types";

type CampaignDetailsSheetProps = {
  workspace: CampaignWorkspace;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  currencyOptions: { value: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CampaignDetailsSheet({
  workspace,
  accountManagers,
  teams,
  currencyOptions,
  open,
  onOpenChange,
}: CampaignDetailsSheetProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <SheetHeader className="shrink-0 border-b px-6 py-5 text-left">
            <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
              <div className="space-y-1">
                <SheetTitle className="font-heading text-xl font-semibold">
                  {workspace.name}
                </SheetTitle>
                <SheetDescription className="text-xs tabular-nums">
                  <DocumentNumber value={workspace.document_number} />
                  {workspace.brand ? ` · ${workspace.brand.name}` : null}
                  {workspace.platform
                    ? ` · ${formatPlatformLabel(workspace.platform)}`
                    : null}
                </SheetDescription>
              </div>
              <CampaignStatusBadge status={workspace.status} />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setEditOpen(true)}
            >
              <PencilIcon data-icon="inline-start" />
              Edit campaign
            </Button>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <CampaignOverviewDetails workspace={workspace} layout="stack" />
          </div>
        </SheetContent>
      </Sheet>

      <CampaignEditSheet
        workspace={workspace}
        accountManagers={accountManagers}
        teams={teams}
        currencyOptions={currencyOptions}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
