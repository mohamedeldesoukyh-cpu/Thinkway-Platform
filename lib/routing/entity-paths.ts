import {
  appendShortlistTemplateParam,
  type ShortlistTemplateVariant,
} from "@/features/discovery/shortlists/export/shortlist-template";

import {
  buildEntityDetailPath,
  buildEntityRouteKey,
  slugifyDisplayName,
  type EntityRouteIdentity,
} from "./entity-slug";

export const CAMPAIGNS_LIST_PATH = "/campaigns";
export const CLIENTS_LIST_PATH = "/clients";
export const VENDORS_LIST_PATH = "/vendors";
export const GROUPS_LIST_PATH = "/groups";
export const SHORTLISTS_LIST_PATH = "/discovery/shortlists";
export const QUOTATIONS_LIST_PATH = "/discovery/quotations";
export const DISCOVERY_SEARCH_PATH = "/discovery/search";

/** Shared input for building entity detail paths. */
export type EntityRouteInput = EntityRouteIdentity & {
  name?: string | null;
  display_name?: string | null;
  document_number?: string | null;
  serial_number?: string | null;
};

function toIdentity(entity: EntityRouteInput): EntityRouteIdentity {
  const displayName =
    entity.displayName ?? entity.name ?? entity.display_name ?? null;
  return {
    id: entity.id,
    slug: entity.slug?.trim() || slugifyDisplayName(displayName ?? ""),
    displayName,
    documentNumber:
      entity.documentNumber ?? entity.document_number ?? entity.serial_number ?? null,
  };
}

export function quotationDetailPath(
  entityOrId: EntityRouteInput | string,
  legacySerial?: string | null
): string {
  if (typeof entityOrId === "string") {
    if (legacySerial?.trim()) {
      return buildEntityDetailPath(QUOTATIONS_LIST_PATH, {
        id: entityOrId,
        documentNumber: legacySerial,
      });
    }
    return `${QUOTATIONS_LIST_PATH}/${encodeURIComponent(entityOrId)}`;
  }
  return buildEntityDetailPath(QUOTATIONS_LIST_PATH, toIdentity(entityOrId));
}

export function quotationPreviewPath(
  entityOrId: EntityRouteInput | string,
  legacySerialOrQuery?: string | null,
  query?: string
): string {
  const resolvedQuery =
    typeof entityOrId === "string" && legacySerialOrQuery && !legacySerialOrQuery.startsWith("QT-")
      ? legacySerialOrQuery
      : query;
  const base = `${quotationDetailPath(
    entityOrId,
    typeof entityOrId === "string" ? legacySerialOrQuery : undefined
  )}/preview`;
  return resolvedQuery ? `${base}?${resolvedQuery}` : base;
}

export function campaignDetailPath(entity: EntityRouteInput | string): string {
  if (typeof entity === "string") {
    return `${CAMPAIGNS_LIST_PATH}/${encodeURIComponent(entity)}`;
  }
  return buildEntityDetailPath(CAMPAIGNS_LIST_PATH, toIdentity(entity));
}

export function campaignDetailPathWithTab(entity: EntityRouteInput, tab?: string): string {
  const base = campaignDetailPath(entity);
  return tab ? `${base}?tab=${encodeURIComponent(tab)}` : base;
}

/** Full-page Campaign Media Plan workspace (Original / Actual / Remaining). */
export function campaignMediaPlanPath(
  entity: EntityRouteInput | string,
  view?: "original" | "actual" | "remaining"
): string {
  const base = `${campaignDetailPath(entity)}/media-plan`;
  return view && view !== "original" ? `${base}?view=${encodeURIComponent(view)}` : base;
}

export function clientDetailPath(entity: EntityRouteInput | string): string {
  if (typeof entity === "string") {
    return `${CLIENTS_LIST_PATH}/${encodeURIComponent(entity)}`;
  }
  return buildEntityDetailPath(CLIENTS_LIST_PATH, toIdentity(entity));
}

export function vendorDetailPath(entity: EntityRouteInput | string): string {
  if (typeof entity === "string") {
    return `${VENDORS_LIST_PATH}/${encodeURIComponent(entity)}`;
  }
  return buildEntityDetailPath(VENDORS_LIST_PATH, toIdentity(entity));
}

export function groupDetailPath(entity: EntityRouteInput | string): string {
  if (typeof entity === "string") {
    return `${GROUPS_LIST_PATH}/${encodeURIComponent(entity)}`;
  }
  return buildEntityDetailPath(GROUPS_LIST_PATH, toIdentity(entity));
}

export function shortlistDetailPath(entity: EntityRouteInput | string): string {
  if (typeof entity === "string") {
    return `${SHORTLISTS_LIST_PATH}/${encodeURIComponent(entity)}`;
  }
  return buildEntityDetailPath(SHORTLISTS_LIST_PATH, toIdentity(entity));
}

export function shortlistPreviewPath(
  entity: EntityRouteInput | string,
  options?: { template?: ShortlistTemplateVariant; itemIds?: string[] }
): string {
  const base = `${shortlistDetailPath(entity)}/preview`;
  const params = new URLSearchParams();
  if (options?.template) {
    appendShortlistTemplateParam(params, options.template);
  }
  if (options?.itemIds?.length) {
    params.set("items", options.itemIds.join(","));
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function buildEntityRouteKeyFromRow(entity: EntityRouteInput): string {
  return buildEntityRouteKey(toIdentity(entity));
}

// Legacy type aliases
export type CampaignRouteEntity = EntityRouteInput;
export type ClientRouteEntity = EntityRouteInput;
export type VendorRouteEntity = EntityRouteInput;
export type GroupRouteEntity = EntityRouteInput;
export type ShortlistRouteEntity = EntityRouteInput;
export type QuotationRouteEntity = EntityRouteInput;
