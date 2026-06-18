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
  lines: { revenue: number }[] | null;
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
    .select("total, amount_paid, status, campaign_header_id")
    .eq("client_id", clientId)
    .not("status", "in", EXCLUDED_INVOICE_STATUSES);

  if (invoicesError) {
    throw new Error(invoicesError.message);
  }

  const outstanding_receivables = roundMoney(
    (invoices ?? []).reduce(
      (sum, invoice) =>
        sum + Math.max(0, Number(invoice.total) - Number(invoice.amount_paid)),
      0
    )
  );

  const invoiced_by_campaign = new Map<string, number>();
  for (const invoice of invoices ?? []) {
    const campaignId = invoice.campaign_header_id;
    if (!campaignId) continue;
    invoiced_by_campaign.set(
      campaignId,
      roundMoney(
        (invoiced_by_campaign.get(campaignId) ?? 0) + Number(invoice.total)
      )
    );
  }

  const { data: headers, error: headersError } = await supabase
    .from("campaign_headers")
    .select(
      `
      id,
      po_amount_campaign_currency,
      lines:campaign_lines(revenue)
    `
    )
    .eq("client_id", clientId)
    .neq("status", "cancelled");

  if (headersError) {
    throw new Error(headersError.message);
  }

  let unbilled_planned = 0;
  for (const header of (headers ?? []) as CampaignExposureRow[]) {
    const line_revenue = (header.lines ?? []).reduce(
      (sum, line) => sum + Number(line.revenue),
      0
    );
    const planned =
      line_revenue > 0 ? line_revenue : Number(header.po_amount_campaign_currency);
    const invoiced = invoiced_by_campaign.get(header.id) ?? 0;
    unbilled_planned += Math.max(0, planned - invoiced);
  }

  unbilled_planned = roundMoney(unbilled_planned);

  return {
    exposure: roundMoney(outstanding_receivables + unbilled_planned),
    outstanding_receivables,
    unbilled_planned,
    currency: String(client.currency ?? "USD"),
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
