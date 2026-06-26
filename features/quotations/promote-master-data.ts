"use server";

import { revalidatePath } from "next/cache";

import { logClientOnboardingEvent } from "@/lib/clients/onboarding-audit";
import { DEFAULT_PROMOTED_ONBOARDING_STATUS } from "@/lib/clients/onboarding-status";
import { insertClientWithClassificationAudit, updateClientWithOptionalColumnRetry } from "@/lib/clients/classification-audit-columns";
import { normalizeBrandVrRateId } from "@/lib/clients/vr-inheritance";
import { fetchClientVrRateIdSafe } from "@/lib/clients/vr-rate-lookup";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  findDuplicateBrand,
  findDuplicateClient,
} from "@/lib/validation/checks";
import { normalizeEntityName } from "@/lib/validation/hierarchy";
import type { AgencyOrDirect, Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  rankDuplicateResults,
  scoreBrandDuplicate,
  scoreClientDuplicate,
  type BrandDuplicateCandidate,
  type ClientDuplicateCandidate,
  type DuplicateSearchResult,
} from "./duplicate-search";
import {
  resolvePromoteCase,
  type PromoteMasterDataInput,
} from "./promote-master-data-schema";
import type { ActionResult } from "./types";

type Supabase = SupabaseClient<Database>;

export type PromoteDuplicateWarning = {
  field: "client" | "brand" | "legal_name";
  message: string;
};

export type PromoteDuplicateSuggestion = {
  id: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  matchType: DuplicateSearchResult<ClientDuplicateCandidate | BrandDuplicateCandidate>["matchType"];
  score: number;
  clientId?: string;
};

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

async function findSimilarClientByLegalName(
  supabase: Supabase,
  legalName: string,
  excludeClientId?: string
): Promise<string | null> {
  const normalized = normalizeEntityName(legalName);
  if (!normalized) return null;

  let query = supabase
    .from("clients")
    .select("id, legal_name")
    .neq("status", "archived")
    .limit(5);

  if (excludeClientId) {
    query = query.neq("id", excludeClientId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as Array<{ id: string; legal_name: string | null }>) {
    const candidate = row.legal_name?.trim();
    if (candidate && normalizeEntityName(candidate) === normalized) {
      return `A legal entity with legal name "${candidate}" may already exist.`;
    }
  }
  return null;
}

export async function searchPromoteDuplicateClients(input: {
  query: string;
  agencyOrDirect?: AgencyOrDirect;
  excludeClientId?: string | null;
}): Promise<ActionResult<{ suggestions: PromoteDuplicateSuggestion[] }>> {
  const query = input.query.trim();
  if (query.length < 2) {
    return { ok: true, data: { suggestions: [] } };
  }

  const supabase = (await createSupabaseServerClient()) as Supabase;
  const pattern = `%${escapeIlikePattern(query)}%`;

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, legal_name, document_number, agency_or_direct, name_ar")
    .neq("status", "archived")
    .or(
      [
        `name.ilike.${pattern}`,
        `legal_name.ilike.${pattern}`,
        `document_number.ilike.${pattern}`,
        `name_ar.ilike.${pattern}`,
      ].join(",")
    )
    .limit(20);

  if (error) {
    return { ok: false, message: error.message };
  }

  const scored = rankDuplicateResults(
    ((data ?? []) as ClientDuplicateCandidate[])
      .filter((row) => !input.excludeClientId || row.id !== input.excludeClientId)
      .map((row) => scoreClientDuplicate(query, row, input.agencyOrDirect))
      .filter((row): row is DuplicateSearchResult<ClientDuplicateCandidate> => row !== null)
  ).slice(0, 5);

  return {
    ok: true,
    data: {
      suggestions: scored.map((row) => ({
        id: row.id,
        primaryLabel: row.name,
        secondaryLabel: [row.document_number, row.legal_name].filter(Boolean).join(" · ") || null,
        matchType: row.matchType,
        score: row.score,
      })),
    },
  };
}

export async function searchPromoteDuplicateBrands(input: {
  query: string;
  clientId?: string | null;
  excludeBrandId?: string | null;
}): Promise<ActionResult<{ suggestions: PromoteDuplicateSuggestion[] }>> {
  const query = input.query.trim();
  if (query.length < 2) {
    return { ok: true, data: { suggestions: [] } };
  }

  const supabase = (await createSupabaseServerClient()) as Supabase;
  const pattern = `%${escapeIlikePattern(query)}%`;

  let dbQuery = supabase
    .from("brands")
    .select("id, name, document_number, client_id, client:clients(name)")
    .neq("status", "archived")
    .or([`name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(","))
    .limit(20);

  if (input.clientId) {
    dbQuery = dbQuery.eq("client_id", input.clientId);
  }

  const { data, error } = await dbQuery;
  if (error) {
    return { ok: false, message: error.message };
  }

  const scored = rankDuplicateResults(
    ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => {
        const clientEmbed = row.client as { name: string } | { name: string }[] | null;
        const clientName = Array.isArray(clientEmbed)
          ? clientEmbed[0]?.name ?? null
          : clientEmbed?.name ?? null;
        const candidate: BrandDuplicateCandidate = {
          id: row.id as string,
          name: row.name as string,
          document_number: row.document_number as string,
          client_id: row.client_id as string,
          client_name: clientName,
        };
        if (input.excludeBrandId && candidate.id === input.excludeBrandId) return null;
        return scoreBrandDuplicate(query, candidate);
      })
      .filter((row): row is DuplicateSearchResult<BrandDuplicateCandidate> => row !== null)
  ).slice(0, 5);

  return {
    ok: true,
    data: {
      suggestions: scored.map((row) => ({
        id: row.id,
        primaryLabel: row.name,
        secondaryLabel:
          [row.document_number, row.client_name].filter(Boolean).join(" · ") || null,
        matchType: row.matchType,
        score: row.score,
        clientId: row.client_id,
      })),
    },
  };
}

export async function checkPromoteMasterDataDuplicates(
  input: Omit<PromoteMasterDataInput, "quotationId" | "acknowledged">
): Promise<ActionResult<{ warnings: PromoteDuplicateWarning[] }>> {
  const supabase = (await createSupabaseServerClient()) as Supabase;

  const warnings: PromoteDuplicateWarning[] = [];

  try {
    if (input.clientMode === "create" && input.clientName && !input.clientDuplicateOverride) {
      const duplicate = await findDuplicateClient(
        supabase,
        input.clientName,
        input.agencyOrDirect as AgencyOrDirect
      );
      if (duplicate) {
        warnings.push({ field: "client", message: duplicate });
      }
      if (input.legalName) {
        const legalDup = await findSimilarClientByLegalName(supabase, input.legalName);
        if (legalDup) {
          warnings.push({ field: "legal_name", message: legalDup });
        }
      }
    }

    if (input.brandMode === "create" && input.brandName && !input.brandDuplicateOverride) {
      const clientId =
        input.clientMode === "link" ? input.existingClientId : null;
      if (clientId) {
        const duplicate = await findDuplicateBrand(supabase, input.brandName, clientId);
        if (duplicate) {
          warnings.push({ field: "brand", message: duplicate });
        }
      }
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Duplicate check failed.",
    };
  }

  return { ok: true, data: { warnings } };
}

async function resolveBrandGroupContext(
  supabase: Supabase,
  clientId: string,
  inputGroupId: string | null
): Promise<{ groupId: string | null; vrRateId: string | null }> {
  const { data, error } = await supabase
    .from("clients")
    .select("group_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Legal entity not found.");
  }

  let groupId = (data as { group_id: string | null }).group_id ?? inputGroupId;
  if (!groupId && inputGroupId) {
    groupId = inputGroupId;
  }

  const vrRateId = await fetchClientVrRateIdSafe(supabase, clientId);
  if (vrRateId.error) {
    throw new Error(vrRateId.error);
  }

  return { groupId, vrRateId: vrRateId.value };
}

async function applyClientOwnershipPatch(
  supabase: Supabase,
  clientId: string,
  input: PromoteMasterDataInput
) {
  const patch: Record<string, unknown> = {};
  if (input.groupId !== undefined) patch.group_id = input.groupId;
  if (input.clientOwnerId) patch.client_owner_id = input.clientOwnerId;
  if (input.countryManagerId) patch.country_manager_id = input.countryManagerId;
  if (input.commercialOwnerId) patch.account_manager_id = input.commercialOwnerId;

  if (Object.keys(patch).length === 0) return;

  await updateClientWithOptionalColumnRetry(supabase, clientId, patch);
}

export async function executePromoteMasterData(
  supabase: Supabase,
  userId: string,
  input: PromoteMasterDataInput,
  quotationRow: Record<string, unknown>
): Promise<
  ActionResult<{
    clientId: string;
    brandId: string | null;
    case: ReturnType<typeof resolvePromoteCase>;
    auditFlags: {
      clientDuplicateOverridden: boolean;
      brandDuplicateOverridden: boolean;
      existingClientLinked: boolean;
    };
  }>
> {
  const promoteCase = resolvePromoteCase(input);
  let clientId: string | null =
    input.clientMode === "link" ? input.existingClientId : null;
  let brandId: string | null =
    input.brandMode === "link" ? input.existingBrandId : null;

  const tempClientName = String(quotationRow.temporary_client_name ?? "").trim();
  const tempBrandName = String(quotationRow.temporary_brand_name ?? "").trim();
  const quotationCurrency = (quotationRow.currency as string) ?? "EGP";

  let clientDuplicateOverridden = false;
  let brandDuplicateOverridden = false;
  const existingClientLinked = input.clientMode === "link";

  if (input.clientMode === "create") {
    const clientName = input.clientName?.trim() || tempClientName;
    if (!clientName) {
      return { ok: false, message: "Client name is required." };
    }

    const duplicate = await findDuplicateClient(
      supabase,
      clientName,
      input.agencyOrDirect as AgencyOrDirect
    );
    if (duplicate && input.clientDuplicateOverride) {
      clientDuplicateOverridden = true;
    }

    const { data: client, error: clientError } = await insertClientWithClassificationAudit(
      supabase,
      {
        name: clientName,
        legal_name: emptyToNull(input.legalName) ?? clientName,
        group_id: input.groupId,
        agency_or_direct: input.agencyOrDirect as AgencyOrDirect,
        industry: emptyToNull(input.industry),
        website: emptyToNull(input.website),
        country: emptyToNull(input.country),
        status: "prospect",
        onboarding_status: DEFAULT_PROMOTED_ONBOARDING_STATUS,
        onboarding_updated_by: userId,
        client_owner_id: input.clientOwnerId,
        country_manager_id: input.countryManagerId,
        account_manager_id: input.commercialOwnerId,
        currency: quotationCurrency,
        created_by: userId,
      },
      {
        classification_source: null,
        classification_confidence: null,
        classification_reason: null,
        classified_at: null,
        approved_by_user: null,
        last_verified_at: null,
        needs_review: false,
      }
    );

    if (clientError || !client) {
      return {
        ok: false,
        message: clientError?.message ?? "Failed to create legal entity.",
      };
    }

    clientId = (client as { id: string }).id;
  } else if (clientId) {
    await applyClientOwnershipPatch(supabase, clientId, input);
  }

  if (!clientId) {
    return { ok: false, message: "Legal entity could not be resolved." };
  }

  if (input.brandMode === "create") {
    const brandName = input.brandName?.trim() || tempBrandName;
    if (!brandName) {
      return { ok: false, message: "Brand name is required." };
    }

    const duplicateBrand = await findDuplicateBrand(supabase, brandName, clientId);
    if (duplicateBrand && input.brandDuplicateOverride) {
      brandDuplicateOverridden = true;
    }

    const { groupId, vrRateId } = await resolveBrandGroupContext(
      supabase,
      clientId,
      input.groupId
    );

    const vrRateIdNormalized = normalizeBrandVrRateId(null, vrRateId);

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .insert({
        client_id: clientId,
        group_id: groupId,
        name: brandName,
        status: "prospect",
        category_id: input.categoryId,
        subcategory_id: input.subcategoryId,
        vr_rate_id: vrRateIdNormalized,
        currency_code: quotationCurrency,
        created_by: userId,
      } as never)
      .select("id")
      .single();

    if (brandError || !brand) {
      return {
        ok: false,
        message: brandError?.message ?? "Failed to create brand.",
      };
    }

    brandId = (brand as { id: string }).id;
  }

  await supabase
    .from("quotations")
    .update({
      client_id: clientId,
      brand_id: brandId,
      is_temporary_client: false,
      is_temporary_brand: false,
      temporary_client_name: null,
      temporary_brand_name: null,
    } as never)
    .eq("id", input.quotationId);

  if (quotationRow.shortlist_id) {
    await supabase
      .from("discovery_shortlists")
      .update({ client_id: clientId, brand_id: brandId } as never)
      .eq("id", quotationRow.shortlist_id as string);
  }

  revalidatePath("/clients");
  revalidatePath("/brands");
  if (clientId) revalidatePath(`/clients/${clientId}`);

  return {
    ok: true,
    data: {
      clientId,
      brandId,
      case: promoteCase,
      auditFlags: {
        clientDuplicateOverridden,
        brandDuplicateOverridden,
        existingClientLinked,
      },
    },
  };
}

export async function writePromoteMasterDataAuditEvents(
  supabase: Supabase,
  input: {
    actorId: string;
    quotationId: string;
    clientId: string;
    brandId: string | null;
    promoteCase: ReturnType<typeof resolvePromoteCase>;
    auditFlags: {
      clientDuplicateOverridden: boolean;
      brandDuplicateOverridden: boolean;
      existingClientLinked: boolean;
    };
  }
) {
  await logClientOnboardingEvent(supabase, {
    clientId: input.clientId,
    actorId: input.actorId,
    event: "client.promoted",
    summary: `Promoted quotation to master data (${input.promoteCase.replaceAll("_", " ")}).`,
    quotationId: input.quotationId,
    brandId: input.brandId,
    newStatus: DEFAULT_PROMOTED_ONBOARDING_STATUS,
    metadata: { promoteCase: input.promoteCase },
  });

  if (input.auditFlags.existingClientLinked) {
    await logClientOnboardingEvent(supabase, {
      clientId: input.clientId,
      actorId: input.actorId,
      event: "client.existing_linked",
      summary: "Linked quotation to existing legal entity during promote wizard.",
      quotationId: input.quotationId,
      brandId: input.brandId,
    });
  }

  if (input.auditFlags.clientDuplicateOverridden) {
    await logClientOnboardingEvent(supabase, {
      clientId: input.clientId,
      actorId: input.actorId,
      event: "client.duplicate_overridden",
      summary: "User continued creating legal entity despite duplicate suggestion.",
      quotationId: input.quotationId,
    });
  }

  if (input.auditFlags.brandDuplicateOverridden) {
    await logClientOnboardingEvent(supabase, {
      clientId: input.clientId,
      actorId: input.actorId,
      event: "client.duplicate_overridden",
      summary: "User continued creating brand despite duplicate suggestion.",
      quotationId: input.quotationId,
      brandId: input.brandId,
      metadata: { entity: "brand" },
    });
  }
}
