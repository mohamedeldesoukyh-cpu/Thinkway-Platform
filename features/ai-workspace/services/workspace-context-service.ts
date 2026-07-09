import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AiContext,
  ContextBuilderInput,
  UserContext,
  WorkspaceContext,
  WorkspaceType,
} from "@/features/ai";
import { isUuid } from "@/lib/validation/uuid";

import type { WorkspaceUrlParams } from "../types";

const WORKSPACE_ALIASES: Record<string, WorkspaceType> = {
  campaign: "campaign",
  campaigns: "campaign",
  client: "client",
  clients: "client",
  group: "group",
  groups: "group",
  brand: "brand",
  brands: "brand",
  vendor: "vendor",
  vendors: "vendor",
  creator: "vendor",
  discovery: "discovery",
  shortlist: "discovery",
  shortlists: "discovery",
  report: "general",
  reports: "general",
  general: "general",
};

function resolveWorkspaceType(raw?: string): WorkspaceType {
  if (!raw) return "general";
  return WORKSPACE_ALIASES[raw.toLowerCase()] ?? "general";
}

function resolveEntityId(params: WorkspaceUrlParams): string | undefined {
  return (
    params.id ??
    params.campaignId ??
    params.clientId ??
    params.shortlistId ??
    params.brandId ??
    params.groupId
  );
}

export function parseWorkspaceParams(
  searchParams: Record<string, string | string[] | undefined>
): WorkspaceUrlParams {
  const pick = (key: string) => {
    const value = searchParams[key];
    return typeof value === "string" ? value : undefined;
  };

  return {
    workspace: pick("workspace"),
    id: pick("id"),
    campaignId: pick("campaignId"),
    clientId: pick("clientId"),
    shortlistId: pick("shortlistId"),
    brandId: pick("brandId"),
    groupId: pick("groupId"),
  };
}

export async function buildWorkspaceContextInput(
  supabase: SupabaseClient,
  user: UserContext,
  params: WorkspaceUrlParams
): Promise<Omit<ContextBuilderInput, "request">> {
  const workspaceType = resolveWorkspaceType(params.workspace);
  const entityId = resolveEntityId(params);

  const workspace: WorkspaceContext = {
    type: workspaceType,
    id: entityId,
    label: entityId,
  };

  const context: Omit<ContextBuilderInput, "request"> = {
    workspace,
    user,
  };

  if (!entityId || !isUuid(entityId)) {
    return context;
  }

  try {
    if (workspaceType === "campaign" || params.campaignId) {
      const campaignId = params.campaignId ?? entityId;
      const { data: header } = await supabase
        .from("campaign_headers")
        .select(
          `
          id,
          name,
          document_number,
          status,
          currency_code,
          brand_id,
          client_id,
          group_id,
          po_amount_campaign_currency,
          brand:brands(id, name),
          client:clients(id, name)
        `
        )
        .eq("id", campaignId)
        .maybeSingle();

      if (header) {
        context.campaign = {
          id: header.id,
          code: header.document_number ?? undefined,
          name: header.name,
          status: header.status ?? undefined,
          brandId: header.brand_id ?? undefined,
          clientId: header.client_id ?? undefined,
          poAmount: header.po_amount_campaign_currency ?? undefined,
          currency: header.currency_code ?? undefined,
        };
        context.workspace = {
          type: "campaign",
          id: header.id,
          campaignId: header.id,
          clientId: header.client_id ?? undefined,
          brandId: header.brand_id ?? undefined,
          label: header.name,
        };
        const clientRow = header.client;
        const client =
          clientRow && !Array.isArray(clientRow)
            ? (clientRow as { id: string; name: string })
            : null;
        if (client) {
          context.client = {
            id: client.id,
            name: client.name,
            groupId: header.group_id ?? undefined,
          };
        }
      }
    } else if (workspaceType === "client" || params.clientId) {
      const clientId = params.clientId ?? entityId;
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, group_id, country")
        .eq("id", clientId)
        .maybeSingle();

      if (client) {
        context.client = {
          id: client.id,
          name: client.name,
          groupId: client.group_id ?? undefined,
          country: client.country ?? undefined,
        };
        context.workspace = {
          type: "client",
          id: client.id,
          clientId: client.id,
          label: client.name,
        };
      }
    } else if (params.shortlistId || params.workspace === "shortlist") {
      const shortlistId = params.shortlistId ?? entityId;
      const [{ data: shortlist }, { count }] = await Promise.all([
        supabase
          .from("discovery_shortlists")
          .select("id, name, status")
          .eq("id", shortlistId)
          .maybeSingle(),
        supabase
          .from("discovery_shortlist_items")
          .select("id", { count: "exact", head: true })
          .eq("shortlist_id", shortlistId),
      ]);

      if (shortlist) {
        context.shortlist = {
          id: shortlist.id,
          name: shortlist.name,
          creatorCount: count ?? 0,
          status: shortlist.status,
        };
        context.workspace = {
          type: "discovery",
          id: shortlist.id,
          label: shortlist.name,
        };
      }
    }
  } catch (error) {
    console.warn("[ai-workspace] workspace context fetch failed:", error);
  }

  return context;
}

export function normalizeWorkspaceContext(
  workspace?: Partial<WorkspaceContext>
): WorkspaceContext {
  return {
    type: workspace?.type ?? "general",
    id: workspace?.id,
    campaignId: workspace?.campaignId,
    clientId: workspace?.clientId,
    brandId: workspace?.brandId,
    groupId: workspace?.groupId,
    label: workspace?.label,
  };
}

export function workspaceLabelFromContext(context: Partial<AiContext>): string {
  const ws = context.workspace;
  if (!ws || ws.type === "general") return "General";
  if (ws.label) return ws.label;
  if (context.campaign?.name) return context.campaign.name;
  if (context.client?.name) return context.client.name;
  if (context.shortlist?.name) return context.shortlist.name;
  return ws.type.charAt(0).toUpperCase() + ws.type.slice(1);
}
