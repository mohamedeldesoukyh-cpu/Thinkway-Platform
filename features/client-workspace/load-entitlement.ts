import type { SupabaseClient } from "@supabase/supabase-js";

import {
  entitlementForResolvedLegalEntity,
  isClientWorkspacePackage,
  parseTabOverrides,
  resolveClientWorkspaceEntitlement,
  type ClientWorkspaceEntitlementRecord,
  type ClientWorkspaceEntitlementView,
} from "./entitlement";
import { loadLegalEntityIdsForReview } from "./identity-logo";
import type { ClientReviewRecord } from "./types";

const ENTITLEMENT_COLUMNS =
  "id, client_workspace_enabled, client_workspace_package, client_workspace_tab_overrides, client_workspace_grandfathered, client_workspace_preview_started_at, client_workspace_preview_expires_at, client_workspace_preview_previous_package";

type EntitlementRow = {
  id: string;
  client_workspace_enabled?: boolean | null;
  client_workspace_package?: string | null;
  client_workspace_tab_overrides?: unknown;
  client_workspace_grandfathered?: boolean | null;
  client_workspace_preview_started_at?: string | null;
  client_workspace_preview_expires_at?: string | null;
  client_workspace_preview_previous_package?: string | null;
};

export function mapClientWorkspaceEntitlementRow(
  row: EntitlementRow | null | undefined
): ClientWorkspaceEntitlementRecord | null {
  if (!row?.id) return null;
  return {
    enabled: Boolean(row.client_workspace_enabled),
    package: isClientWorkspacePackage(row.client_workspace_package)
      ? row.client_workspace_package
      : null,
    tabOverrides: parseTabOverrides(row.client_workspace_tab_overrides),
    grandfathered: Boolean(row.client_workspace_grandfathered),
    previewStartedAt: row.client_workspace_preview_started_at ?? null,
    previewExpiresAt: row.client_workspace_preview_expires_at ?? null,
    previewPreviousPackage: isClientWorkspacePackage(row.client_workspace_preview_previous_package)
      ? row.client_workspace_preview_previous_package
      : null,
  };
}

export async function loadClientWorkspaceEntitlementByClientId(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientWorkspaceEntitlementView> {
  const { data, error } = await supabase
    .from("clients")
    .select(ENTITLEMENT_COLUMNS)
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) {
    return resolveClientWorkspaceEntitlement(null);
  }
  return resolveClientWorkspaceEntitlement(mapClientWorkspaceEntitlementRow(data as EntitlementRow));
}

export async function resolveReviewLegalEntityId(
  supabase: SupabaseClient,
  review: Pick<
    ClientReviewRecord,
    "quotationId" | "shortlistId" | "campaignHeaderId" | "clientLabel" | "brandName" | "campaignName" | "sourceSnapshot"
  >
): Promise<string | null> {
  const ids = await loadLegalEntityIdsForReview(supabase as never, {
    quotationId: review.quotationId,
    shortlistId: review.shortlistId,
    campaignHeaderId: review.campaignHeaderId,
    clientLabel: review.clientLabel || review.sourceSnapshot?.clientLabel,
    brandName: review.brandName || review.sourceSnapshot?.brandName,
    campaignName: review.campaignName || review.sourceSnapshot?.campaignName,
  });
  return ids[0] ?? null;
}

export async function loadEntitlementForReview(
  supabase: SupabaseClient,
  review: Pick<
    ClientReviewRecord,
    "quotationId" | "shortlistId" | "campaignHeaderId" | "clientLabel" | "brandName" | "campaignName" | "sourceSnapshot"
  >
): Promise<{ clientId: string | null; entitlement: ClientWorkspaceEntitlementView }> {
  const clientId = await resolveReviewLegalEntityId(supabase, review);
  if (!clientId) {
    return entitlementForResolvedLegalEntity(null, null);
  }
  return {
    clientId,
    entitlement: await loadClientWorkspaceEntitlementByClientId(supabase, clientId),
  };
}
