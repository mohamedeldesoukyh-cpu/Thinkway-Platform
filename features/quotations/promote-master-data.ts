"use server";

import { revalidatePath } from "next/cache";

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
  promoteMasterDataSchema,
  resolvePromoteCase,
  type PromoteMasterDataInput,
} from "./promote-master-data-schema";
import type { ActionResult } from "./types";

type Supabase = SupabaseClient<Database>;

export type PromoteDuplicateWarning = {
  field: "client" | "brand" | "legal_name";
  message: string;
};

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

export async function checkPromoteMasterDataDuplicates(
  input: Omit<PromoteMasterDataInput, "quotationId" | "acknowledged">
): Promise<ActionResult<{ warnings: PromoteDuplicateWarning[] }>> {
  const supabase = (await createSupabaseServerClient()) as Supabase;

  const warnings: PromoteDuplicateWarning[] = [];

  try {
    if (input.clientMode === "create" && input.clientName) {
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

    if (input.brandMode === "create" && input.brandName) {
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

async function fetchClientGroupContext(
  supabase: Supabase,
  clientId: string
): Promise<{ ok: true; groupId: string; vrRateId: string | null } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("clients")
    .select("group_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Legal entity not found." };
  }

  const groupId = (data as { group_id: string | null }).group_id;
  if (!groupId) {
    return {
      ok: false,
      message: "Legal entity must belong to a group before adding brands.",
    };
  }

  const vrRateId = await fetchClientVrRateIdSafe(supabase, clientId);
  if (vrRateId.error) {
    return { ok: false, message: vrRateId.error };
  }

  return { ok: true, groupId, vrRateId: vrRateId.value };
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
    if (duplicate) {
      return { ok: false, message: duplicate };
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

    let groupContext = await fetchClientGroupContext(supabase, clientId);
    if (!groupContext.ok && input.clientMode === "create" && input.groupId) {
      await supabase
        .from("clients")
        .update({ group_id: input.groupId } as never)
        .eq("id", clientId);
      groupContext = await fetchClientGroupContext(supabase, clientId);
    }
    if (!groupContext.ok) {
      return groupContext;
    }

    const duplicateBrand = await findDuplicateBrand(supabase, brandName, clientId);
    if (duplicateBrand) {
      return { ok: false, message: duplicateBrand };
    }

    const vrRateId = normalizeBrandVrRateId(null, groupContext.vrRateId);

    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .insert({
        client_id: clientId,
        group_id: groupContext.groupId,
        name: brandName,
        status: "prospect",
        category_id: input.categoryId,
        subcategory_id: input.subcategoryId,
        vr_rate_id: vrRateId,
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
    data: { clientId, brandId, case: promoteCase },
  };
}
