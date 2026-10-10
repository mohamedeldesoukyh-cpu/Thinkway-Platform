import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCampaignInvoiceLineRollups, reconcileCampaignRollupWithInvoiceLines } from "./invoice-operational-aggregation";

async function main() {
  for (const mode of ["linked", "legacy", "both"] as const) {
    for (const invoiceCurrency of ["EGP", "USD"] as const) {
      const stored = invoiceCurrency === "EGP" ? 525586.15 : 100;
      const invoice = { id: "invoice", campaign_header_id: "campaign", campaign_id: null,
        status: "draft", regeneration_status: "active", currency: invoiceCurrency, subtotal: stored };
      const line = { id: "line", invoice_id: "invoice", campaign_header_id: "campaign",
        revenue_before_vat: stored, invoice,
        metadata: { billing_fx: { source_currency: "USD", source_amount: 10048.08 } } };
      const rpcCalls: string[] = [];
      const db = {
        from(table: string) {
          let selected = "";
          const query = {
            select(value: string) { selected = value; return query; },
            in() { return query; }, or() { return query; }, neq() { return query; },
            then(resolve: (value: unknown) => unknown) {
              const data = table === "campaign_headers" ? [{ id: "campaign", currency_code: "EGP" }]
                : table === "invoices" ? (mode === "legacy" ? [] : [invoice])
                : selected.includes("invoice:invoices") ? (mode === "linked" ? [] : [line]) : [line];
              return Promise.resolve({ data, error: null }).then(resolve);
            },
          };
          return query;
        },
        async rpc(_name: string, args: { p_from_currency: string }) {
          rpcCalls.push(args.p_from_currency);
          return { data: 52.215, error: null };
        },
      } as unknown as SupabaseClient;
      const result = (await loadCampaignInvoiceLineRollups(db, ["campaign"])).get("campaign")!;
      assert.equal(result.line_count, 1, `${mode}: don't count linked/legacy lines twice`);
      assert.equal(result.invoiced_subtotal, invoiceCurrency === "EGP" ? 525586.15 : 5221.5);
      if (invoiceCurrency === "EGP") {
        assert.deepEqual(rpcCalls, [], "original USD metadata must not revalue an issued EGP invoice");
        const preview = reconcileCampaignRollupWithInvoiceLines({ total_campaign_amount: 965070.35,
          achieved_revenue: 965070.35, already_invoiced: 524661.42, remaining_to_invoice: 440408.93,
          unachieved_revenue: 0, invoice_line_invoiced: result.invoiced_subtotal });
        assert.equal(preview.already_invoiced, 525586.15);
        assert.equal(preview.remaining_to_invoice, 439484.2);
        assert.equal(preview.remaining_to_invoice - 439484.2, 0);
      }
    }
  }
  console.log("Issued invoice currency rollups: 6 linkage/currency cases passed");
}
void main();
