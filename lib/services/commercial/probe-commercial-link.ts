/**
 * Probe whether a Quotation item or Campaign Assignment participates in
 * Commercial SSOT synchronization (has Origin Commercial Line peers).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { asCommercialLineId, originCommercialLineId } from "./commercial-line-identity";
import type { CommercialSyncLinkProbe } from "./types";

type Supabase = SupabaseClient<Database>;

export async function probeCommercialLinkByQuotationItem(
  supabase: Supabase,
  quotationItemId: string
): Promise<CommercialSyncLinkProbe> {
  const empty: CommercialSyncLinkProbe = {
    linked: false,
    commercialLineId: null,
    quotationId: null,
    quotationSerial: stringOrNull(null),
    campaignHeaderId: null,
    campaignDocumentNumber: null,
    assignmentIds: [],
    concurrencyToken: null,
  };

  const { data: item } = await supabase
    .from("quotation_items")
    .select("id, quotation_id")
    .eq("id", quotationItemId)
    .maybeSingle();

  if (!item?.id || !(item as { quotation_id?: string }).quotation_id) {
    return empty;
  }

  const quotationId = (item as { quotation_id: string }).quotation_id;
  const commercialLineId = asCommercialLineId(item.id);

  const { data: lines } = await supabase
    .from("campaign_lines")
    .select("id, campaign_header_id, source_quotation_item_id")
    .eq("source_quotation_item_id", commercialLineId);

  const assignmentIds = (lines ?? []).map((l) => l.id as string);
  if (assignmentIds.length === 0) {
    return {
      ...empty,
      commercialLineId,
      quotationId,
    };
  }

  const campaignHeaderId =
    ((lines?.[0] as { campaign_header_id?: string } | undefined)
      ?.campaign_header_id as string | undefined) ?? null;

  const [{ data: quotation }, { data: header }] = await Promise.all([
    supabase
      .from("quotations")
      .select("id, serial_number")
      .eq("id", quotationId)
      .maybeSingle(),
    campaignHeaderId
      ? supabase
          .from("campaign_headers")
          .select("id, document_number")
          .eq("id", campaignHeaderId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const token = await loadQuoteConcurrencyToken(supabase, commercialLineId);

  return {
    linked: true,
    commercialLineId,
    quotationId,
    quotationSerial: stringOrNull(
      (quotation as { serial_number?: string | null } | null)?.serial_number
    ),
    campaignHeaderId,
    campaignDocumentNumber: stringOrNull(
      (header as { document_number?: string | null } | null)?.document_number
    ),
    assignmentIds,
    concurrencyToken: token,
  };
}

export async function probeCommercialLinkByAssignment(
  supabase: Supabase,
  assignmentId: string
): Promise<CommercialSyncLinkProbe> {
  const empty: CommercialSyncLinkProbe = {
    linked: false,
    commercialLineId: null,
    quotationId: null,
    quotationSerial: null,
    campaignHeaderId: null,
    campaignDocumentNumber: null,
    assignmentIds: [],
    concurrencyToken: null,
  };

  const { data: line } = await supabase
    .from("campaign_lines")
    .select(
      "id, campaign_header_id, source_quotation_id, source_quotation_item_id"
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (!line) return empty;

  const cml = originCommercialLineId(
    line as { source_quotation_item_id?: string | null }
  );
  if (!cml) return empty;

  return probeCommercialLinkByQuotationItem(supabase, cml);
}

async function loadQuoteConcurrencyToken(
  supabase: Supabase,
  quotationItemId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("quotation_items")
    .select("id, cost, revenue, af_pct, cost_currency, fx_rate_to_egp, gp_pct, gp_value")
    .eq("id", quotationItemId)
    .maybeSingle();
  if (!data) return null;
  // Stable content hash — quotation_items may not expose updated_at in all envs.
  return JSON.stringify(data);
}

function stringOrNull(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}
