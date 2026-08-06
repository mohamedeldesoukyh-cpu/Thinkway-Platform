"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarRangeIcon,
  CopyIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CancelCampaignDialog } from "@/components/campaigns/cancel-campaign-dialog";
import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher-lazy";
import type { CampaignSeed } from "@/features/campaign-outputs/hydration/hydration-types";
import { ClientIoCampaignChrome } from "@/features/io/components/client-io-campaign-chrome";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { campaignMediaPlanPath } from "@/lib/routing/entity-paths";

type CampaignHeroActionsProps = {
  workspace: CampaignWorkspace;
  studioSeed: CampaignSeed;
  studioWorkspace: { type: "campaign"; id: string };
  onNavigateToTab: (tab: CampaignWorkspaceTabId) => void;
  onDuplicate: () => void;
  onOpenDetails: () => void;
  trailing?: ReactNode;
};

/**
 * Highest-frequency campaign actions only.
 * Workspace navigation lives on Enterprise Tabs — not duplicated here.
 * Planning Board stays hidden until Release 2.2a.
 */
export function CampaignHeroActions({
  workspace,
  studioSeed,
  studioWorkspace,
  onNavigateToTab,
  onDuplicate,
  onOpenDetails,
}: CampaignHeroActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);

  return (
    <>
      <OpenCampaignStudioLauncher
        seed={studioSeed}
        workspace={studioWorkspace}
        tab="studio"
        variant="primary"
        buttonClassName="thinkway-campaign-btn thinkway-campaign-btn-primary h-[38px] px-[15px] text-[13px] font-semibold"
      />
      <Button asChild variant="outline" size="sm" className="thinkway-campaign-btn">
        <Link
          href={campaignMediaPlanPath({
            id: workspace.id,
            document_number: workspace.document_number,
            name: workspace.name,
          })}
        >
          <CalendarRangeIcon className="size-3.5" />
          Media Plans
        </Link>
      </Button>
      <ClientIoCampaignChrome
        io={workspace.client_io}
        campaignId={workspace.id}
        contactRecipients={workspace.client_io_send_recipients.map((r) => ({
          label: r.label,
          email: r.email,
        }))}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="thinkway-campaign-btn size-[38px] p-0"
            aria-label="More campaign actions"
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a
              href={`/api/campaigns/${workspace.id}/performance/document?format=pdf&download=1`}
            >
              <FileTextIcon className="size-4" />
              Generate Performance Report
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <CopyIcon className="size-4" />
            Duplicate campaign
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onNavigateToTab("overview")}>
            <PencilIcon className="size-4" />
            Edit header (Overview)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenDetails}>Campaign details</DropdownMenuItem>
          {workspace.status !== "cancelled" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setCancelOpen(true);
                }}
              >
                Cancel campaign
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {workspace.status !== "cancelled" ? (
        <CancelCampaignDialog
          campaignId={workspace.id}
          campaignName={workspace.name}
          hideTrigger
          open={cancelOpen}
          onOpenChange={setCancelOpen}
        />
      ) : null}
    </>
  );
}
