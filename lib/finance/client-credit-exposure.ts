import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { fromEgp, toEgp } from "@/lib/commercial/fx-aggregation";
import { resolveClientTaxableBase } from "@/lib/assignments/client-billing-commercial";
import { fetchClientCreditLimitFlagsSafe } from "@/lib/clients/safe-client-query";
import type { SupabaseClient } from "@supabase/supabase-js";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

const EXCLUDED_INVOICE_STATUSES = "(void,draft)";

export type ClientCreditExposure = {
  exposure: number;
  outstanding_receivables: number;
  unbilled_planned: number;
  currency: string;
};

export type ClientCreditLimitCheck = {
  ok: boolean;
  enforced: boolean;
  exposure: number;
  limit: number | null;
  projected_exposure: number;
  exceeded: boolean;
  exceeded_by: number;
  can_accept_risk: boolean;
  accept_credit_risk: boolean;
  credit_limit_active: boolean;
  currency: string;
};

type CampaignExposureRow = {
  id: string;
  po_amount_campaign_currency: number;
  currency_code: string;
  lines: { revenue: number; revenue_before_vat: number | null; currency_code: string | null; usage_rights_amount: number; agency_fee_amount: number; agency_fee_percent: number }[] | null;
};

/**
 * Client exposure = outstanding receivables + unbilled planned amounts.
 *
 * - Outstanding receivables: invoice total minus amount paid (non-void, non-draft).
 * - Unbilled planned: per active campaign, max(0, planned − invoiced).
 *   Planned uses sum(campaign_lines.revenue) when lines exist; otherwise header PO amount.
 */
export async function getClientCreditExposure(
  supabase: SupabaseClient,
  clientId: string
): Promise<ClientCreditExposure> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("currency")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    throw new Error(clientError.message);
  }
  if (!client) {
    throw new Error("Client not found.");
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from("invoices")
    .select("total, amount_paid, status, campaign_header_id, currency")
    .eq("client_id", clientId)
    .not("status", "in", EXCLUDED_INVOICE_STATUSES);

  if (invoicesError) {
    throw new Error(invoicesError.message);
  }

  const { data: headers, error: headersError } = await supabase
    .from("campaign_headers")
    .select(
      `
      id,
      po_amount_campaign_currency,
      currency_code,
      lines:campaign_lines(revenue,revenue_before_vat,currency_code,usage_rights_amount,agency_fee_amount,agency_fee_percent)
    `
    )
    .eq("client_id", clientId)
    .neq("status", "cancelled");

  if (headersError) {
    throw new Error(headersError.message);
  }

  const currency = String(client.currency ?? "USD").trim().toUpperCase();
  const currencies = new Set([currency]);
  for (const invoice of invoices ?? []) currencies.add(invoice.currency);
  for (const header of (headers ?? []) as CampaignExposureRow[]) {
    currencies.add(header.currency_code);
    for (const line of header.lines ?? []) currencies.add(line.currency_code || header.currency_code);
  }
  const rates = new Map<string, number>();
  await Promise.all([...currencies].map(async code => rates.set(code, await resolveRateToEgp(supabase, code))));
  const convert = (amount: number, from: string) => fromEgp(toEgp(amount, rates.get(from)), currency, rates.get(currency));
  const outstanding_receivables = roundMoney((invoices ?? []).reduce((sum, invoice) =>
    sum + convert(Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)), invoice.currency), 0));
  const invoiced_by_campaign = new Map<string, number>();
  for (const invoice of invoices ?? []) {
    if (!invoice.campaign_header_id) continue;
    invoiced_by_campaign.set(invoice.campaign_header_id,
      roundMoney((invoiced_by_campaign.get(invoice.campaign_header_id) ?? 0) + convert(Number(invoice.total), invoice.currency)));
  }

  let unbilled_planned = 0;
  for (const header of (headers ?? []) as CampaignExposureRow[]) {
    const line_revenue = (header.lines ?? []).reduce(
      (sum, line) => sum + convert(resolveClientTaxableBase({
        revenueBeforeVat: Number(line.revenue_before_vat ?? line.revenue),
        usageRightsAmount: Number(line.usage_rights_amount), agencyFeeAmount: Number(line.agency_fee_amount),
        agencyFeePercent: Number(line.agency_fee_percent),
      }), line.currency_code || header.currency_code),
      0
    );
    const planned =
      line_revenue > 0 ? line_revenue : convert(Number(header.po_amount_campaign_currency), header.currency_code);
    const invoiced = invoiced_by_campaign.get(header.id) ?? 0;
    unbilled_planned += Math.max(0, planned - invoiced);
  }

  unbilled_planned = roundMoney(unbilled_planned);

  return {
    exposure: roundMoney(outstanding_receivables + unbilled_planned),
    outstanding_receivables,
    unbilled_planned,
    currency,
  };
}

export async function checkClientCreditLimit(
  supabase: SupabaseClient,
  input: { clientId: string; additionalAmount?: number }
): Promise<ClientCreditLimitCheck> {
  const client = await fetchClientCreditLimitFlagsSafe(supabase, input.clientId);

  if (client.error) {
    throw new Error(client.error);
  }
  if (!client.found) {
    throw new Error("Client not found.");
  }

  const limit =
    client.credit_limit != null ? roundMoney(client.credit_limit) : null;
  const credit_limit_active = client.credit_limit_active;
  const accept_credit_risk = client.accept_credit_risk;
  const additional_amount = roundMoney(input.additionalAmount ?? 0);

  const exposureResult = await getClientCreditExposure(supabase, input.clientId);
  const projected_exposure = roundMoney(
    exposureResult.exposure + additional_amount
  );

  const enforced = credit_limit_active && limit != null && limit > 0;
  if (!enforced) {
    return {
      ok: true,
      enforced: false,
      exposure: exposureResult.exposure,
      limit,
      projected_exposure,
      exceeded: false,
      exceeded_by: 0,
      can_accept_risk: accept_credit_risk,
      accept_credit_risk,
      credit_limit_active,
      currency: exposureResult.currency,
    };
  }

  const exceeded = projected_exposure > limit;
  const exceeded_by = exceeded ? roundMoney(projected_exposure - limit) : 0;

  return {
    ok: !exceeded,
    enforced: true,
    exposure: exposureResult.exposure,
    limit,
    projected_exposure,
    exceeded,
    exceeded_by,
    can_accept_risk: accept_credit_risk,
    accept_credit_risk,
    credit_limit_active,
    currency: exposureResult.currency,
  };
}
