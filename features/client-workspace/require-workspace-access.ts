import type { SupabaseClient } from "@supabase/supabase-js";

import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import {
  isClientWorkspaceSectionOpen,
  navSectionForWorkspaceSection,
  requestedPackageForLockedSection,
  clientWorkspaceEntitlementBlock,
  CLIENT_WORKSPACE_LOCKED_MESSAGE,
  type ClientWorkspaceEntitlementView,
  type ClientWorkspaceNavSection,
} from "./entitlement";
import { loadEntitlementForReview } from "./load-entitlement";
import { resolveClientReviewByToken } from "./load-client-workspace";
import type { ClientReviewRecord } from "./types";
import type { ClientWorkspaceSectionId } from "./constants";

function db(): SupabaseClient {
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    throw new Error("Client Workspace is temporarily unavailable.");
  }
  return service;
}

export { CLIENT_WORKSPACE_LOCKED_MESSAGE };

export async function loadReviewEntitlementByToken(token: string): Promise<
  | {
      ok: true;
      review: ClientReviewRecord;
      clientId: string | null;
      entitlement: ClientWorkspaceEntitlementView;
    }
  | { ok: false; message: string }
> {
  const resolved = await resolveClientReviewByToken(db(), token);
  if (!resolved.ok) {
    return { ok: false, message: "This review link is invalid or has expired." };
  }
  const loaded = await loadEntitlementForReview(db(), resolved.review);
  return {
    ok: true,
    review: resolved.review,
    clientId: loaded.clientId,
    entitlement: loaded.entitlement,
  };
}

export async function requireClientWorkspaceSectionAccess(
  token: string,
  section: ClientWorkspaceSectionId | ClientWorkspaceNavSection
): Promise<
  | {
      ok: true;
      review: ClientReviewRecord;
      clientId: string | null;
      entitlement: ClientWorkspaceEntitlementView;
    }
  | { ok: false; message: string }
> {
  const loaded = await loadReviewEntitlementByToken(token);
  if (!loaded.ok) return loaded;
  const entitlementBlock = clientWorkspaceEntitlementBlock(loaded.clientId, loaded.entitlement);
  if (entitlementBlock) {
    return { ok: false, message: entitlementBlock.message };
  }
  const nav =
    section === "shortlist" ||
    section === "creators" ||
    section === "commercial" ||
    section === "approval" ||
    section === "overview"
      ? section
      : navSectionForWorkspaceSection(section);
  if (!isClientWorkspaceSectionOpen(loaded.entitlement, nav)) {
    return { ok: false, message: CLIENT_WORKSPACE_LOCKED_MESSAGE };
  }
  return loaded;
}

export function requestedPackageForSection(section: ClientWorkspaceNavSection) {
  return requestedPackageForLockedSection(section);
}
