import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runPreInvoiceCreateRepairPipeline } from "./repair-invoice-create-pipeline";

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
