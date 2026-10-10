import assert from "node:assert/strict";
import { hasProtectedInvoiceAmounts, invoiceAmountMutationError, ISSUED_INVOICE_PROTECTED } from "./invoice-amount-protection";
import type { SupabaseClient } from "@supabase/supabase-js";
import { commitInvoiceLifecycleMutation } from "./invoice-lifecycle-commit";

assert(hasProtectedInvoiceAmounts({status:"draft", issue_date:"2026-10-04"}), "operational drafts shown as Issued are protected");
for (const status of ["sent", "partial", "paid", "overdue", "void"]) assert(hasProtectedInvoiceAmounts({status}));
assert(hasProtectedInvoiceAmounts({status:"draft", amounts_finalized_at:"2026-10-04"}), "changing status cannot unseal invoice");
assert(!hasProtectedInvoiceAmounts({status:"draft", issue_date:null}), "unissued drafts remain editable");

async function main() {
  for (const [data, error, expected] of [
    [{status:"draft",issue_date:"2026-10-04"},null,ISSUED_INVOICE_PROTECTED],
    [{status:"draft",issue_date:null},null,null],
    [null,{message:"unavailable"},"Unable to verify invoice protection. No changes were made."],
  ] as const) {
    const query = { select:()=>query, eq:()=>query, maybeSingle:async()=>({data,error}) };
    const db = {from:()=>query} as unknown as SupabaseClient;
    assert.equal(await invoiceAmountMutationError(db,"synthetic-invoice"),expected);
    if (expected) {
      for (const mutation of ["append", "regenerate", "ungenerate", "void"] as const) {
        let executed = false;
        const result = await commitInvoiceLifecycleMutation(db, {
          invoiceId: "synthetic-invoice", mutation,
          execute: async () => { executed = true; return {}; },
        });
        assert.equal(result.error, expected);
        assert.equal(executed, false, `${mutation} must stop before altering records`);
      }
    }
  }
  console.log("Issued invoice protection tests passed");
}
void main();
