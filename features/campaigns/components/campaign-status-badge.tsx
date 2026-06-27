import { StatusBadge } from "@/components/shared/status/status-badge";
import type { SemanticStatusTone } from "@/components/shared/status/status-config";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/types/database";

import { CAMPAIGN_STATUS_OPTIONS } from "../constants";

const CAMPAIGN_CHIP_TONE_CLASS: Record<SemanticStatusTone, string> = {
  success: "bg-[var(--camp-green-bg)] text-[var(--camp-green-text)]",
  warning: "bg-[var(--camp-amber-bg)] text-[var(--camp-amber-text)]",
  destructive: "bg-[var(--camp-red-bg)] text-[var(--camp-red-text)]",
  foreground: "bg-[var(--camp-blue-light)] text-[var(--camp-blue-text)]",
  neutral:
    "border border-[var(--camp-border)] bg-[var(--camp-surface)] text-[var(--camp-text-2)]",
};

type CampaignStatusBadgeProps = {
  status: CampaignStatus;
  className?: string;
};

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const label =
    CAMPAIGN_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;
  const tone = resolveStatusTone("campaign", status);

  return (
    <StatusBadge
      label={label}
      tone={tone}
      appearance="pill"
      className={cn(
        "thinkway-campaign-status-chip border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em]",
        CAMPAIGN_CHIP_TONE_CLASS[tone],
        className
      )}
    />
  );
}
