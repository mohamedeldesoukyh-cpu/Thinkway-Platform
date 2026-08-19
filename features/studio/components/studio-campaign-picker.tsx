"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboardIcon, MegaphoneIcon, PlusIcon } from "lucide-react";

import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher";
import { seedFromCampaign } from "@/features/campaign-outputs/hydration/seed-adapters";
import type { StudioPickerCampaign } from "@/features/studio/queries/list-studio-picker-data";
import type { StudioCampaignHistoryItem } from "@/features/studio/services/studio-campaign-history";
import { cn } from "@/lib/utils";

import { StudioCampaignHistoryList } from "./studio-campaign-history-list";
import {
  StudioNewCampaignDialog,
  type StudioNewCampaignMode,
} from "./studio-new-campaign-dialog";

type StudioCampaignPickerProps = {
  history: StudioCampaignHistoryItem[];
  campaigns: StudioPickerCampaign[];
  initialStart?: string | null;
};

function modeFromStart(start?: string | null): StudioNewCampaignMode {
  if (start === "upload" || start === "write" || start === "paste") return start;
  return "choose";
}

export function StudioCampaignPicker({
  history,
  campaigns,
  initialStart = null,
}: StudioCampaignPickerProps) {
  const router = useRouter();
  const startMode = useMemo(() => modeFromStart(initialStart), [initialStart]);
  const [dialogOpen, setDialogOpen] = useState(Boolean(initialStart));
  const [launchMode, setLaunchMode] = useState<StudioNewCampaignMode>(startMode);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--tw-primary,#1D9E75)]/20 bg-[var(--tw-primary,#1D9E75)]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tw-primary,#1D9E75)]">
            <LayoutDashboardIcon className="size-3.5" aria-hidden />
            Campaign Studio
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Plan the campaign
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Start from a brief, resume a campaign you already planned, or open Studio from a live
            campaign. Chat remains an optional assistant — it does not replace this workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLaunchMode("choose");
            setDialogOpen(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--tw-primary,#1D9E75)] px-3 text-sm font-semibold text-white hover:bg-[#178a66]"
        >
          <PlusIcon className="size-4" aria-hidden />
          New Campaign
        </button>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">Campaign History</h2>
        </div>
        <StudioCampaignHistoryList
          items={history}
          onSelect={(item) => router.push(item.href)}
        />
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
        {campaigns.length ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">No live campaigns to open from yet.</p>
        )}
      </section>

      {dialogOpen ? (
        <StudioNewCampaignDialog
          open
          onOpenChange={(next) => {
            setDialogOpen(next);
            if (!next) setLaunchMode("choose");
          }}
          initialMode={launchMode}
        />
      ) : null}
    </div>
  );
}
