"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { LayoutDashboardIcon, MegaphoneIcon, MessageSquareIcon, PlusIcon } from "lucide-react";

import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher";
import { seedFromCampaign } from "@/features/campaign-outputs/hydration/seed-adapters";
import { workspaceHref } from "@/features/campaign-outputs/actions/campaign-workspace-message";
import type { StudioPickerCampaign, StudioPickerConversation } from "@/features/studio/queries/list-studio-picker-data";
import { cn } from "@/lib/utils";

type StudioCampaignPickerProps = {
  conversations: StudioPickerConversation[];
  campaigns: StudioPickerCampaign[];
};

function workspaceLabel(type: string): string {
  switch (type) {
    case "quotation":
      return "Quotation";
    case "shortlist":
      return "Shortlist";
    case "campaign":
      return "Campaign";
    case "discovery":
      return "Discovery";
    default:
      return "General";
  }
}

export function StudioCampaignPicker({ conversations, campaigns }: StudioCampaignPickerProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--tw-primary,#1D9E75)]/20 bg-[var(--tw-primary,#1D9E75)]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tw-primary,#1D9E75)]">
          <LayoutDashboardIcon className="size-3.5" aria-hidden />
          Campaign Studio
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Client-facing campaign workspaces
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Open Studio for strategy, outputs, and AI copilot — scoped to your quotation, shortlist, or
          live campaign. Resume a recent workspace or start from a campaign below.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">Recent workspaces</h2>
          <Link
            href="/ai"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--tw-primary,#1D9E75)] hover:underline"
          >
            <PlusIcon className="size-3.5" />
            New conversation
          </Link>
        </div>
        {conversations.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {conversations.map((item) => (
              <li key={item.id}>
                <Link
                  href={workspaceHref(item.id, "studio")}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <MessageSquareIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {workspaceLabel(item.workspaceType)}
                      {item.isPinned ? " · Pinned" : ""}
                      {" · "}
                      {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-[var(--tw-primary,#1D9E75)]">
                    Open Studio →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No studio workspaces yet. Start from a campaign below or open a{" "}
            <Link href="/discovery/quotations" className="font-medium text-[var(--tw-primary,#1D9E75)] hover:underline">
              quotation
            </Link>
            .
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">Open from campaign</h2>
          <Link
            href="/campaigns"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all campaigns
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <MegaphoneIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{campaign.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {campaign.documentNumber}
                    {campaign.brandName ? ` · ${campaign.brandName}` : ""}
                    {campaign.clientName ? ` · ${campaign.clientName}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OpenCampaignStudioLauncher
                  seed={seedFromCampaign({
                    name: campaign.name,
                    client: campaign.clientName ? { name: campaign.clientName } : null,
                    brand: campaign.brandName ? { name: campaign.brandName } : null,
                  })}
                  workspace={{ type: "campaign", id: campaign.id }}
                  tab="studio"
                  variant="primary"
                />
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className={cn(
                    "inline-flex h-[30px] items-center rounded-[var(--camp-radius,8px)] border border-border px-3 text-[11px] font-semibold text-foreground hover:bg-muted/50"
                  )}
                >
                  Campaign workspace
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
