import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchVrRatesByIds,
  vrRatePercentFromMap,
} from "@/lib/clients/vr-rate-lookup";

import {
  formatMargin,
  isActiveCampaignStatus,
  type GroupWorkspace,
} from "./types";

type CampaignHeaderWithLines = {
  id: string;
  document_number: string;
  name: string;
  status: string;
  client_id: string | null;
  brand_id: string | null;
  created_at: string;
  brand: { name: string } | null;
  client: { name: string } | null;
  lines:
    | {
        revenue_base?: number;
        cost_base?: number;
        profit_base?: number;
        revenue?: number;
        cost?: number;
        profit?: number;
      }[]
    | null;
};

export const GROUPS_PAGE_SIZE = 10;

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return { supabase, user };
}

export async function getGroupsList(params: {
  page?: number;
  search?: string;
}) {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * GROUPS_PAGE_SIZE;
  const to = from + GROUPS_PAGE_SIZE - 1;

  const { supabase } = await requireUser();

  let query = supabase
    .from("groups")
    .select("*", { count: "exact" })
    .order("name");

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;

  return {
    groups: data ?? [],
    total,
    page,
    pageSize: GROUPS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / GROUPS_PAGE_SIZE)),
  };
}

export async function getGroupWorkspace(
  groupId: string
): Promise<GroupWorkspace | null> {
  const { supabase } = await requireUser();

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select(
      `
      *,
      account_director:profiles!groups_account_director_id_fkey(id, full_name, email)
    `
    )
    .eq("id", groupId)
    .maybeSingle();

  if (groupError) {
    throw new Error(groupError.message);
  }
  if (!group) {
    return null;
  }

  const [
    clientsResult,
    brandsResult,
    headersResult,
    documentsResult,
    auditResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, document_number, name, legal_name, country, currency, payment_terms, agency_or_direct, status, vr_rate_id"
      )
      .eq("group_id", groupId)
      .order("name"),
    supabase
      .from("brands")
      .select(
        `
        id, document_number, name, status, currency_code,
        category_id, subcategory_id, vr_rate_id,
        category:md_categories(name),
        subcategory:md_subcategories(name),
        vr_rate:md_vr_rates(rate_percent),
        client:clients(id, name)
      `
      )
      .eq("group_id", groupId)
      .order("name"),
    supabase
      .from("campaign_headers")
      .select(
        `
        id, document_number, name, status, client_id, brand_id, created_at,
        brand:brands(name),
        client:clients(name),
        lines:campaign_lines(revenue_base, cost_base, profit_base, revenue, cost, profit)
      `
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    supabase
      .from("group_documents")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, created_at, actor_id, new_data")
      .or(
        [
          `and(entity_type.eq.groups,entity_id.eq.${groupId})`,
          `entity_type.eq.clients`,
          `entity_type.eq.brands`,
          `entity_type.eq.campaign_headers`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  if (clientsResult.error) {
    throw new Error(clientsResult.error.message);
  }
  if (brandsResult.error) {
    throw new Error(brandsResult.error.message);
  }
  if (headersResult.error) {
    throw new Error(headersResult.error.message);
  }
  if (documentsResult.error) {
    throw new Error(documentsResult.error.message);
  }

  const clients = clientsResult.data ?? [];
  const clientIds = clients.map((c) => c.id);
  const clientVrRateMap = await fetchVrRatesByIds(
    supabase,
    clients.map((c) => (c as { vr_rate_id: string | null }).vr_rate_id)
  );

  let billingOutstanding = 0;
  if (clientIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("total, amount_paid, status")
      .in("client_id", clientIds)
      .not("status", "in", "(paid,void,draft)");

    billingOutstanding = (invoices ?? []).reduce(
      (sum, inv) =>
        sum + Math.max(0, Number(inv.total) - Number(inv.amount_paid)),
      0
    );
  }

  const headers = (headersResult.data ?? []) as unknown as CampaignHeaderWithLines[];
  const headerIds = new Set(headers.map((h) => h.id));

  let totalRevenue = 0;
  let totalCost = 0;
  let totalGp = 0;

  const revenueByClient = new Map<string, number>();
  const activeCampaignsByClient = new Map<string, number>();
  const activeCampaignsByBrand = new Map<string, number>();

  for (const header of headers) {
    const lines = header.lines ?? [];

    let headerRevenue = 0;
    for (const line of lines) {
      const rev = Number(line.revenue_base ?? line.revenue ?? 0);
      const cost = Number(line.cost_base ?? line.cost ?? 0);
      const gp = Number(line.profit_base ?? line.profit ?? rev - cost);
      totalRevenue += rev;
      totalCost += cost;
      totalGp += gp;
      headerRevenue += rev;
    }

    if (header.client_id) {
      revenueByClient.set(
        header.client_id,
        (revenueByClient.get(header.client_id) ?? 0) + headerRevenue
      );
      if (isActiveCampaignStatus(header.status)) {
        activeCampaignsByClient.set(
          header.client_id,
          (activeCampaignsByClient.get(header.client_id) ?? 0) + 1
        );
      }
    }
    if (header.brand_id && isActiveCampaignStatus(header.status)) {
      activeCampaignsByBrand.set(
        header.brand_id,
        (activeCampaignsByBrand.get(header.brand_id) ?? 0) + 1
      );
    }
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  );

  const clientIdSet = new Set(clientIds);
  const brandIds = (brandsResult.data ?? []).map((b) => (b as { id: string }).id);
  const brandIdSet = new Set(brandIds);

  const filteredAudit = (auditResult.data ?? []).filter((log) => {
    if (log.entity_type === "groups" && log.entity_id === groupId) {
      return true;
    }
    if (log.entity_type === "clients" && log.entity_id && clientIdSet.has(log.entity_id)) {
      return true;
    }
    if (log.entity_type === "brands" && log.entity_id && brandIdSet.has(log.entity_id)) {
      return true;
    }
    if (log.entity_type === "campaign_headers" && log.entity_id && headerIds.has(log.entity_id)) {
      return true;
    }
    return false;
  });

  const groupRow = group as unknown as {
    id: string;
    document_number: string;
    name: string;
    region: string | null;
    status: GroupWorkspace["status"];
    notes: string | null;
    created_at: string;
    account_director: GroupWorkspace["account_director"];
  };

  return {
    id: groupRow.id,
    document_number: groupRow.document_number,
    name: groupRow.name,
    region: groupRow.region,
    status: groupRow.status,
    notes: groupRow.notes,
    created_at: groupRow.created_at,
    account_director: groupRow.account_director,
    counts: {
      legal_entities: clients.length,
      brands: (brandsResult.data ?? []).length,
      campaigns: headers.length,
    },
    financials: {
      total_revenue: totalRevenue,
      total_cost: totalCost,
      total_gp: totalGp,
      margin_percent: formatMargin(totalRevenue, totalGp),
      billing_outstanding: billingOutstanding,
      campaign_count: headers.length,
      active_campaign_count: headers.filter((h) =>
        isActiveCampaignStatus(h.status)
      ).length,
    },
    legal_entities: clients.map((c) => {
      const row = c as typeof c & {
        vr_rate_id: string | null;
      };
      return {
      id: row.id,
      document_number: row.document_number,
      name: row.name,
      legal_name: row.legal_name,
      country: row.country,
      currency: row.currency,
      payment_terms: row.payment_terms,
      agency_or_direct: row.agency_or_direct as GroupWorkspace["legal_entities"][number]["agency_or_direct"],
      status: row.status,
      active_campaigns: activeCampaignsByClient.get(row.id) ?? 0,
      revenue: revenueByClient.get(row.id) ?? 0,
      vr_rate_id: row.vr_rate_id,
      vr_rate_percent: vrRatePercentFromMap(clientVrRateMap, row.vr_rate_id),
    };
    }),
    brands: (brandsResult.data ?? []).map((b) => {
      const row = b as unknown as {
        id: string;
        document_number: string;
        name: string;
        status: GroupWorkspace["brands"][number]["status"];
        currency_code: string;
        category_id: string | null;
        subcategory_id: string | null;
        vr_rate_id: string | null;
        category: { name: string } | null;
        subcategory: { name: string } | null;
        vr_rate: { rate_percent: number } | null;
        client: { id: string; name: string } | null;
      };
      return {
        id: row.id,
        document_number: row.document_number,
        name: row.name,
        status: row.status,
        currency_code: row.currency_code,
        category_id: row.category_id,
        subcategory_id: row.subcategory_id,
        vr_rate_id: row.vr_rate_id,
        category_name: row.category?.name ?? null,
        subcategory_name: row.subcategory?.name ?? null,
        vr_rate_percent: row.vr_rate?.rate_percent ?? null,
        active_campaigns: activeCampaignsByBrand.get(row.id) ?? 0,
        client_id: row.client?.id ?? "",
        client_name: row.client?.name ?? "",
      };
    }),
    documents: (documentsResult.data ?? []) as unknown as GroupWorkspace["documents"],
    activity: filteredAudit.slice(0, 25).map((log) => {
      const actor = log.actor_id ? profileMap.get(log.actor_id) : null;
      return {
        id: log.id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        created_at: log.created_at,
        actor: actor
          ? {
              id: actor.id,
              full_name: actor.full_name,
              email: actor.email,
            }
          : null,
        summary: `${log.action} · ${log.entity_type}`,
      };
    }),
    recent_campaigns: headers.slice(0, 10).map((h) => {
      const revenue = (h.lines ?? []).reduce(
        (s, l) => s + Number(l.revenue_base ?? l.revenue ?? 0),
        0
      );
      return {
        id: h.id,
        document_number: h.document_number,
        name: h.name,
        status: h.status,
        brand_name: h.brand?.name ?? null,
        client_name: h.client?.name ?? null,
        revenue,
        created_at: h.created_at,
      };
    }),
  };
}

export async function getAccountDirectorsForSelect() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
