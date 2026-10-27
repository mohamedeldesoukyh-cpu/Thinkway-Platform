import { readCreatorListOrder } from "@/lib/quotations/quotation-creator-order";

export const SHOW_ORIGINAL_CURRENCY_DEFAULT = false;
export const SHOW_ORIGINAL_CURRENCY_LABEL = "Show original currency";
export const SHOW_ORIGINAL_CURRENCY_META_KEY = "showOriginalCurrency";

export const HIDE_COST_AND_FEES_DEFAULT = false;
export const HIDE_COST_AND_FEES_LABEL = "Hide cost and fees";
export const HIDE_COST_AND_FEES_META_KEY = "hideCostAndFees";

export type ClientWorkspaceDisplayFlags = {
  creatorListOrder?: string[];
  /** Loaded only for the authorized workspace presentation; never a persisted display toggle. */
  creatorPhotoOverrides?: Record<string, string>;
  showOriginalCurrency: boolean;
  hideCostAndFees: boolean;
  showPackageVat?: boolean;
};

export function asMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return { ...(metadata as Record<string, unknown>) };
  }
  return {};
}

export function readShowOriginalCurrency(metadata: unknown): boolean {
  return asMetadataRecord(metadata)[SHOW_ORIGINAL_CURRENCY_META_KEY] === true;
}

export function readHideCostAndFees(metadata: unknown): boolean {
  return asMetadataRecord(metadata)[HIDE_COST_AND_FEES_META_KEY] === true;
}

export function readClientWorkspaceDisplayFlags(metadata: unknown): ClientWorkspaceDisplayFlags {
  const order = readCreatorListOrder(metadata);
  return {
    ...(order.length ? { creatorListOrder: order } : {}),
    showOriginalCurrency: readShowOriginalCurrency(metadata),
    hideCostAndFees: readHideCostAndFees(metadata),
    ...(asMetadataRecord(metadata).showPackageVat === true ? { showPackageVat: true } : {}),
  };
}

export function metadataWithClientWorkspaceDisplayPatch(
  metadata: unknown,
  patch: Partial<ClientWorkspaceDisplayFlags>
): Record<string, unknown> {
  const next = asMetadataRecord(metadata);
  if (patch.showOriginalCurrency !== undefined) {
    if (patch.showOriginalCurrency) next[SHOW_ORIGINAL_CURRENCY_META_KEY] = true;
    else delete next[SHOW_ORIGINAL_CURRENCY_META_KEY];
  }
  if (patch.hideCostAndFees !== undefined) {
    if (patch.hideCostAndFees) next[HIDE_COST_AND_FEES_META_KEY] = true;
    else delete next[HIDE_COST_AND_FEES_META_KEY];
  }
  if (patch.showPackageVat !== undefined) {
    if (patch.showPackageVat) next.showPackageVat = true;
    else delete next.showPackageVat;
  }
  return next;
}

export function metadataWithShowOriginalCurrency(
  metadata: unknown,
  value: boolean
): Record<string, unknown> {
  return metadataWithClientWorkspaceDisplayPatch(metadata, { showOriginalCurrency: value });
}

export function metadataWithHideCostAndFees(
  metadata: unknown,
  value: boolean
): Record<string, unknown> {
  return metadataWithClientWorkspaceDisplayPatch(metadata, { hideCostAndFees: value });
}

export function clientShowsCostAndFees(hideCostAndFees: boolean): boolean {
  return hideCostAndFees !== true;
}
