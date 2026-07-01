"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CreatorProfileLink,
  type CreatorProfileSource,
} from "@/components/creator/creator-profile-link";
import type { DiscoverySearchResult } from "@/lib/discovery/types";
import { cn } from "@/lib/utils";

type Profile = DiscoverySearchResult["profiles"][number];

function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function profileSourceFromDiscoveryProfile(profile: Profile): CreatorProfileSource {
  return {
    displayName: profile.display_name ?? profile.username,
    avatarUrl: profile.profile_image_url,
    platform: profile.platform,
    handle: profile.username,
    profile_url: profile.profile_url,
    countryCode: profile.country_code,
  };
}

type Props = {
  profile: Profile;
  onEnrich?: (profileId: string) => void;
  onSave?: (profileId: string) => void;
  enriching?: boolean;
};

export function DiscoveryProfileCard({ profile, onEnrich, onSave, enriching }: Props) {
  const metrics = profile.latest_metrics;
  const ai = profile.latest_ai_score;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CreatorProfileLink
                source={profileSourceFromDiscoveryProfile(profile)}
                size="md"
                avatarBadge="country"
                showHandle={false}
                stopPropagation
              />
              <Badge variant="secondary" className="text-[10px]">
                {profile.stage.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">@{profile.username}</p>
            {profile.bio ? (
              <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {profile.bio}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          <Metric label="Followers" value={formatCount(metrics?.followers)} />
          <Metric
            label="Engagement"
            value={metrics?.engagement_rate != null ? `${metrics.engagement_rate}%` : "—"}
          />
          <Metric label="Avg views" value={formatCount(metrics?.avg_views)} />
          <Metric
            label="Authenticity"
            value={
              profile.authenticity_score != null ? `${profile.authenticity_score}` : "—"
            }
            warn={profile.authenticity_score != null && profile.authenticity_score < 60}
          />
        </div>

        {(profile.country_code || profile.city || ai?.category) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.country_code ? (
              <Badge variant="outline" className="text-[10px]">
                {profile.country_code}
              </Badge>
            ) : null}
            {profile.city ? (
              <Badge variant="outline" className="text-[10px]">
                {profile.city}
              </Badge>
            ) : null}
            {ai?.category ? (
              <Badge variant="outline" className="text-[10px]">
                {ai.category}
              </Badge>
            ) : null}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {onEnrich ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              disabled={enriching}
              onClick={() => onEnrich(profile.id)}
            >
              {enriching ? "Queuing…" : "Enrich"}
            </Button>
          ) : null}
          {onSave ? (
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => onSave(profile.id)}
            >
              Save
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums", warn && "text-amber-700 dark:text-amber-300")}>
        {value}
      </p>
    </div>
  );
}
