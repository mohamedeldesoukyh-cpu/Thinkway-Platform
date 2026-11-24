"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { isUuid } from "@/lib/validation/uuid";
import { mapClientReviewRow, type ReviewRow } from "../persist-client-review";
import { resolveReviewLegalEntityId } from "../load-entitlement";
import { groupClientWorkspaceChoices, type ClientWorkspaceChoiceRow } from "../workspace-settings-target";
import { loadWorkspaceSettings } from "../load-tab-visibility";
import { parseHiddenWorkspaceTabs } from "../tab-visibility";
import { CLIENT_WORKSPACE_NAV_SECTIONS } from "../entitlement";

async function authorizeClient(clientId: string) {
  if (!isUuid(clientId)) throw new Error("Invalid client.");
  const userDb = await createSupabaseServerClient();
  const permission = await requirePermission(userDb, "clients.write");
  if ("error" in permission) throw new Error("You do not have permission to manage client workspaces.");
  const { data, error } = await userDb.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (error || !data) throw new Error("You do not have access to this client.");
  return userDb;
}

async function authorize(clientId: string, reviewId: string) {
  const userDb = await authorizeClient(clientId);
  if (!isUuid(reviewId)) throw new Error("Invalid workspace.");
  const { data, error } = await userDb.from("campaign_client_reviews").select("*").eq("id", reviewId).maybeSingle();
  if (error || !data) throw new Error("You do not have access to this workspace.");
  const review = mapClientReviewRow(data as ReviewRow);
  const db = createServiceRoleClient();
  if (await resolveReviewLegalEntityId(db, review) !== clientId) throw new Error("This workspace does not belong to this client.");
  return { db, workspaceId: review.journeyId || review.id };
}

export async function listClientWorkspacesAction(clientId: string) {
  try {
    const db = await authorizeClient(clientId);
    const groups = await Promise.all(["campaign_headers", "quotations", "discovery_shortlists"].map(async (relation) => {
      const rows: ClientWorkspaceChoiceRow[] = [];
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await db.from("campaign_client_reviews")
          .select(`id, journey_id, campaign_name, source, status, review_number, created_at, ${relation}!inner(client_id)`)
          .eq(`${relation}.client_id`, clientId).order("created_at", { ascending: false }).order("id").range(offset, offset + 199);
        if (error) throw error;
        rows.push(...data as unknown as ClientWorkspaceChoiceRow[]);
        if (data.length < 200) break;
      }
      return rows;
    }));
    return { ok: true as const, workspaces: groupClientWorkspaceChoices(groups.flat()) };
  } catch {
    return { ok: false as const, message: "Could not load this client’s workspaces. Check your client-management access and try again." };
  }
}

export async function loadWorkspaceSettingsAction(clientId: string, reviewId: string) {
  try {
    const { db, workspaceId } = await authorize(clientId, reviewId);
    return { ok: true as const, ...await loadWorkspaceSettings(db, workspaceId) };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Could not load workspace settings." };
  }
}

export async function saveWorkspaceSettingsAction(clientId: string, reviewId: string, input: unknown, refreshLimit: number) {
  try {
    const { db, workspaceId } = await authorize(clientId, reviewId);
    const hiddenTabs = parseHiddenWorkspaceTabs(input);
    if (!Number.isInteger(refreshLimit) || refreshLimit < 0 || refreshLimit > 1000) return { ok: false as const, message: "Enter a refresh allowance from 0 to 1000." };
    if (!Array.isArray(input) || input.some((value) => !CLIENT_WORKSPACE_NAV_SECTIONS.includes(value)) || hiddenTabs.length >= CLIENT_WORKSPACE_NAV_SECTIONS.length) {
      return { ok: false as const, message: "Keep at least one workspace tab visible." };
    }
    const { error } = await db.from("client_workspace_tab_settings").upsert({
      workspace_id: workspaceId, hidden_tabs: hiddenTabs, refresh_limit: refreshLimit, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Could not save workspace settings.");
    return { ok: true as const, hiddenTabs, refreshLimit };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Could not save workspace settings." };
  }
}
