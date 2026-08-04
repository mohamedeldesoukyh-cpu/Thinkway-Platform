import type { SupabaseClient } from "@supabase/supabase-js";

import { METADATA_PLATFORM_KEY } from "@/lib/campaigns/constants";
import type {
  BrandFormOption,
  ClientFormOption,
  GroupFormOption,
} from "@/lib/domains/campaign/workspace-types";
import { CAMPAIGNS_PAGE_SIZE } from "@/lib/campaigns/constants";
import { logCampaignGroupAssignmentChange } from "@/lib/campaigns/campaign-group-audit";
import {
  buildDuplicatedCampaignLineInsert,
  copyAssignmentDeliverablesForDuplicate,
} from "@/lib/campaigns/duplicate-campaign-lines";
import { checkClientCreditLimit } from "@/lib/finance/client-credit-exposure";
import type { ClientCreditLimitCheck } from "@/lib/finance/client-credit-exposure";
import { fetchClientRowSafe } from "@/lib/clients/safe-client-query";
import type { AgencyOrDirect } from "@/types/database";
import type { CampaignListItem } from "@/types/database";
import { isUuid } from "@/lib/validation/uuid";

import { aggregateCampaignKpis, emptyToNull, type CampaignKpiLineInput } from "./campaign-commercial";
import {
  deleteCampaignHeader,
  fetchBrandForCampaignCreate,
  fetchCampaignFormOptionsData,
  fetchCampaignInfluencersForDuplicate,
  fetchCampaignKpiSourceData,
  fetchGroupNamesByIds,
  fetchSourceCampaign,
  fetchSourceCampaignLines,
  fetchSourceDeliverables,
  insertCampaignHeader,
  listCampaignHeaderIdsForNav,
  listCampaignHeaders,
  syncListCampaignStatuses,
  enrichCampaignListLifecycleSignals,
  updateCampaignHeaderFields,
  updateCampaignPoFields,
  fetchCampaignHeaderForUpdate,
  type SourceCampaignHeader,
} from "./repositories/campaign-repository";

export type CreateCampaignInput = {
  brand_id: string;
  name: string;
  platform?: string;
  po_amount: number;
  fx_rate: number;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  account_manager_id?: string;
  accept_credit_risk_confirmed?: boolean;
};

export type CreateCampaignResult =
  | {
      ok: true;
      message: string;
      campaignId: string;
      clientId: string;
    }
  | {
      ok: false;
      message: string;
      creditLimit?: ClientCreditLimitCheck;
      fieldErrors?: Record<string, string[]>;
    };

export async function createCampaign(
  supabase: SupabaseClient,
  userId: string,
  input: CreateCampaignInput
): Promise<CreateCampaignResult> {
  const { brand, error: brandError } = await fetchBrandForCampaignCreate(
    supabase,
    input.brand_id
  );
  if (brandError || !brand) {
    return { ok: false, message: brandError ?? "Brand not found." };
  }

  const poAmount = Number(input.po_amount) || 0;

  try {
    const creditCheck = await checkClientCreditLimit(supabase, {
      clientId: brand.client_id,
      additionalAmount: poAmount,
    });

    if (creditCheck.enforced && creditCheck.exceeded) {
      if (creditCheck.can_accept_risk && input.accept_credit_risk_confirmed) {
        // Acknowledged exceedance — proceed.
      } else if (creditCheck.can_accept_risk) {
        return {
          ok: false,
          message: "Client exceeded credit limit.",
          creditLimit: creditCheck,
        };
      } else {
        return {
          ok: false,
          message:
            "Client exceeded credit limit. Enable Accept risk on the client finance profile to proceed with acknowledgment.",
          creditLimit: creditCheck,
        };
      }
    }
  } catch (creditError) {
    return {
      ok: false,
      message:
        creditError instanceof Error
          ? creditError.message
          : "Unable to verify client credit limit.",
    };
  }

  const platform = emptyToNull(input.platform);
  const metadata = platform ? { [METADATA_PLATFORM_KEY]: platform } : {};

  const { data: header, error: headerError } = await insertCampaignHeader(supabase, {
    name: input.name,
    brand,
    status: input.status,
    currency_code: input.currency_code || brand.currency_code,
    start_date: input.start_date,
    end_date: input.end_date,
    account_manager_id: emptyToNull(input.account_manager_id),
    metadata,
    created_by: userId,
  });

  if (headerError) {
    return { ok: false, message: headerError.message };
  }

  const currency = input.currency_code || brand.currency_code;
  const fxRate = Number(input.fx_rate) || 1;

  const { error: poError } = await updateCampaignPoFields(supabase, header.id, {
    currency,
    fxRate,
    poAmount,
  });

  if (poError) {
    await deleteCampaignHeader(supabase, header.id);
    return { ok: false, message: poError.message };
  }

  console.info("[create-campaign] header only — no campaign_lines bootstrap", {
    campaignId: header.id,
    documentNumber: header.document_number,
  });

  return {
    ok: true,
    message: `Campaign ${header.document_number} created. Add assignments when ready.`,
    campaignId: header.id,
    clientId: brand.client_id,
  };
}

export type UpdateCampaignHeaderInput = {
  campaign_id: string;
  name: string;
  description?: string;
  brief?: string;
  status: string;
  platform?: string;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  account_manager_id?: string;
  team_id?: string;
  group_id?: string;
};

export async function updateCampaignHeader(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateCampaignHeaderInput
): Promise<{ ok: true; clientId?: string } | { ok: false; message: string }> {
  const platform = emptyToNull(input.platform);
  const groupId =
    input.group_id !== undefined ? emptyToNull(input.group_id) : undefined;

  const { data: existing, error: existingError } = await fetchCampaignHeaderForUpdate(
    supabase,
    input.campaign_id
  );

  if (existingError) {
    return { ok: false, message: existingError.message };
  }

  const metadata = {
    ...((existing?.metadata as Record<string, unknown>) ?? {}),
    ...(platform ? { [METADATA_PLATFORM_KEY]: platform } : {}),
  };

  const previousGroupId = (existing?.group_id as string | null) ?? null;

  const { error } = await updateCampaignHeaderFields(supabase, input.campaign_id, {
    name: input.name,
    description: emptyToNull(input.description),
    brief: emptyToNull(input.brief),
    status: input.status,
    currency_code: input.currency_code,
    start_date: input.start_date,
    end_date: input.end_date,
    account_manager_id: emptyToNull(input.account_manager_id),
    team_id: emptyToNull(input.team_id),
    ...(groupId !== undefined ? { group_id: groupId } : {}),
    metadata,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  if (groupId !== undefined && previousGroupId !== groupId) {
    const groupIds = [previousGroupId, groupId].filter(Boolean) as string[];
    const groupNameById = await fetchGroupNamesByIds(supabase, groupIds);

    await logCampaignGroupAssignmentChange(supabase, {
      campaignId: input.campaign_id,
      actorId: userId,
      previousGroupId,
      newGroupId: groupId,
      previousGroupName: previousGroupId
        ? groupNameById.get(previousGroupId)
        : null,
      newGroupName: groupId ? groupNameById.get(groupId) : null,
    });
  }

  return {
    ok: true,
    clientId: existing?.client_id as string | undefined,
  };
}

export type DuplicateCampaignInput = {
  source_campaign_id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  live_date?: string | null;
  budget_month?: string;
  po_number?: string;
  copy_notes: boolean;
  copy_workflow: boolean;
  copy_pricing: boolean;
  copy_influencers: boolean;
  copy_deliverables: boolean;
};

export async function duplicateCampaign(
  supabase: SupabaseClient,
  userId: string,
  input: DuplicateCampaignInput
): Promise<
  | { ok: true; message: string; campaignId: string; clientId: string }
  | { ok: false; message: string }
> {
  const sourceId = input.source_campaign_id;

  const { data: source, error: sourceError } = await fetchSourceCampaign(supabase, sourceId);

  if (sourceError || !source) {
    return { ok: false, message: sourceError?.message ?? "Source campaign not found." };
  }

  const src = source as unknown as SourceCampaignHeader;
  const metadata = {
    ...(src.metadata ?? {}),
    ...(input.budget_month ? { budget_month: input.budget_month } : {}),
    ...(input.po_number ? { po_number: input.po_number } : {}),
    duplicated_from: sourceId,
  };

  const { data: newHeader, error: headerError } = await supabase
    .from("campaign_headers")
    .insert({
      name: input.name,
      description: input.copy_notes ? src.description : null,
      brief: input.copy_notes ? src.brief : null,
      brand_id: src.brand_id,
      client_id: src.client_id,
      group_id: src.group_id,
      status: "draft",
      currency_code: src.currency_code,
      category_id: src.category_id,
      subcategory_id: src.subcategory_id,
      agency_or_direct: src.agency_or_direct,
      vr_rate_id: src.vr_rate_id,
      team_id: input.copy_workflow ? src.team_id : null,
      report_type_id: input.copy_workflow ? src.report_type_id : null,
      start_date: input.live_date ?? input.start_date,
      end_date: input.end_date,
      account_manager_id: input.copy_workflow ? src.account_manager_id : null,
      objectives: input.copy_notes ? src.objectives : null,
      metadata,
      created_by: userId,
    })
    .select("id, document_number")
    .single();

  if (headerError || !newHeader) {
    return { ok: false, message: headerError?.message ?? "Failed to create campaign." };
  }

  const { data: sourceLines, error: linesError } = await fetchSourceCampaignLines(
    supabase,
    sourceId
  );

  if (linesError) {
    await deleteCampaignHeader(supabase, newHeader.id);
    return { ok: false, message: linesError.message };
  }

  const lineIdMap = new Map<string, string>();

  type SourceLineRow = Record<string, unknown> & {
    id: string;
    name: string;
    platform: string | null;
    metadata: Record<string, unknown>;
  };

  const sourceLineRows = (sourceLines ?? []) as SourceLineRow[];

  for (const line of sourceLineRows) {
    const { data: newLine, error: lineError } = await supabase
      .from("campaign_lines")
      .insert(
        buildDuplicatedCampaignLineInsert(line, {
          campaignHeaderId: newHeader.id,
          startDate: input.start_date,
          endDate: input.end_date ?? null,
          copyPricing: input.copy_pricing,
          createdBy: userId,
        })
      )
      .select("id")
      .single();

    if (lineError || !newLine) {
      await deleteCampaignHeader(supabase, newHeader.id);
      return { ok: false, message: lineError?.message ?? "Failed to copy line." };
    }

    lineIdMap.set(line.id, newLine.id);
  }

  if (input.copy_influencers) {
    try {
      await copyAssignmentDeliverablesForDuplicate(supabase, {
        sourceLineIds: sourceLineRows.map((line) => line.id),
        lineIdMap,
        newHeaderId: newHeader.id,
        copyPricing: input.copy_pricing,
      });
    } catch (error) {
      await deleteCampaignHeader(supabase, newHeader.id);
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to copy assignment deliverables.",
      };
    }

    type SourceVendor = {
      campaign_line_id: string | null;
      influencer_id: string;
      agreed_fee: number;
      currency: string;
      deliverable_count: number;
    };

    const { data: vendors } = await fetchCampaignInfluencersForDuplicate(supabase, sourceId);

    for (const vendor of (vendors ?? []) as SourceVendor[]) {
      const oldLineId = vendor.campaign_line_id;
      const newLineId = oldLineId ? lineIdMap.get(oldLineId) ?? null : null;

      await supabase.from("campaign_influencers").upsert(
        {
          campaign_id: newHeader.id,
          campaign_header_id: newHeader.id,
          campaign_line_id: newLineId,
          influencer_id: vendor.influencer_id,
          status: "invited",
          agreed_fee: input.copy_pricing ? vendor.agreed_fee : 0,
          currency: vendor.currency,
          deliverable_count: input.copy_deliverables ? vendor.deliverable_count : 0,
          invited_at: new Date().toISOString(),
        },
        { onConflict: "campaign_header_id,campaign_line_id,influencer_id" }
      );
    }
  }

  if (input.copy_deliverables) {
    type SourceDeliverable = {
      influencer_id: string;
      deliverable_type: string;
      title: string;
      platform: string | null;
    };

    const { data: deliverables } = await fetchSourceDeliverables(supabase, sourceId);

    for (const del of (deliverables ?? []) as SourceDeliverable[]) {
      await supabase.from("deliverables").insert({
        document_number: `DEL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        campaign_id: newHeader.id,
        influencer_id: del.influencer_id,
        deliverable_type: del.deliverable_type,
        title: del.title,
        platform: del.platform,
        due_date: input.start_date,
        status: "pending",
        created_by: userId,
      });
    }
  }

  return {
    ok: true,
    message: `Campaign duplicated as ${newHeader.document_number}.`,
    campaignId: newHeader.id,
    clientId: src.client_id,
  };
}

export type CampaignsListResult = {
  campaigns: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getCampaignsList(
  supabase: SupabaseClient,
  params: { page?: number; search?: string }
): Promise<CampaignsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";

  const { data, error, count } = await listCampaignHeaders(supabase, { page, search });

  if (error) {
    throw new Error(error.message);
  }

  const campaigns = (data ?? []) as unknown as CampaignListItem[];
  await syncListCampaignStatuses(supabase, campaigns);
  const enriched = await enrichCampaignListLifecycleSignals(supabase, campaigns);

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CAMPAIGNS_PAGE_SIZE));

  return {
    campaigns: enriched,
    total,
    page,
    pageSize: CAMPAIGNS_PAGE_SIZE,
    totalPages,
  };
}

/** Full filtered id set for Previous/Next navigation (D3). */
export async function getCampaignListNavIds(
  supabase: SupabaseClient,
  params: { search?: string } = {}
): Promise<string[]> {
  const { ids, error } = await listCampaignHeaderIdsForNav(supabase, {
    search: params.search,
  });
  if (error) throw new Error(error.message);
  return ids;
}

export type CampaignsKpis = {
  total_campaigns: number;
  total_revenue: number;
  avg_margin: number;
  assignments: number;
  currency_code: string;
};

export async function getCampaignsKpis(supabase: SupabaseClient): Promise<CampaignsKpis> {
  const [headersResult, linesResult, assignmentsResult] =
    await fetchCampaignKpiSourceData(supabase);

  const headers = (headersResult.data ?? []) as {
    id: string;
    status: string;
    currency_code: string | null;
  }[];
  const lines = (linesResult.data ?? []) as CampaignKpiLineInput[];
  const assignments = (assignmentsResult.data ?? []) as {
    id: string;
    campaign_header_id: string | null;
  }[];

  return aggregateCampaignKpis(headers, lines, assignments);
}

export type CampaignFormOptions = {
  groups: GroupFormOption[];
  clients: ClientFormOption[];
  brands: BrandFormOption[];
  accountManagers: {
    id: string;
    full_name: string | null;
    email: string;
  }[];
  masterData: Awaited<ReturnType<typeof fetchCampaignFormOptionsData>>[3];
};

export async function getCampaignFormOptions(
  supabase: SupabaseClient
): Promise<CampaignFormOptions> {
  const [groups, clients, brands, masterData, managersResult] =
    await fetchCampaignFormOptionsData(supabase);

  if (managersResult.error) {
    throw new Error(managersResult.error.message);
  }

  const clientList = (clients ?? []) as ClientFormOption[];
  const taxonomyByClientId = new Map(
    clientList.map((client) => [
      client.id,
      {
        client_category: client.client_category ?? null,
        client_subcategory: client.client_subcategory ?? null,
      },
    ])
  );

  const enrichedBrands = (brands ?? []).map((brand) => {
    const row = brand as BrandFormOption;
    const taxonomy = taxonomyByClientId.get(row.client_id);
    if (!taxonomy || !row.client) {
      return row;
    }
    return {
      ...row,
      client: {
        ...row.client,
        client_category:
          row.client.client_category ?? taxonomy.client_category ?? null,
        client_subcategory:
          row.client.client_subcategory ?? taxonomy.client_subcategory ?? null,
      },
    };
  });

  return {
    groups: groups ?? [],
    clients: clientList,
    brands: enrichedBrands,
    masterData,
    accountManagers: managersResult.data ?? [],
  };
}

export type ClientTaxonomyResult = {
  ok: boolean;
  client_category: string | null;
  client_subcategory: string | null;
  message?: string;
};

export async function getClientTaxonomy(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientTaxonomyResult> {
  if (!isUuid(clientId)) {
    return {
      ok: false,
      client_category: null,
      client_subcategory: null,
      message: "Invalid client.",
    };
  }

  const { row, error } = await fetchClientRowSafe(supabase, clientId, [
    "client_category",
    "client_subcategory",
  ]);

  if (error) {
    return {
      ok: false,
      client_category: null,
      client_subcategory: null,
      message: error.message,
    };
  }

  return {
    ok: true,
    client_category: (row?.client_category as string | null | undefined) ?? null,
    client_subcategory:
      (row?.client_subcategory as string | null | undefined) ?? null,
  };
}
