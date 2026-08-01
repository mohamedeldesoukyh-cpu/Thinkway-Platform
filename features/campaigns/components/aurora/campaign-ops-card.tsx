"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CampaignOpsCardProps = {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

/** Concise operational summary card — progressive disclosure into focused workspaces. */
export function CampaignOpsCard({
  title,
  subtitle,
  status,
  children,
  actionLabel = "Open",
  onAction,
  className,
}: CampaignOpsCardProps) {
  return (
    <article className={cn("thinkway-aurora-ops-card", className)}>
      <header className="thinkway-aurora-ops-card-head">
        <div className="min-w-0">
          <div className="thinkway-aurora-ops-card-title">{title}</div>
          {subtitle ? (
            <div className="thinkway-aurora-ops-card-sub">{subtitle}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status}
          {onAction ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="thinkway-campaign-btn h-[30px] px-2.5 text-[11.5px]"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </header>
      <div className="thinkway-aurora-ops-card-body">{children}</div>
    </article>
  );
}

type StatRowProps = {
  label: string;
  value: ReactNode;
  tone?: "default" | "blue" | "pos" | "amber" | "mut";
};

export function CampaignOpsStat({ label, value, tone = "default" }: StatRowProps) {
  return (
    <div className="thinkway-aurora-ops-stat">
      <span className="thinkway-aurora-ops-stat-k">{label}</span>
      <span
        className={cn(
          "thinkway-aurora-ops-stat-v tabular-nums",
          tone === "blue" && "text-[var(--camp-blue-text)]",
          tone === "pos" && "text-[var(--camp-green-text)]",
          tone === "amber" && "text-[var(--camp-amber-text)]",
          tone === "mut" && "text-[var(--camp-text-4,var(--camp-text-3))]"
        )}
      >
        {value}
      </span>
    </div>
  );
}
