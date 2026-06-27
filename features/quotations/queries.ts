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

export async function getQuotationFormOptions() {
  const supabase = await createSupabaseServerClient();
  return loadQuotationFormOptions(supabase);
}

export async function getPromoteWizardOptions() {
  const supabase = await createSupabaseServerClient();
  return loadPromoteWizardOptions(supabase);
}

export async function getQuotationsList() {
  const supabase = await createSupabaseServerClient();
  return loadQuotationsList(supabase);
}

export async function getQuotationDetail(id: string) {
  const supabase = await createSupabaseServerClient();
  return loadQuotationDetail(supabase, id);
}
