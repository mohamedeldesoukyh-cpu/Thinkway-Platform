import {
  canonicalPlatformKey,
  deliverableTypeLabel,
} from "@/lib/campaigns/deliverable-taxonomy";
import {
  isSocialPlatform,
  PLATFORM_LABELS,
  type SocialPlatform,
} from "@/lib/social/platforms";

function titleCaseWords(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function platformDisplayName(platform: string): string {
  const key = canonicalPlatformKey(platform);
  if (isSocialPlatform(key)) {
    return PLATFORM_LABELS[key as SocialPlatform];
  }
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function deliverableTypeIncludesPlatform(typeLabel: string, platform: string): boolean {
  const key = canonicalPlatformKey(platform);
  const platformName = platformDisplayName(platform).toLowerCase();
  const normalizedType = typeLabel.toLowerCase();
  const typeCodePrefix = key.replace(/_/g, " ");

  return (
    normalizedType.startsWith(platformName) ||
    normalizedType.startsWith(key) ||
    normalizedType.startsWith(typeCodePrefix) ||
    normalizedType.includes(` ${key} `)
  );
}

/** Hierarchy row label: platform once + title-cased type + (#n). */
export function formatDeliverableHierarchyLabel(input: {
  platform: string;
  deliverable_type: string;
  sequence: number;
  quantity?: number;
}): string {
  const typeLabel = deliverableTypeLabel(input.deliverable_type);
  const base = deliverableTypeIncludesPlatform(typeLabel, input.platform)
    ? titleCaseWords(typeLabel)
    : `${platformDisplayName(input.platform)} ${titleCaseWords(typeLabel)}`;

  const qty = input.quantity ?? 1;
  if (qty > 1) {
    return `${base} ×${qty} (#${input.sequence})`;
  }
  return `${base} (#${input.sequence})`;
}
