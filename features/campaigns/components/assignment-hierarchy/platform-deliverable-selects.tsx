"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDeliverableTypesForPlatform,
  getPlatformOptionLabel,
} from "@/lib/campaigns/deliverable-taxonomy";
import { PLATFORM_SHORT_LABELS, isSocialPlatform, type SocialPlatform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

export function platformBadgeClass(platform: string): string {
  const colors: Record<string, string> = {
    instagram: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
    tiktok: "bg-slate-900/10 text-slate-900 dark:bg-slate-100/10 dark:text-slate-100",
    snapchat: "bg-yellow-400/20 text-yellow-900 dark:text-yellow-200",
    youtube: "bg-red-500/15 text-red-700 dark:text-red-300",
  };
  return colors[platform] ?? "bg-muted text-muted-foreground";
}

type CompactSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function PlatformBadge({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  const short = isSocialPlatform(platform)
    ? PLATFORM_SHORT_LABELS[platform as SocialPlatform]
    : platform.slice(0, 2).toUpperCase();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        platformBadgeClass(platform),
        className
      )}
      title={getPlatformOptionLabel(platform)}
    >
      {short}
    </span>
  );
}

export function PlatformSelect({
  platform,
  platformOptions,
  onPlatformChange,
  disabled,
  className,
}: {
  platform: string;
  platformOptions: { value: string; label: string }[];
  onPlatformChange: (platform: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const short = isSocialPlatform(platform)
    ? PLATFORM_SHORT_LABELS[platform as SocialPlatform]
    : platform.slice(0, 2).toUpperCase();

  return (
    <Select value={platform} onValueChange={onPlatformChange} disabled={disabled}>
      <SelectTrigger
        className={cn("h-6 w-[68px] text-[10px] px-1.5", platformBadgeClass(platform), className)}
        title={getPlatformOptionLabel(platform)}
      >
        <SelectValue>{short}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {platformOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DeliverableTypeSelect({
  platform,
  deliverableType,
  onDeliverableTypeChange,
  disabled,
  className,
}: {
  platform: string;
  deliverableType: string;
  onDeliverableTypeChange: (type: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const typeOptions = getDeliverableTypesForPlatform(platform);

  return (
    <Select value={deliverableType} onValueChange={onDeliverableTypeChange} disabled={disabled}>
      <SelectTrigger className={cn("h-6 min-w-[88px] max-w-[112px] text-[10px]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {typeOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.shortLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Combined selects for compact planner cards. */
export function PlatformDeliverableSelects({
  platform,
  deliverableType,
  platformOptions,
  onPlatformChange,
  onDeliverableTypeChange,
  disabled,
  compact,
  className,
}: {
  platform: string;
  deliverableType: string;
  platformOptions: { value: string; label: string }[];
  onPlatformChange: (platform: string) => void;
  onDeliverableTypeChange: (type: string) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <PlatformSelect
        platform={platform}
        platformOptions={platformOptions}
        onPlatformChange={onPlatformChange}
        disabled={disabled}
      />
      <DeliverableTypeSelect
        platform={platform}
        deliverableType={deliverableType}
        onDeliverableTypeChange={onDeliverableTypeChange}
        disabled={disabled}
        className={compact ? undefined : "min-w-[120px]"}
      />
    </div>
  );
}
