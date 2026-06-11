"use client";

import { BadgeCheckIcon, UserIcon } from "lucide-react";

import { CreatorSourceBadge } from "@/features/campaigns/components/creator-source-badge";
import { DocumentNumber } from "@/components/ui/document-number";
import { platformLabel } from "@/features/campaigns/line-assignment";
import type { MetricConfidenceLevel, UnifiedCreatorResult } from "@/lib/creators/types";
import { cn } from "@/lib/utils";

function formatCount(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

const CONFIDENCE_DOT: Record<MetricConfidenceLevel, string> = {
  estimated: "bg-muted-foreground/40",
  inferred: "bg-amber-500",
  verified: "bg-emerald-500",
  oauth_verified: "bg-sky-500",
};

function MetricCell({
  label,
  value,
  confidence,
  suffix = "",
}: {
  label: string;
  value: number | null;
  confidence: MetricConfidenceLevel;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/25 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <span
          className={cn("size-1.5 rounded-full", CONFIDENCE_DOT[confidence])}
          title={confidence}
        />
      </div>
      <p className="text-[11px] font-medium tabular-nums">
        {value == null ? "—" : `${formatCount(value)}${suffix}`}
      </p>
    </div>
  );
}

type CreatorUnifiedCardProps = {
  creator: UnifiedCreatorResult;
  selected?: boolean;
  onToggleSelect?: (checked: boolean) => void;
  onOpenDetail?: () => void;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  compact?: boolean;
};

export function CreatorUnifiedCard({
  creator,
  selected = false,
  onToggleSelect,
  onOpenDetail,
  onPrimaryAction,
  primaryActionLabel,
  compact = false,
}: CreatorUnifiedCardProps) {
  const primary = creator.platforms[0];

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/55 bg-card transition-colors",
        selected && "border-[var(--brand-product)]/40 bg-[var(--brand-product)]/5"
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {onToggleSelect ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect(e.target.checked)}
            className="mt-2 size-4 rounded border-border"
            aria-label={`Select ${creator.display_name}`}
          />
        ) : null}

        {creator.profile_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creator.profile_image_url}
            alt=""
            className="size-11 shrink-0 rounded-full border border-border/50 object-cover"
          />
        ) : (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
            <UserIcon className="size-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="text-left text-sm font-semibold hover:underline"
              onClick={onOpenDetail}
            >
              {creator.display_name}
            </button>
            {creator.is_platform_verified ? (
              <BadgeCheckIcon className="size-3.5 text-sky-500" aria-label="Platform verified" />
            ) : null}
            <CreatorSourceBadge source={creator.source_type} />
          </div>

          <p className="text-[11px] text-muted-foreground">
            {primary ? `${platformLabel(primary.platform)} · @${primary.handle}` : "—"}
            {creator.document_number ? (
              <>
                {" "}
                · <DocumentNumber value={creator.document_number} />
              </>
            ) : null}
          </p>

          {!compact && creator.bio ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {creator.bio}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1">
            {(creator.ai_niche ?? creator.ai_category) ? (
              <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px]">
                {creator.ai_niche ?? creator.ai_category}
              </span>
            ) : null}
            {creator.estimated_country ? (
              <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px]">
                {creator.estimated_country}
                {creator.city ? ` · ${creator.city}` : ""}
              </span>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">Thinkway</p>
          <p className="text-lg font-semibold tabular-nums text-[var(--brand-product)]">
            {Math.round(creator.thinkway_score)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            conf {Math.round(creator.source_confidence)}%
          </p>
        </div>
      </div>

      {!compact ? (
        <div className="grid grid-cols-2 gap-2 border-t border-border/40 px-3 py-2 sm:grid-cols-5">
          <MetricCell
            label="Followers"
            value={creator.metrics.followers.value}
            confidence={creator.metrics.followers.confidence}
          />
          <MetricCell
            label="Engagement"
            value={creator.metrics.engagement_rate.value}
            confidence={creator.metrics.engagement_rate.confidence}
            suffix="%"
          />
          <MetricCell
            label="Avg likes"
            value={creator.metrics.avg_likes.value}
            confidence={creator.metrics.avg_likes.confidence}
          />
          <MetricCell
            label="Avg comments"
            value={creator.metrics.avg_comments.value}
            confidence={creator.metrics.avg_comments.confidence}
          />
          <MetricCell
            label="Avg views"
            value={creator.metrics.avg_views.value}
            confidence={creator.metrics.avg_views.confidence}
          />
        </div>
      ) : null}

      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-3 py-2">
          <p className="text-[10px] text-muted-foreground">
            Authenticity {creator.authenticity_score != null ? creator.authenticity_score : "—"}
          </p>
          {onPrimaryAction && primaryActionLabel ? (
            <button
              type="button"
              className="text-[11px] font-medium text-[var(--brand-product)] hover:underline"
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
