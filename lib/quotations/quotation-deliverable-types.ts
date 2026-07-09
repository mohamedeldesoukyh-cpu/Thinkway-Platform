/**
 * Post / deliverable types for client quotations (broader than campaign hierarchy taxonomy).
 */
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { QuotationDeliverableTypeLine } from "@/lib/domains/commercial/quotation-types";

export type { QuotationDeliverableTypeLine };

export const QUOTATION_POST_TYPES = [
  { value: "video", label: "Video" },
  { value: "stories", label: "Stories" },
  { value: "instagram_post", label: "IG Post" },
  { value: "instagram_story", label: "IG Story" },
  { value: "visit", label: "Visit" },
  { value: "ig_story_set", label: "IG Set of stories" },
  { value: "instagram_reel", label: "IG Reel" },
  { value: "tiktok_video", label: "TT Video" },
  { value: "tiktok_photo_post", label: "TikTok Photo Post" },
  { value: "tiktok_live", label: "TikTok LIVE" },
  { value: "tiktok_story", label: "TikTok Story" },
  { value: "tiktok_spark_ads", label: "TikTok Spark Ads" },
  { value: "yt_short", label: "YT Short" },
  { value: "yt_live", label: "YT Live" },
  { value: "yt_video", label: "YT Video" },
  { value: "facebook_post", label: "FB Post" },
  { value: "facebook_story", label: "FB Story" },
  { value: "facebook_reel", label: "FB Reel" },
  { value: "facebook_live", label: "FB Live" },
  { value: "facebook_group_post", label: "FB Group Post" },
  { value: "ugc", label: "UGC" },
  { value: "campaign_series", label: "Campaign Series" },
  { value: "cross_posting", label: "Cross-Posting" },
  { value: "mirrored_on_all_pf", label: "Mirrored on All PF" },
  { value: "all_platforms", label: "All Platforms" },
  { value: "mirrored_ig", label: "Mirrored IG" },
  { value: "mirrored_tt", label: "Mirrored TT" },
  { value: "mirrored_fb", label: "Mirrored FB" },
  { value: "mirrored_yt", label: "Mirrored YT" },
  { value: "event_coverage", label: "Event Coverage" },
  { value: "instagram_live", label: "IG Live" },
  { value: "ig_collab_post", label: "IG Collab Post" },
  { value: "usage_right", label: "Usage Right" },
] as const;

export type QuotationPostType = (typeof QUOTATION_POST_TYPES)[number]["value"];

const LABEL_INDEX = new Map(QUOTATION_POST_TYPES.map((t) => [t.value, t.label]));

export function quotationPostTypeLabel(code: string): string {
  return LABEL_INDEX.get(code as QuotationPostType) ?? code.replace(/_/g, " ");
}

export function normalizeTypeLineQuantity(value: unknown): number {
  const n = Math.floor(Number(value) || 1);
  return n > 0 ? n : 1;
}

/** Resolved type lines (migrates legacy `type` / `types`). */
export function deliverableTypeLines(
  deliverable: {
    type?: string | null;
    types?: string[] | null;
    type_lines?: QuotationDeliverableTypeLine[] | null;
    quantity?: number | null;
  }
): QuotationDeliverableTypeLine[] {
  const fromLines = (deliverable.type_lines ?? []).filter(
    (line): line is QuotationDeliverableTypeLine =>
      Boolean(line && typeof line.type === "string")
  );
  if (fromLines.length > 0) {
    return fromLines.map((line) => ({
      type: line.type.trim(),
      quantity: normalizeTypeLineQuantity(line.quantity),
    }));
  }

  const types = deliverableTypeValues(deliverable);
  if (types.length > 0) {
    return types.map((type) => ({ type, quantity: 1 }));
  }

  return [{ type: "", quantity: 1 }];
}

export function formatTypeLinesSummary(
  lines: QuotationDeliverableTypeLine[]
): string {
  const filled = lines.filter((line) => line.type.trim());
  if (!filled.length) return "Select type…";
  return filled
    .map((line) => `${line.quantity}× ${quotationPostTypeLabel(line.type)}`)
    .join(" + ");
}

export function filterTypeLinesForCreatorPlatforms(
  lines: QuotationDeliverableTypeLine[],
  allowedPlatforms: string[]
): QuotationDeliverableTypeLine[] {
  if (lines.length === 0) return [{ type: "", quantity: 1 }];
  return lines.map((line) => ({
    ...line,
    quantity: normalizeTypeLineQuantity(line.quantity),
    type:
      line.type.trim() && !isPostTypeAllowedForCreator(line.type, allowedPlatforms)
        ? ""
        : line.type,
  }));
}

export function syncDeliverableFromTypeLines(
  lines: QuotationDeliverableTypeLine[],
  allowedCreatorPlatforms: string[] = [],
  fallbackPlatform = ""
): {
  type_lines: QuotationDeliverableTypeLine[];
  type: string;
  types: string[];
  platform: string;
} {
  const sanitized = filterTypeLinesForCreatorPlatforms(lines, allowedCreatorPlatforms);
  const withMinimum =
    sanitized.length > 0 ? sanitized : [{ type: "", quantity: 1 }];
  const types = withMinimum.map((line) => line.type).filter(Boolean);
  return {
    type_lines: withMinimum,
    type: types[0] ?? "",
    types,
    platform: deriveDeliverablePlatform(types, allowedCreatorPlatforms, fallbackPlatform),
  };
}

/** Resolved post-type codes for a deliverable (supports legacy single `type`). */
export function deliverableTypeValues(
  deliverable: { type?: string | null; types?: string[] | null }
): string[] {
  const fromTypes = (deliverable.types ?? []).filter((t) => t.trim());
  if (fromTypes.length > 0) return fromTypes;
  const single = deliverable.type?.trim();
  return single ? [single] : [];
}

export const ALL_PLATFORMS_TYPE = "all_platforms" as const;

export function typeLinesIncludeAllPlatforms(
  deliverable: {
    type?: string | null;
    types?: string[] | null;
    type_lines?: QuotationDeliverableTypeLine[] | null;
  }
): boolean {
  return deliverableTypeLines(deliverable).some(
    (line) => line.type === ALL_PLATFORMS_TYPE
  );
}

export function deliverableTypesLabel(
  deliverable: {
    type?: string | null;
    types?: string[] | null;
    type_lines?: QuotationDeliverableTypeLine[] | null;
  }
): string {
  return formatTypeLinesSummary(deliverableTypeLines(deliverable));
}

export function toggleDeliverableType(current: string[], type: string): string[] {
  if (current.includes(type)) {
    return current.filter((t) => t !== type);
  }
  return [...current, type];
}

/** Selected post-type codes from type lines (preserves order). */
export function selectedTypesFromTypeLines(
  lines: QuotationDeliverableTypeLine[]
): string[] {
  return lines.map((line) => line.type.trim()).filter(Boolean);
}

/** Build type lines from a multi-select, preserving quantities for unchanged types. */
export function typeLinesFromSelectedTypes(
  types: string[],
  existingLines: QuotationDeliverableTypeLine[] = []
): QuotationDeliverableTypeLine[] {
  const qtyByType = new Map(
    existingLines
      .filter((line) => line.type.trim())
      .map((line) => [line.type, normalizeTypeLineQuantity(line.quantity)])
  );
  const trimmed = types.map((t) => t.trim()).filter(Boolean);
  if (trimmed.length === 0) return [{ type: "", quantity: 1 }];
  return trimmed.map((type) => ({
    type,
    quantity: qtyByType.get(type) ?? 1,
  }));
}

export function normalizeDeliverableTypes(
  deliverable: { type?: string | null; types?: string[] | null }
): { type: string; types: string[] } {
  const types = deliverableTypeValues(deliverable);
  return { type: types[0] ?? "", types };
}

/** Platform key required by a post type, or null when platform-agnostic. */
export function postTypePlatformKey(type: string): string | null {
  if (type === "mirrored_ig") return "instagram";
  if (type === "mirrored_tt") return "tiktok";
  if (type === "mirrored_fb") return "facebook";
  if (type === "mirrored_yt") return "youtube";
  if (type.startsWith("instagram_") || type.startsWith("ig_")) return "instagram";
  if (type.startsWith("tiktok_")) return "tiktok";
  if (type.startsWith("youtube_") || type.startsWith("yt_")) return "youtube";
  if (type.startsWith("facebook_") || type.startsWith("fb_")) return "facebook";
  return null;
}

export function isPostTypeAllowedForCreator(
  type: string,
  allowedPlatforms: string[]
): boolean {
  const required = postTypePlatformKey(type);
  if (!required) return true;
  const allowed = new Set(allowedPlatforms.map((p) => canonicalPlatformKey(p)));
  return allowed.has(required);
}

export function filterPostTypesForCreatorPlatforms(
  types: string[],
  allowedPlatforms: string[]
): string[] {
  return types.filter((t) => isPostTypeAllowedForCreator(t, allowedPlatforms));
}

const PLATFORM_DISPLAY_ORDER = ["instagram", "tiktok", "youtube", "snapchat", "facebook"];

/** Logo platforms implied by selected post types on one pricing row. */
export function platformsFromSelectedPostTypes(
  types: string[],
  allowedCreatorPlatforms: string[] = []
): string[] {
  const found = new Set<string>();
  for (const type of types) {
    const platform = postTypePlatformKey(type);
    if (platform) found.add(platform);
    if (
      type === "cross_posting" ||
      type === "mirrored_on_all_pf" ||
      type === ALL_PLATFORMS_TYPE
    ) {
      for (const p of allowedCreatorPlatforms) {
        found.add(canonicalPlatformKey(p));
      }
    }
  }
  return [...found].sort(
    (a, b) => PLATFORM_DISPLAY_ORDER.indexOf(a) - PLATFORM_DISPLAY_ORDER.indexOf(b)
  );
}

export function deriveDeliverablePlatform(
  types: string[],
  allowedCreatorPlatforms: string[] = [],
  fallback = ""
): string {
  const platforms = platformsFromSelectedPostTypes(types, allowedCreatorPlatforms);
  if (platforms.length === 0) return fallback;
  return platforms.join(",");
}

export function firstAllowedPostType(allowedPlatforms: string[]): string {
  for (const t of QUOTATION_POST_TYPES) {
    if (isPostTypeAllowedForCreator(t.value, allowedPlatforms)) return t.value;
  }
  return QUOTATION_POST_TYPES[0].value;
}

export function formatQuotationDeliverablesSummary(
  deliverables: Array<{
    platform?: string | null;
    type: string;
    types?: string[] | null;
    type_lines?: QuotationDeliverableTypeLine[] | null;
    quantity: number;
    revenue?: number | null;
    service_description?: string | null;
  }>,
  serviceDescription?: string | null
): string {
  const parts: string[] = [];
  if (deliverables.length) {
    parts.push(
      deliverables
        .map((d) => {
          const typeLabel = formatTypeLinesSummary(deliverableTypeLines(d));
          const platform = d.platform?.trim();
          const price =
            d.revenue != null && Number(d.revenue) > 0 ? ` · ${d.revenue} total` : "";
          const base = platform ? `${typeLabel} (${platform})${price}` : `${typeLabel}${price}`;
          const desc = d.service_description?.trim();
          return desc ? `${base} — ${desc}` : base;
        })
        .join(", ")
    );
  }
  const desc = serviceDescription?.trim();
  if (desc) parts.push(desc);
  return parts.length ? parts.join(" — ") : "—";
}

export function optionNumberLabel(optionNumber: number | null | undefined): string | null {
  if (optionNumber == null || !Number.isFinite(optionNumber) || optionNumber < 1) {
    return null;
  }
  return `Option ${Math.floor(optionNumber)}`;
}
