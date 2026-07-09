import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignSnapshot, ClientSnapshot } from "@/features/ai";
import { getCampaignWorkspace } from "@/lib/services/campaigns/campaign-workspace-service";

import type {
  BrandSnapshot,
  CreatorSnapshot,
  ResolvedEntity,
  WorkspaceKnowledge,
} from "../types";

export type LoadedSnapshots = {
  campaign?: CampaignSnapshot;
  client?: ClientSnapshot;
  brand?: BrandSnapshot;
  creators?: CreatorSnapshot[];
};

export async function loadKnowledgeSnapshots(
  supabase: SupabaseClient,
  entities: ResolvedEntity[],
  workspace: WorkspaceKnowledge
): Promise<LoadedSnapshots> {
  const result: LoadedSnapshots = {
    campaign: workspace.campaign,
    client: workspace.client,
    brand: workspace.brand,
    creators: [],
  };

  const topCampaign = entities.find((e) => e.type === "campaign" && e.confidence >= 80);
  const topClient = entities.find((e) => e.type === "client" && e.confidence >= 80);
  const topBrand = entities.find((e) => e.type === "brand" && e.confidence >= 80);
  const creatorEntities = entities.filter(
    (e) =>
      (e.type === "creator" || e.type === "creator_handle" || e.type === "influencer") &&
      e.confidence >= 70
  );

  const tasks: Array<Promise<void>> = [];

  if (topCampaign && !result.campaign) {
    tasks.push(
      (async () => {
        try {
          const ws = await getCampaignWorkspace(
            supabase,
            workspace.user?.id ?? "",
            topCampaign.id
          );
          if (ws) {
            result.campaign = {
              id: ws.id,
              code: ws.document_number ?? undefined,
              name: ws.name,
              status: ws.status ?? undefined,
              brandId: ws.brand?.id ?? undefined,
              clientId: ws.client?.id ?? undefined,
              poAmount:
                ws.financials?.po_total ??
                ws.po?.po_amount_campaign_currency ??
                undefined,
              currency: ws.currency_code ?? undefined,
            };
            if (ws.client && !result.client) {
              result.client = {
                id: ws.client.id,
                name: ws.client.name,
                groupId: ws.group?.id ?? undefined,
              };
            }
            if (ws.brand && !result.brand) {
              result.brand = {
                id: ws.brand.id,
                name: ws.brand.name,
                documentNumber: ws.brand.document_number ?? undefined,
                clientId: ws.client?.id ?? undefined,
                groupId: ws.group?.id ?? undefined,
              };
            }
          }
        } catch {
          result.campaign = {
            id: topCampaign.id,
            name: topCampaign.label,
          };
        }
      })()
    );
  }

  if (topClient && !result.client) {
    tasks.push(
      (async () => {
        try {
          const { data } = await supabase
            .from("clients")
            .select("id, name, group_id, country")
            .eq("id", topClient.id)
            .maybeSingle();
          if (data) {
            result.client = {
              id: data.id,
              name: data.name,
              groupId: data.group_id ?? undefined,
              country: data.country ?? undefined,
            };
          }
        } catch {
          result.client = { id: topClient.id, name: topClient.label };
        }
      })()
    );
  }

  if (topBrand && !result.brand) {
    tasks.push(
      (async () => {
        try {
          const { data } = await supabase
            .from("brands")
            .select("id, name, document_number, client_id, group_id, category_id")
            .eq("id", topBrand.id)
            .maybeSingle();
          if (data) {
            result.brand = {
              id: data.id,
              name: data.name,
              documentNumber: data.document_number ?? undefined,
              clientId: data.client_id ?? undefined,
              groupId: data.group_id ?? undefined,
              categoryId: data.category_id ?? undefined,
            };
          }
        } catch {
          result.brand = { id: topBrand.id, name: topBrand.label };
        }
      })()
    );
  }

  if (creatorEntities.length) {
    tasks.push(
      (async () => {
        result.creators = creatorEntities.slice(0, 10).map((e) => ({
          id: e.id,
          handle: e.label.replace(/^@+/, ""),
          displayName: e.label,
          platform: (e.metadata?.platform as string) ?? undefined,
          sourceType: e.metadata?.sourceType as "influencer" | "discovered" | undefined,
        }));
      })()
    );
  }

  await Promise.all(tasks);
  return result;
}
