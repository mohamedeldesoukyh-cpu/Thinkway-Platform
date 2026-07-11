"use client";

import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";
import { CreatorTierBadge } from "@/components/creator/creator-tier-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CreatorTierLabel } from "@/lib/creators/creator-tier";
import { formatEngagement, formatFollowers } from "@/features/campaign-studio/components/sections/shared/format-utils";

export type CreatorDrawerSelection = {
  id?: string;
  displayName: string;
  handle?: string;
  platform?: string;
  avatarUrl?: string;
  profileUrl?: string;
  followers?: number;
  engagementRate?: number;
  country?: string;
  language?: string;
  audienceSummary?: string;
  priceEstimate?: string;
  tier?: CreatorTierLabel;
  reason?: string;
  matchPercent?: number;
};

function resolveInternalVendorHref(unifiedId?: string): string | undefined {
  if (!unifiedId?.startsWith("inf:")) return undefined;
  const raw = unifiedId.slice(4).trim();
  return raw ? `/vendors/${raw}` : undefined;
}

type CreatorDrawerProps = {
  creator: CreatorDrawerSelection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreatorDrawer({ creator, open, onOpenChange }: CreatorDrawerProps) {
  const internalHref = resolveInternalVendorHref(creator?.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Creator profile</SheetTitle>
          <SheetDescription>
            Review metrics, estimated fees, and open the live social profile.
          </SheetDescription>
        </SheetHeader>

        {creator ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-3">
              {creator.profileUrl ? (
                <a
                  href={creator.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-product"
                >
                  <CreatorAvatarImage
                    avatarUrl={creator.avatarUrl}
                    profileUrl={creator.profileUrl}
                    size="md"
                    alt={creator.displayName}
                  />
                </a>
              ) : (
                <CreatorAvatarImage
                  avatarUrl={creator.avatarUrl}
                  profileUrl={creator.profileUrl}
                  size="md"
                  alt={creator.displayName}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{creator.displayName}</p>
                {creator.handle ? (
                  <p className="text-sm text-muted-foreground">{creator.handle}</p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {creator.platform ? (
                    <span className="text-xs capitalize text-muted-foreground">{creator.platform}</span>
                  ) : null}
                  {creator.tier ? <CreatorTierBadge tier={creator.tier} /> : null}
                  {creator.matchPercent != null ? (
                    <span className="text-xs font-medium text-violet-600">
                      {creator.matchPercent}% match
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-border/60 pt-4 text-sm sm:grid-cols-2">
              {creator.followers != null ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Followers
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatFollowers(creator.followers)}
                  </p>
                </div>
              ) : null}
              {creator.engagementRate != null ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Engagement
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums">
                    {formatEngagement(creator.engagementRate)}
                  </p>
                </div>
              ) : null}
              {creator.country ? (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Country
                  </p>
                  <p className="mt-0.5 font-semibold">{creator.country}</p>
                </div>
              ) : null}
              {creator.priceEstimate ? (
                <div className="col-span-2 rounded-lg border border-brand-product/30 bg-brand-product/5 p-3 sm:col-span-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Estimated fee
                  </p>
                  <p className="mt-0.5 font-semibold text-brand-product">{creator.priceEstimate}</p>
                </div>
              ) : null}
            </div>

            {creator.audienceSummary ? (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Audience
                </p>
                <p className="mt-1 text-muted-foreground">{creator.audienceSummary}</p>
              </div>
            ) : null}

            {creator.reason ? (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Why recommended
                </p>
                <p className="mt-1 text-foreground">{creator.reason}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {creator.profileUrl ? (
                <Button type="button" variant="default" className="bg-brand-product hover:bg-brand-product/90" asChild>
                  <a href={creator.profileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-4" />
                    View social profile
                  </a>
                </Button>
              ) : null}
              {internalHref ? (
                <Button type="button" variant="outline" asChild>
                  <Link href={internalHref}>Open in Thinkway</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
