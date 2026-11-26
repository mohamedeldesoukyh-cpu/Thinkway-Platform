import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runPreInvoiceCreateRepairPipeline, syncCampaignLineCommercialRollupsFromDeliverables } from "./repair-invoice-create-pipeline";

// Read-only empty fixtures isolate the append-repair entry point. Other repair
// stages still execute; new-invoice preparation must never enter append repair.
async function queriesFor(repairAppend: boolean) {
  const queries: string[] = [];
  const db = {
    from(table: string) {
      const query: any = new Proxy({}, {
        get(_target, key) {
          if (key === "then") return Promise.resolve({ data: [], error: null }).then.bind(Promise.resolve({ data: [], error: null }));
          return (...args: unknown[]) => {
            if (key === "select") queries.push(`${table}:${args[0]}`);
            if (["insert", "update", "delete", "upsert"].includes(String(key))) {
              throw new Error(`Unexpected mutation of empty fixture: ${table}`);
            }
            return query;
          };
        },
      });
      return query;
    },
  } as unknown as SupabaseClient;
  await runPreInvoiceCreateRepairPipeline(db, "synthetic-campaign", { repairAppend });
  return queries;
}

async function main() {
  let childReads = 0;
  const batchDb = {
    from(table: string) {
      if (table === "assignment_deliverables") childReads++;
      const result = Promise.resolve({ error: null, data: table === "campaign_lines"
        ? Array.from({ length: 26 }, (_, index) => ({ id: `line-${index}`, pricing_mode: "deliverable" })) : [] });
      const query: any = new Proxy({}, { get(_target, key) {
        if (key === "then") return result.then.bind(result);
        if (["update", "insert", "delete"].includes(String(key))) throw new Error("No commercial data must not trigger writes");
        return () => query;
      } });
      return query;
    },
  } as unknown as SupabaseClient;
  await syncCampaignLineCommercialRollupsFromDeliverables(batchDb, "test-campaign");
  assert.equal(childReads, 1, "26 assignments should use one eligibility lookup, not 26 serial queries");
  const newInvoice = await queriesFor(false);
  const append = await queriesFor(true);
  assert(newInvoice.length > 0, "normal preparation still runs");
  assert(!newInvoice.includes("campaign_headers:client_id"), "new invoice must not inspect an append target");
  assert(!append.includes("campaign_headers:client_id"), "append must not repair other invoices either");
  for (const queries of [newInvoice, append]) {
    assert(!queries.some(query => query.startsWith("invoices:") || query.startsWith("invoice_line_items")), "preparation must not inspect or rewrite historical invoice lines");
  }
  console.log("Invoice creation repair isolation passed");
}
void main();
