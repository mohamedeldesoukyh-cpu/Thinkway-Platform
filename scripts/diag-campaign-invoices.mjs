import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.+)$`, "m")) || [])[1]?.trim();
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const key = get("SUPABASE_SERVICE_ROLE_KEY");
const campaignId = process.argv[2] ?? "d7698a72-6b6a-491b-b012-08be3e923262";

const sb = createClient(url, key);

const { data: lines, error: linesErr } = await sb
  .from("campaign_lines")
  .select("id,document_number,billing_status,invoice_id,operational_status")
  .eq("campaign_header_id", campaignId);

const lineIds = (lines ?? []).map((r) => r.id);

const [invoices, deliverables, lineItems, allInvoicesByItems] = await Promise.all([
  sb
    .from("invoices")
    .select("id,document_number,status,campaign_header_id,campaign_id,regeneration_status")
    .or(`campaign_header_id.eq.${campaignId},campaign_id.eq.${campaignId}`),
  lineIds.length
    ? sb
        .from("assignment_deliverables")
        .select(
          "id,billing_status,invoice_line_item_id,locked_at,invoiced_amount,remaining_amount,campaign_line_id"
        )
        .in("campaign_line_id", lineIds)
    : Promise.resolve({ data: [], error: null }),
  sb
    .from("invoice_line_items")
    .select("id,invoice_id,campaign_header_id,assignment_deliverable_id")
    .eq("campaign_header_id", campaignId),
  lineIds.length
    ? sb
        .from("assignment_deliverables")
        .select("invoice_line_item_id")
        .in("campaign_line_id", lineIds)
        .not("invoice_line_item_id", "is", null)
    : Promise.resolve({ data: [], error: null }),
]);

const lineItemIds = (allInvoicesByItems.data ?? [])
  .map((r) => r.invoice_line_item_id)
  .filter(Boolean);

let linkedInvoices = { data: [], error: null };
if (lineItemIds.length > 0) {
  const { data: items } = await sb
    .from("invoice_line_items")
    .select("invoice_id")
    .in("id", lineItemIds);
  const invoiceIds = [...new Set((items ?? []).map((i) => i.invoice_id).filter(Boolean))];
  if (invoiceIds.length > 0) {
    linkedInvoices = await sb
      .from("invoices")
      .select("id,document_number,status,campaign_header_id,regeneration_status")
      .in("id", invoiceIds);
  }
}

console.log(
  JSON.stringify(
    {
      campaignId,
      lines: { data: lines, error: linesErr?.message },
      invoicesDirect: { data: invoices.data, error: invoices.error?.message },
      deliverables: { data: deliverables.data, error: deliverables.error?.message },
      lineItems: { data: lineItems.data, error: lineItems.error?.message },
      linkedInvoices: { data: linkedInvoices.data, error: linkedInvoices.error?.message },
    },
    null,
    2
  )
);
