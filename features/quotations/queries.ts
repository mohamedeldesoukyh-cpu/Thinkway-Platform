import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPromoteWizardOptions as loadPromoteWizardOptions,
  getQuotationDetail as loadQuotationDetail,
  getQuotationFormOptions as loadQuotationFormOptions,
  getQuotationsList as loadQuotationsList,
} from "@/lib/services/quotations/quotation-document-service";

export type {
  PromoteWizardOptions,
  QuotationDetail,
  QuotationFormOptions,
  QuotationListRow,
} from "./types";

const getCachedQuotationFormOptionsInner = cache(async () => {
  const supabase = await createSupabaseServerClient();
  return loadQuotationFormOptions(supabase);
});

const getCachedPromoteWizardOptionsInner = cache(async () => {
  const supabase = await createSupabaseServerClient();
  return loadPromoteWizardOptions(supabase);
});

export async function getQuotationFormOptions() {
  return getCachedQuotationFormOptionsInner();
}

/** Request-scoped form options — safe with auth cookies, deduped per render. */
export async function getCachedQuotationFormOptions() {
  return getCachedQuotationFormOptionsInner();
}

export async function getPromoteWizardOptions() {
  return getCachedPromoteWizardOptionsInner();
}

/** Request-scoped promote wizard options — safe with auth cookies, deduped per render. */
export async function getCachedPromoteWizardOptions() {
  return getCachedPromoteWizardOptionsInner();
}

export async function getQuotationsList() {
  const supabase = await createSupabaseServerClient();
  return loadQuotationsList(supabase);
}

export async function getQuotationDetail(id: string) {
  const supabase = await createSupabaseServerClient();
  return loadQuotationDetail(supabase, id);
}
