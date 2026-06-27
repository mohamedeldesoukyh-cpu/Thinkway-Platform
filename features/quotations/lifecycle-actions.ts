"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

import {
  createCampaignFromQuotation as createCampaignFromQuotationService,
  getQuotationLifecycleActivity as getQuotationLifecycleActivityService,
  moveQuotationToShortlist as moveQuotationToShortlistService,
  promoteQuotationToMasterData as promoteQuotationToMasterDataService,
  updateQuotationClientBrand as updateQuotationClientBrandService,
} from "@/lib/services/quotations/quotation-lifecycle-service";
import {
  generateQuotationVersion as generateQuotationVersionService,
  getQuotationVersionChain as getQuotationVersionChainService,
} from "@/lib/services/quotations/quotation-version-service";
import {
  checkPromoteMasterDataDuplicates,
  searchPromoteDuplicateBrands,
  searchPromoteDuplicateClients,
} from "@/features/quotations/promote-master-data";
import {
  promoteMasterDataSchema,
  type PromoteMasterDataInput,
} from "@/features/quotations/promote-master-data-schema";
import {
  QUOTATION_PERMISSIONS,
  QUOTATIONS_LIST_PATH,
  quotationDetailPath,
} from "@/features/quotations/constants";

import type { ActionResult } from "./types";

type Supabase = SupabaseClient<Database>;

const SHORTLIST_LIST = "/discovery/shortlists";

function revalidateQuotation(id: string, shortlistId?: string | null, campaignId?: string | null) {
  revalidatePath(QUOTATIONS_LIST_PATH);
  revalidatePath(quotationDetailPath(id));
  if (shortlistId) revalidatePath(`${SHORTLIST_LIST}/${shortlistId}`);
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
}

async function getActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string; roleSlug: string | null }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    const adminAuth = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in adminAuth) return { ok: false, message: auth.error };
    return { ok: true, supabase, userId: adminAuth.userId, roleSlug: adminAuth.roleSlug };
  }
  return { ok: true, supabase, userId: auth.userId, roleSlug: auth.roleSlug };
}

async function requireMasterDataPromote(
  supabase: Supabase
): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const auth = await requirePermission(supabase, "clients.write");
  if ("error" in auth) {
    return {
      ok: false,
      message: "Only Admin, Director, or Manager roles can promote to master data.",
    };
  }
  return { ok: true, userId: auth.userId };
}

export async function updateQuotationClientBrand(input: {
  quotationId: string;
  client_id?: string | null;
  brand_id?: string | null;
  is_temporary_client?: boolean;
  is_temporary_brand?: boolean;
  temporary_client_name?: string | null;
  temporary_brand_name?: string | null;
}): Promise<ActionResult> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await updateQuotationClientBrandService(actor.supabase, input);
  if (result.ok) revalidateQuotation(input.quotationId);
  return result;
}

export async function checkPromoteMasterDataDuplicateWarnings(
  input: Omit<PromoteMasterDataInput, "quotationId" | "acknowledged">
): Promise<ActionResult<{ warnings: Array<{ field: string; message: string }> }>> {
  return checkPromoteMasterDataDuplicates(input);
}

export async function searchPromoteWizardDuplicateClients(input: {
  query: string;
  agencyOrDirect?: "agency" | "direct" | "hybrid";
  excludeClientId?: string | null;
}) {
  return searchPromoteDuplicateClients(input);
}

export async function searchPromoteWizardDuplicateBrands(input: {
  query: string;
  clientId?: string | null;
  excludeBrandId?: string | null;
}) {
  return searchPromoteDuplicateBrands(input);
}

export async function promoteQuotationToMasterData(
  input: PromoteMasterDataInput
): Promise<
  ActionResult<{
    clientId: string;
    brandId: string | null;
    case: string;
  }>
> {
  const parsed = promoteMasterDataSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const message =
      Object.values(first).flat()[0] ?? "Invalid promotion request.";
    return { ok: false, message };
  }

  const actor = await getActor();
  if (!actor.ok) return actor;

  const promoteAuth = await requireMasterDataPromote(actor.supabase);
  if (!promoteAuth.ok) return promoteAuth;

  const result = await promoteQuotationToMasterDataService(
    actor.supabase,
    actor.userId,
    parsed.data
  );
  if (!result.ok || !result.data) return result;

  revalidateQuotation(parsed.data.quotationId, result.data.shortlistId);
  revalidatePath("/clients");
  revalidatePath("/brands");
  revalidatePath(`/clients/${result.data.clientId}`);

  return {
    ok: true,
    data: {
      clientId: result.data.clientId,
      brandId: result.data.brandId,
      case: result.data.case,
    },
    message: result.message,
  };
}

export async function moveQuotationToShortlist(
  quotationId: string
): Promise<ActionResult<{ shortlistId: string; serialNumber: string | null }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await moveQuotationToShortlistService(actor.supabase, actor.userId, quotationId);
  if (result.ok && result.data) {
    revalidateQuotation(quotationId, result.data.shortlistId);
  }
  return result;
}

export async function generateQuotationVersion(input: {
  quotationId: string;
  revisionNotes?: string | null;
}): Promise<ActionResult<{ newQuotationId: string; versionNumber: number; serialNumber: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;
  const result = await generateQuotationVersionService(actor.supabase, actor.userId, input);
  if (result.ok && result.data) {
    revalidateQuotation(input.quotationId);
    revalidateQuotation(result.data.newQuotationId, result.data.shortlistId);
  }
  if (!result.ok || !result.data) return result;
  return {
    ok: true,
    data: {
      newQuotationId: result.data.newQuotationId,
      versionNumber: result.data.versionNumber,
      serialNumber: result.data.serialNumber,
    },
    message: result.message,
  };
}

export async function createCampaignFromQuotation(input: {
  quotationId: string;
  campaignName?: string | null;
}): Promise<ActionResult<{ campaignId: string; documentNumber: string; shortlistId: string }>> {
  const actor = await getActor();
  if (!actor.ok) return actor;

  const campaignAuth = await requirePermission(actor.supabase, "campaigns.write");
  if ("error" in campaignAuth) {
    return { ok: false, message: "You need campaign write access to create a campaign." };
  }

  const result = await createCampaignFromQuotationService(actor.supabase, actor.userId, input);
  if (result.ok && result.data) {
    revalidateQuotation(input.quotationId, result.data.shortlistId, result.data.campaignId);
  }
  return result;
}

export async function getQuotationLifecycleActivity(
  quotationId: string
): Promise<
  ActionResult<{
    events: Array<{
      id: string;
      action: string;
      summary: string;
      created_at: string;
      actor_name: string | null;
    }>;
  }>
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.read);
  if ("error" in auth) {
    const admin = await requirePermission(supabase, QUOTATION_PERMISSIONS.admin);
    if ("error" in admin) return { ok: false, message: auth.error };
  }
  return getQuotationLifecycleActivityService(supabase, quotationId);
}

export async function getQuotationVersionChain(
  quotationId: string
): Promise<
  ActionResult<{
    versions: Array<{
      id: string;
      serial_number: string | null;
      version_number: number;
      status: string;
    }>;
    linkedShortlist: { id: string; serial_number: string | null } | null;
    linkedCampaign: { id: string; document_number: string } | null;
  }>
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  return getQuotationVersionChainService(supabase, quotationId);
}
