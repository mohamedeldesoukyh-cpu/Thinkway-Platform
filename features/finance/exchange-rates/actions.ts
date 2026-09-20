"use server";

import { revalidatePath } from "next/cache";

import {
  requireFinanceOverrideAccess,
  requireFinancePermission,
} from "@/lib/auth/permissions-server";
import { convertAmount } from "@/lib/finance/fx/conversion";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  confirmPoOverrideSchema,
  updateCampaignPoSchema,
  upsertCurrencySchema,
  upsertExchangeRateSchema,
} from "./schemas";

export type FinanceActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

export async function upsertCurrencyAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const parsed = upsertCurrencySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid currency data.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error } = await requireUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const access = await requireFinanceOverrideAccess(supabase);
  if ("error" in access) return { ok: false, message: access.error };

  const { error: upsertError } = await supabase.from("md_currencies").upsert({
    code: parsed.data.code,
    name: parsed.data.name,
    symbol: emptyToNull(parsed.data.symbol),
    country_code: emptyToNull(parsed.data.country_code),
    decimal_places: parsed.data.decimal_places,
    is_active: parsed.data.is_active ?? true,
  } as never);

  if (upsertError) return { ok: false, message: upsertError.message };

  revalidatePath("/finance/exchange-rates");
  return { ok: true, message: "Currency saved." };
}

export async function upsertExchangeRateAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const parsed = upsertExchangeRateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid exchange rate.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (
    parsed.data.apply_mode === "override_historical" &&
    !parsed.data.override_reason?.trim()
  ) {
    return {
      ok: false,
      message: "Override reason is required for historical recalculation.",
    };
  }

  const { supabase, user, error } = await requireUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const access = await requireFinanceOverrideAccess(supabase);
  if ("error" in access) return { ok: false, message: access.error };

  const { data, error: saveError } = await supabase.rpc("save_exchange_rate" as never, {
    p_input: parsed.data,
  } as never);
  if (saveError) return { ok: false, message: saveError.message };
  const count = Number((data as { recalculated_items?: number } | null)?.recalculated_items ?? 0);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `Rate saved and audited. ${count} draft quotation lines recalculated. Campaign and PO reporting use effective rates. Issued and linked document amounts are preserved.`,
  };
}

export async function updateCampaignPoAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const parsed = updateCampaignPoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Invalid PO data.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error } = await requireUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const access = await requireFinancePermission(supabase, "finance.write");
  if ("error" in access) return { ok: false, message: access.error };

  const { data: header, error: fetchError } = await supabase
    .from("campaign_headers")
    .select(
      "id, currency_code, po_number, po_currency, po_exchange_rate, po_amount_original, po_amount_campaign_currency, po_expiry_date"
    )
    .eq("id", parsed.data.campaign_id)
    .single();

  if (fetchError || !header) {
    return { ok: false, message: fetchError?.message ?? "Campaign not found." };
  }

  const { data: effectiveRate, error: rateError } = await supabase.rpc("resolve_effective_exchange_rate", {
    p_from_currency: parsed.data.po_currency, p_to_currency: header.currency_code,
  });
  if (rateError || !Number.isFinite(Number(effectiveRate)) || Number(effectiveRate) <= 0) {
    return { ok: false, message: rateError?.message ?? "A valid PO exchange rate is required." };
  }
  const poExchangeRate = Number(effectiveRate);
  const converted = convertAmount({
    amount: parsed.data.po_amount_original,
    exchange_rate: poExchangeRate,
  });

  const oldSnapshot = {
    po_number: header.po_number,
    po_currency: header.po_currency,
    po_exchange_rate: header.po_exchange_rate,
    po_amount_original: header.po_amount_original,
    po_amount_campaign_currency: header.po_amount_campaign_currency,
    po_expiry_date: header.po_expiry_date,
  };

  const { error: updateError } = await supabase
    .from("campaign_headers")
    .update({
      po_number: emptyToNull(parsed.data.po_number),
      po_currency: parsed.data.po_currency,
      po_exchange_rate: poExchangeRate,
      po_amount_original: parsed.data.po_amount_original,
      po_amount_campaign_currency: converted,
      po_expiry_date: parsed.data.po_expiry_date,
      fx_snapshot_at: new Date().toISOString(),
      po_status: converted > 0 ? "active" : "draft",
    } as never)
    .eq("id", parsed.data.campaign_id);

  if (updateError) return { ok: false, message: updateError.message };

  await supabase.from("po_governance_logs").insert({
    campaign_header_id: parsed.data.campaign_id,
    action: "po_update",
    field_name: "campaign_po",
    old_value: oldSnapshot,
    new_value: {
      po_number: parsed.data.po_number,
      po_currency: parsed.data.po_currency,
      po_exchange_rate: poExchangeRate,
      po_amount_original: parsed.data.po_amount_original,
      po_amount_campaign_currency: converted,
      po_expiry_date: parsed.data.po_expiry_date,
    },
    override_reason: emptyToNull(parsed.data.override_reason),
    changed_by: user.id,
  } as never);

  await supabase.rpc("sync_campaign_header_po_consumption", {
    p_header_id: parsed.data.campaign_id,
  } as never);

  revalidatePath(`/campaigns/${parsed.data.campaign_id}`);
  revalidatePath("/finance/po-tracker");
  return { ok: true, message: "Campaign PO updated." };
}

export async function confirmPoOverrideAction(
  _prev: FinanceActionState,
  formData: FormData
): Promise<FinanceActionState> {
  const parsed = confirmPoOverrideSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.flatten().fieldErrors.override_reason?.[0] ?? "Invalid override.",
    };
  }

  const { supabase, user, error } = await requireUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const access = await requireFinanceOverrideAccess(supabase);
  if ("error" in access) return { ok: false, message: access.error };

  await supabase
    .from("campaign_headers")
    .update({
      po_override_approved: true,
      po_override_reason: parsed.data.override_reason,
      po_status: "exceeded",
    } as never)
    .eq("id", parsed.data.campaign_id);

  if (parsed.data.line_id) {
    await supabase
      .from("campaign_lines")
      .update({ po_override_flag: true } as never)
      .eq("id", parsed.data.line_id);
  }

  await supabase.from("po_governance_logs").insert({
    campaign_header_id: parsed.data.campaign_id,
    action: "po_override_confirmed",
    override_reason: parsed.data.override_reason,
    changed_by: user.id,
  } as never);

  await supabase.from("finance_notifications").insert({
    notification_type: "po_exceeded",
    campaign_header_id: parsed.data.campaign_id,
    title: "Campaign PO exceeded",
    message: "An assignment was saved with PO override approval.",
    metadata: { line_id: parsed.data.line_id ?? null },
  } as never);

  revalidatePath(`/campaigns/${parsed.data.campaign_id}`);
  revalidatePath("/finance/po-tracker");
  return { ok: true, message: "PO override recorded." };
}
