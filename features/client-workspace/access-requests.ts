import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";

import type { ClientWorkspaceNavSection, ClientWorkspacePackage } from "./entitlement";
import { loadReviewEntitlementByToken } from "./require-workspace-access";
import {
  clientWorkspaceEntitlementBlock,
  isClientWorkspaceSectionOpen,
  navSectionForWorkspaceSection,
  CLIENT_WORKSPACE_UNAVAILABLE_MESSAGE,
} from "./entitlement";
import type { ClientWorkspaceSectionId } from "./constants";

function db(): SupabaseClient {
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    throw new Error("Client Workspace is temporarily unavailable.");
  }
  return service;
}

export type ClientWorkspaceAccessRequestRow = {
  id: string;
  clientId: string;
  reviewId: string;
  sectionId: ClientWorkspaceNavSection;
  requestedPackage: ClientWorkspacePackage;
  status: "pending" | "resolved";
  createdAt: string;
};

export async function requestClientWorkspaceAccess(input: {
  token: string;
  section: ClientWorkspaceSectionId | ClientWorkspaceNavSection;
}): Promise<{ ok: boolean; message: string; created?: boolean }> {
  const loaded = await loadReviewEntitlementByToken(input.token);
  if (!loaded.ok) return loaded;
  const entitlementBlock = clientWorkspaceEntitlementBlock(loaded.clientId, loaded.entitlement);
  if (entitlementBlock) {
    return { ok: false, message: entitlementBlock.message };
  }
  if (!loaded.clientId) {
    return { ok: false, message: CLIENT_WORKSPACE_UNAVAILABLE_MESSAGE };
  }
  const section = navSectionForWorkspaceSection(input.section as ClientWorkspaceSectionId);
  if (isClientWorkspaceSectionOpen(loaded.entitlement, section)) {
    return { ok: false, message: "This section is already available." };
  }
  const requestedPackage = section === "approval" ? "live" : section === "commercial" ? "commercial" : "planning";
  const { data: existing } = await db()
    .from("client_workspace_access_requests" as never)
    .select("id")
    .eq("review_id", loaded.review.id)
    .eq("section_id", section)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return { ok: true, message: "Your Thinkway team already has this request.", created: false };
  }
  const { error } = await db()
    .from("client_workspace_access_requests" as never)
    .insert({
      client_id: loaded.clientId,
      review_id: loaded.review.id,
      section_id: section,
      requested_package: requestedPackage,
      status: "pending",
    } as never);
  if (error) {
    if (error.code === "23505") {
      return { ok: true, message: "Your Thinkway team already has this request.", created: false };
    }
    return { ok: false, message: "Could not send this request. Try again." };
  }
  await insertAuditLog(db() as never, {
    action: "submit",
    entity_type: "clients",
    entity_id: loaded.clientId,
    metadata: {
      kind: "client_workspace_access_requested",
      review_id: loaded.review.id,
      section_id: section,
      requested_package: requestedPackage,
    },
  });
  return { ok: true, message: "Request sent to your Thinkway team.", created: true };
}

export async function listPendingClientWorkspaceAccessRequests(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientWorkspaceAccessRequestRow[]> {
  const { data, error } = await supabase
    .from("client_workspace_access_requests" as never)
    .select("id, client_id, review_id, section_id, requested_package, status, created_at")
    .eq("client_id", clientId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as Array<Record<string, string>>).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    reviewId: row.review_id,
    sectionId: row.section_id as ClientWorkspaceNavSection,
    requestedPackage: row.requested_package as ClientWorkspacePackage,
    status: "pending",
    createdAt: row.created_at,
  }));
}
