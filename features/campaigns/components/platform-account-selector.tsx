"use client";

import { ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DELIVERABLE_TYPE_OPTIONS,
} from "@/features/campaigns/constants";
import {
  deliverableLabel,
  PLATFORM_DELIVERABLES,
  platformLabel,
} from "@/features/campaigns/line-assignment";
import type { InfluencerAssignmentProfile } from "@/features/campaigns/types";

export type PlatformSelectionState = {
  account_id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
  audience_country: string | null;
  deliverables: string[];
  selected: boolean;
};

const PLATFORM_BADGE: Record<string, { label: string; className: string }> = {
  instagram: { label: "IG", className: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  tiktok: { label: "TT", className: "bg-foreground/10 text-foreground" },
  youtube: { label: "YT", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  snapchat: { label: "SC", className: "bg-yellow-500/20 text-yellow-800 dark:text-yellow-200" },
  twitter: { label: "X", className: "bg-foreground/10 text-foreground" },
  facebook: { label: "FB", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
};

function PlatformIcon({ platform }: { platform: string }) {
  const badge = PLATFORM_BADGE[platform];
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase",
        badge?.className ?? "bg-muted text-muted-foreground"
      )}
    >
      {badge?.label ?? platform.slice(0, 2)}
    </span>
  );
}

function formatFollowers(count: number | null): string {
  if (count == null) return "N/A";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

type PlatformAccountSelectorProps = {
  profile: InfluencerAssignmentProfile;
  selections: PlatformSelectionState[];
  onChange: (next: PlatformSelectionState[]) => void;
  disabled?: boolean;
};

export function PlatformAccountSelector({
  profile,
  selections,
  onChange,
  disabled,
}: PlatformAccountSelectorProps) {
  function toggleAccount(accountId: string, checked: boolean) {
    onChange(
      selections.map((s) =>
        s.account_id === accountId ? { ...s, selected: checked } : s
      )
    );
  }

  function toggleDeliverable(accountId: string, deliverable: string, checked: boolean) {
    onChange(
      selections.map((s) => {
        if (s.account_id !== accountId) return s;
        const set = new Set(s.deliverables);
        if (checked) set.add(deliverable);
        else set.delete(deliverable);
        return { ...s, deliverables: [...set], selected: set.size > 0 ? true : s.selected };
      })
    );
  }

  if (profile.platforms.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        No platform accounts linked to this creator. Add accounts in Vendors first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Platform accounts & deliverables</p>
      {selections.map((sel) => {
        const availableDeliverables =
          PLATFORM_DELIVERABLES[sel.platform] ??
          DELIVERABLE_TYPE_OPTIONS.map((o) => o.value);

        return (
          <div
            key={sel.account_id}
            className={cn(
              "rounded-2xl border p-3 transition-colors",
              sel.selected ? "border-primary/40 bg-primary/5" : "border-border"
            )}
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border"
                checked={sel.selected}
                onChange={(e) => toggleAccount(sel.account_id, e.target.checked)}
                disabled={disabled}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformIcon platform={sel.platform} />
                  <span className="font-medium">{platformLabel(sel.platform)}</span>
                  <span className="text-sm text-muted-foreground">@{sel.handle}</span>
                  {sel.profile_url ? (
                    <a
                      href={sel.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLinkIcon className="size-3.5" />
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {formatFollowers(sel.follower_count)} followers
                  </Badge>
                  {sel.engagement_rate != null ? (
                    <Badge variant="outline">{sel.engagement_rate}% ER</Badge>
                  ) : null}
                  {sel.audience_country ? (
                    <Badge variant="outline">{sel.audience_country} audience</Badge>
                  ) : null}
                </div>
                {sel.selected ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {availableDeliverables.map((d) => (
                      <label
                        key={d}
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1 text-xs"
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 rounded border"
                          checked={sel.deliverables.includes(d)}
                          onChange={(e) =>
                            toggleDeliverable(sel.account_id, d, e.target.checked)
                          }
                          disabled={disabled}
                        />
                        {deliverableLabel(d)}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
          </div>
        );
      })}
    </div>
  );
}

export function buildInitialSelections(
  profile: InfluencerAssignmentProfile,
  existing?: PlatformSelectionState[]
): PlatformSelectionState[] {
  return profile.platforms.map((p) => {
    const prev = existing?.find((e) => e.account_id === p.id);
    const defaultDeliverables = PLATFORM_DELIVERABLES[p.platform]?.slice(0, 1) ?? ["other"];
    return {
      account_id: p.id,
      platform: p.platform,
      handle: p.handle,
      profile_url: p.profile_url,
      follower_count: p.follower_count,
      engagement_rate: p.engagement_rate,
      audience_country: p.audience_country,
      deliverables: prev?.deliverables ?? defaultDeliverables,
      selected: prev?.selected ?? p.platform === profile.platforms[0]?.platform,
    };
  });
}
