/**
 * Export-only helpers — grouping, labels, and field mapping for quotation templates.
 * Does not affect the quotation workspace UI.
 */
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { resolveCreatorProfileUrl, type ProfileUrlSource } from "@/lib/discovery/profile-url";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { buildQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import {
  deliverableTypeValues,
  platformsFromSelectedPostTypes,
  quotationPostTypeLabel,
  typeLinesIncludeAllPlatforms,
} from "@/lib/quotations/quotation-deliverable-types";
import type { QuotationItemRow } from "@/features/quotations/types";

export type QuotationExportItem = QuotationItemRow & {
  profile_image_url?: string | null;
  profile_url?: string | null;
  option_number?: number | null;
};

type DeliverableJson = QuotationDeliverable &
  Record<string, unknown> & {
    service_description?: string | null;
    type_lines?: Array<{ type: string; quantity: number }> | null;
    types?: string[] | null;
  };

const POST_TYPE_LABELS: Record<string, string> = {
  video: "Video",
  stories: "Stories",
  instagram_post: "IG Post",
  instagram_story: "IG Story",
  instagram_reel: "IG Reel",
  tiktok_video: "TT Video",
  tiktok_photo_post: "TikTok Photo Post",
  tiktok_live: "TikTok LIVE",
  tiktok_story: "TikTok Story",
  facebook_post: "FB Post",
  facebook_reel: "FB Reel",
  ugc: "UGC",
  cross_posting: "Cross-Posting",
  all_platforms: "All Platforms",
};

function postTypeLabel(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "";
  return POST_TYPE_LABELS[trimmed] ?? quotationPostTypeLabel(trimmed);
}

export function quotationCreatorDuplicateKey(
  item: Pick<
    QuotationItemRow,
    "id" | "unified_id" | "influencer_id" | "profile_id" | "creator_name" | "handle"
  >
): string {
  if (item.unified_id) return `u:${item.unified_id}`;
  if (item.influencer_id) return `i:${item.influencer_id}`;
  if (item.profile_id) return `p:${item.profile_id}`;
  const name = item.creator_name?.trim().toLowerCase() ?? "";
  const handle = item.handle?.trim().toLowerCase().replace(/^@/, "") ?? "";
  if (name || handle) return `n:${name}|${handle}`;
  return `id:${item.id}`;
}

export function countUniqueQuotationCreators(items: QuotationItemRow[]): number {
  return new Set(items.map((item) => quotationCreatorDuplicateKey(item))).size;
}

export type QuotationExportCreatorGroup = {
  creatorKey: string;
  items: QuotationExportItem[];
};

export function groupQuotationExportItems(
  items: QuotationExportItem[]
): QuotationExportCreatorGroup[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const byCreator = new Map<string, QuotationExportItem[]>();

  for (const item of sorted) {
    const key = quotationCreatorDuplicateKey(item);
    const bucket = byCreator.get(key) ?? [];
    bucket.push(item);
    byCreator.set(key, bucket);
  }

  const groups: QuotationExportCreatorGroup[] = [];
  const seen = new Set<string>();

  for (const item of sorted) {
    const creatorKey = quotationCreatorDuplicateKey(item);
    if (seen.has(creatorKey)) continue;
    seen.add(creatorKey);

    const creatorItems = [...(byCreator.get(creatorKey) ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    creatorItems.forEach((row, index) => {
      if (row.option_number == null || row.option_number < 1) {
        row.option_number = index + 1;
      }
    });

    groups.push({ creatorKey, items: creatorItems });
  }

  return groups;
}

export function optionNumberLabel(optionNumber: number | null | undefined): string {
  if (optionNumber == null || !Number.isFinite(optionNumber) || optionNumber < 1) {
    return "Option 1";
  }
  return `Option ${Math.floor(optionNumber)}`;
}

export function formatCreatorHandle(handle: string | null | undefined): string {
  const trimmed = handle?.trim();
  if (!trimmed) return "—";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function deliverableTypeLines(deliverable: DeliverableJson): Array<{ type: string; quantity: number }> {
  const fromLines = (deliverable.type_lines ?? []).filter(
    (line): line is { type: string; quantity: number } => Boolean(line?.type)
  );
  if (fromLines.length > 0) {
    return fromLines.map((line) => ({
      type: line.type.trim(),
      quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
    }));
  }

  const types = (deliverable.types ?? []).filter((value) => value.trim());
  if (types.length > 0) {
    return types.map((type) => ({ type: type.trim(), quantity: 1 }));
  }

  const single = deliverable.type?.trim();
  return single ? [{ type: single, quantity: Math.max(1, deliverable.quantity || 1) }] : [];
}

export function exportDeliverableTypeLabel(deliverable: DeliverableJson): string {
  const lines = deliverableTypeLines(deliverable).filter((line) => line.type);
  if (!lines.length) return "—";
  return lines
    .map((line) => `${line.quantity}× ${postTypeLabel(line.type)}`)
    .join(" + ");
}

export function exportItemTypeLabel(item: QuotationExportItem): string {
  const deliverables = (item.deliverables ?? []) as DeliverableJson[];
  if (!deliverables.length) return "—";
  const parts = deliverables
    .map((deliverable) => exportDeliverableTypeLabel(deliverable))
    .filter((label) => label !== "—");
  return parts.length ? parts.join(" + ") : "—";
}

export function exportItemServiceDescription(item: QuotationExportItem): string {
  const deliverables = (item.deliverables ?? []) as DeliverableJson[];
  const fromDeliverables = deliverables
    .map((deliverable) => deliverable.service_description?.trim())
    .filter((value): value is string => Boolean(value));
  if (fromDeliverables.length > 0) {
    return [...new Set(fromDeliverables)].join(" · ");
  }
  return "—";
}

export function exportItemTierLabel(item: QuotationExportItem): string {
  const tier = resolveCreatorTierLabel({ followers: item.followers });
  return tier === "Unknown" ? "—" : tier;
}

export function exportItemPlatformIcons(item: QuotationExportItem): {
  platformIcons: string[];
  allPlatforms: boolean;
} {
  const deliverables = (item.deliverables ?? []) as DeliverableJson[];
  let allPlatforms = false;
  const platformIcons = new Set<string>();
  const allowed = item.platform ? [item.platform] : [];

  for (const deliverable of deliverables) {
    if (typeLinesIncludeAllPlatforms(deliverable)) {
      allPlatforms = true;
      continue;
    }
    const types = deliverableTypeValues(deliverable);
    platformsFromSelectedPostTypes(types, allowed).forEach((platform) =>
      platformIcons.add(platform)
    );
    deliverable.platform
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((platform) => platformIcons.add(platform));
  }

  if (!platformIcons.size && item.platform) {
    platformIcons.add(item.platform);
  }

  return { platformIcons: [...platformIcons], allPlatforms };
}

export function resolveExportCreatorProfile(item: QuotationExportItem) {
  const source = buildQuotationCreatorProfileSource(item);
  const profileUrl =
    resolveCreatorProfileUrl(source as ProfileUrlSource) ??
    item.profile_url ??
    (item.platform && item.handle
      ? resolveCreatorProfileUrl({ platform: item.platform, handle: item.handle })
      : null);

  return {
    creator: source.displayName,
    handle: formatCreatorHandle(source.handle ?? item.handle),
    profileUrl,
    avatarUrl: source.avatarUrl?.trim() || item.profile_image_url?.trim() || null,
    platform: source.platform ?? item.platform ?? null,
    linkedPlatforms: source.linkedPlatforms ?? [],
  };
}
