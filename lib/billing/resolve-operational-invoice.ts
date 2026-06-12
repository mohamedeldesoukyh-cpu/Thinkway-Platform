import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveInvoiceDeliverableIds } from "@/lib/billing/invoice-from-deliverables";
import {
  blocksNewInvoiceOperationalRow,
  invoicedRowAllowed,
  invoicedRowBlockMessage,
  loadActiveInvoiceLineItemIds,
  resolveLinkedInvoiceIds,
  type InvoiceValidationContext,
} from "@/lib/billing/invoice-validation-context";

export async function resolveOperationalInvoiceTargets(
  supabase: SupabaseClient,
  campaignId: string,
  input: {
    lineIds: string[];
    deliverableIds: string[];
    postIds: string[];
  },
  validationCtx: InvoiceValidationContext = { mode: "new" }
): Promise<{ deliverableIds: string[]; postIds: string[]; error?: string }> {
  const deliverableSet = new Set<string>(input.deliverableIds);
  const postSet = new Set<string>(input.postIds);

  if (input.postIds.length > 0) {
    const postSelectWithBilling =
      "id, assignment_deliverable_id, locked_at, remaining_amount, invoice_line_item_id, billable_amount, invoiced_amount, revenue_before_vat, billing_status";
    const postSelectFallback =
      "id, assignment_deliverable_id, locked_at, remaining_amount, invoice_line_item_id, revenue_before_vat, billing_status";

    const primaryPostResult = await supabase
      .from("assignment_post_schedule")
      .select(postSelectWithBilling)
      .in("id", input.postIds);

    const postResult =
      primaryPostResult.error &&
      /column|does not exist/i.test(primaryPostResult.error.message)
        ? await supabase
            .from("assignment_post_schedule")
            .select(postSelectFallback)
            .in("id", input.postIds)
        : primaryPostResult;

    const { data: posts, error } = postResult;

    if (error) {
      return { deliverableIds: [], postIds: [], error: error.message };
    }

    const lineItemIds = (posts ?? [])
      .map((post) => post.invoice_line_item_id)
      .filter(Boolean) as string[];
    const [linkedInvoiceByLineItem, activeLineItemIds] = await Promise.all([
      resolveLinkedInvoiceIds(supabase, lineItemIds),
      loadActiveInvoiceLineItemIds(supabase, lineItemIds),
    ]);

    for (const post of posts ?? []) {
      const linkedInvoiceId = post.invoice_line_item_id
        ? (linkedInvoiceByLineItem.get(post.invoice_line_item_id) ?? null)
        : null;
      const enriched = { ...post, linked_invoice_id: linkedInvoiceId };

      if (validationCtx.mode === "append") {
        if (!invoicedRowAllowed(enriched, validationCtx)) {
          return {
            deliverableIds: [],
            postIds: [],
            error: invoicedRowBlockMessage("post", validationCtx),
          };
        }
      } else if (blocksNewInvoiceOperationalRow(enriched, activeLineItemIds)) {
        return {
          deliverableIds: [],
          postIds: [],
          error: invoicedRowBlockMessage("post", validationCtx),
        };
      }
      postSet.add(post.id);
      if (post.assignment_deliverable_id) {
        deliverableSet.add(post.assignment_deliverable_id);
      }
    }
  }

  const hasGranularSelection =
    input.deliverableIds.length > 0 || input.postIds.length > 0;
  const lineIdsForExpansion = hasGranularSelection ? [] : input.lineIds;

  const { deliverableIds, error } = await resolveInvoiceDeliverableIds(
    supabase,
    campaignId,
    [...deliverableSet],
    lineIdsForExpansion
  );

  if (error) {
    return { deliverableIds: [], postIds: [], error };
  }

  for (const deliverableId of deliverableIds) {
    deliverableSet.add(deliverableId);
  }

  const finalDeliverableIds = [...deliverableSet];
  const finalPostIds = [...postSet];

  if (process.env.NODE_ENV === "development") {
    console.debug("[resolve-operational-invoice] targets", {
      campaignId,
      lineIds: input.lineIds,
      deliverableIds: finalDeliverableIds,
      postIds: finalPostIds,
    });
  }

  if (finalDeliverableIds.length === 0 && finalPostIds.length === 0) {
    if (input.lineIds.length > 0) {
      return { deliverableIds: [], postIds: finalPostIds };
    }
    return {
      deliverableIds: [],
      postIds: [],
      error: "Select at least one billable operational row.",
    };
  }

  return { deliverableIds: finalDeliverableIds, postIds: finalPostIds };
}

export async function validateAppendableInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  input: {
    campaignId: string;
    clientId: string;
    currency: string;
  }
): Promise<
  | {
      ok: true;
      invoice: {
        id: string;
        document_number: string;
        regeneration_status: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      "id, document_number, status, regeneration_status, is_operational_locked, currency, client_id, campaign_header_id"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    return { ok: false, error: error?.message ?? "Invoice not found." };
  }

  const row = invoice as unknown as {
    id: string;
    document_number: string;
    status: string;
    regeneration_status: string | null;
    is_operational_locked?: boolean | null;
    currency: string;
    client_id: string;
    campaign_header_id: string | null;
  };

  const { isInvoiceAppendable } = await import("@/lib/billing/campaign-billing-queue");

  if (
    !isInvoiceAppendable({
      status: row.status,
      regeneration_status: row.regeneration_status,
      is_operational_locked: row.is_operational_locked,
      currency: row.currency,
      client_id: row.client_id,
      campaign_header_id: row.campaign_header_id,
      target_currency: input.currency,
      target_client_id: input.clientId,
      target_campaign_id: input.campaignId,
    })
  ) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[locked-invoice-rejection] append rejected — invoice locked or ineligible", {
        invoiceId,
        status: row.status,
        regeneration_status: row.regeneration_status,
      });
    }
    return {
      ok: false,
      error: "Selected invoice is locked or not eligible for append.",
    };
  }

  return {
    ok: true,
    invoice: {
      id: row.id,
      document_number: row.document_number,
      regeneration_status: row.regeneration_status,
    },
  };
}
