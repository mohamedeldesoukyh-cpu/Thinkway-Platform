import type { Database, Json, ShortlistVisibilityV2 } from "@/types/database";

type ShortlistItemInsert = Database["public"]["Tables"]["discovery_shortlist_items"]["Insert"];

export type ShortlistItemDuplicateSource = {
  profile_id: string | null;
  influencer_id: string | null;
  unified_id: string | null;
  notes: string | null;
  match_score: number | null;
  sort_order: number;
  platform_account_ids: string[] | null;
  commercial_input_mode: ShortlistItemInsert["commercial_input_mode"];
  cost: number | null;
  cost_currency: string | null;
  gp_pct: number | null;
  gp_value: number | null;
  revenue: number | null;
  fx_rate_to_egp: number | null;
  cost_egp: number | null;
  revenue_egp: number | null;
  gp_value_egp: number | null;
  deliverables: Json;
  commercial_updated_at: string | null;
  option_number: number | null;
  service_description: string | null;
  collapse_group_id: string | null;
  collapse_label: string | null;
};

export type ShortlistDuplicateHeaderSource = {
  name: string;
  description: string | null;
  visibility: ShortlistVisibilityV2 | null;
  client_id: string | null;
  brand_id: string | null;
  metadata: Record<string, unknown> | null;
};

/** Header insert for a duplicated shortlist. Never copies serial, quotation, campaign, or the optional currency column (Production stores currency in metadata). */
export function buildDuplicatedShortlistInsert(
  source: ShortlistDuplicateHeaderSource,
  ownerId: string
): Database["public"]["Tables"]["discovery_shortlists"]["Insert"] {
  const visibility: ShortlistVisibilityV2 =
    source.visibility === "client_shared" ? "team" : (source.visibility ?? "private");
  return {
    name: duplicateShortlistName(source.name),
    description: source.description,
    owner_id: ownerId,
    created_by: ownerId,
    visibility,
    status: "draft",
    client_id: source.client_id,
    brand_id: source.brand_id,
    metadata: source.metadata ?? {},
  };
}

const COPY_SUFFIX = /\s\(copy(?: (\d+))?\)$/i;

/** Next draft name. Serial is allocated by the database, not copied. */
export function duplicateShortlistName(name: string): string {
  const trimmed = name.trim() || "Shortlist";
  const match = trimmed.match(COPY_SUFFIX);
  if (!match) return `${trimmed} (copy)`;
  const next = Number(match[1] ?? "1") + 1;
  return `${trimmed.replace(COPY_SUFFIX, "")} (copy ${next})`;
}

export function mapDuplicatedShortlistItems(
  sourceItems: ShortlistItemDuplicateSource[],
  newShortlistId: string,
  addedBy: string,
  newGroupId: () => string = () => crypto.randomUUID()
): ShortlistItemInsert[] {
  const collapseIds = new Map<string, string>();

  return sourceItems.map((item) => {
    let collapseGroupId = item.collapse_group_id;
    if (collapseGroupId) {
      const mapped = collapseIds.get(collapseGroupId) ?? newGroupId();
      collapseIds.set(collapseGroupId, mapped);
      collapseGroupId = mapped;
    }

    return {
      shortlist_id: newShortlistId,
      profile_id: item.profile_id,
      influencer_id: item.influencer_id,
      unified_id: item.unified_id,
      notes: item.notes,
      match_score: item.match_score,
      sort_order: item.sort_order,
      added_by: addedBy,
      item_status: "draft",
      platform_account_ids: item.platform_account_ids ?? [],
      commercial_input_mode: item.commercial_input_mode,
      cost: item.cost,
      cost_currency: item.cost_currency,
      gp_pct: item.gp_pct,
      gp_value: item.gp_value,
      revenue: item.revenue,
      fx_rate_to_egp: item.fx_rate_to_egp,
      cost_egp: item.cost_egp,
      revenue_egp: item.revenue_egp,
      gp_value_egp: item.gp_value_egp,
      deliverables: item.deliverables,
      commercial_updated_at: item.commercial_updated_at,
      option_number: item.option_number,
      service_description: item.service_description,
      collapse_group_id: collapseGroupId,
      collapse_label: item.collapse_label,
    };
  });
}
