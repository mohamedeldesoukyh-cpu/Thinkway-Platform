import { z } from "zod";
import type { FinanceEvidence } from "./contracts";
import type { FinanceReportClient } from "./report-tools";

export const mediaDocumentTypes = ["client_invoice","supplier_invoice","internal_cost","client_credit_note","vendor_credit_note","client_debit_note","vendor_debit_note"] as const;
const amount = z.string().regex(/^-?\d+(\.\d+)?$/);
const rowSchema = z.object({
  id:z.string().uuid(),type:z.enum(mediaDocumentTypes),number:z.string().nullable(),date:z.string(),
  party:z.string().nullable(),currency:z.string(),net:amount,tax:amount,total:amount,
  eligible:z.boolean(),reason:z.string(),status:z.string(),token:z.string().regex(/^[a-f0-9]{32}$/),
  rate:amount.nullable(),base:z.string(),
  accruals:z.array(z.object({amount, currency:z.string(),reference:z.string()})).default([]),
});
const pageSchema=z.object({rows:z.array(rowSchema),count:z.number().int().nonnegative()});

/** Diagnose the posting bridge only. A missing bridge is not proof of a missing GL entry. */
export async function mediaAccountingReview(db:FinanceReportClient,company:string,name:string,from:string,to:string,documentType:"all"|typeof mediaDocumentTypes[number]):Promise<FinanceEvidence>{
  const rows:z.infer<typeof rowSchema>[]=[];
  const types=documentType==="all"?mediaDocumentTypes:[documentType];
  for(const type of types){
    let offset=0,total=0;
    do{
      const result=await db.rpc("tw_accounting_media_queue",{p_company:company,p_type:type,p_from:from,p_to:to,p_posted:false,p_offset:offset});
      if(result.error)throw Error("Media and Accounting access is required to review posting differences.");
      const page=pageSchema.parse(result.data);
      if(offset>0&&total!==page.count)throw Error("Documents changed during review. Please refresh.");
      total=page.count;
      // The queue can omit inaccessible rows. Never label a partial result complete.
      if(page.rows.length!==Math.min(50,Math.max(0,total-offset)))throw Error("Some source documents could not be verified. Review the posting center.");
      rows.push(...page.rows);offset+=50;
      if(rows.length>500||total>500)throw Error("Narrow the reporting dates or document type to at most 500 documents.");
    }while(offset<total);
  }
  const scope=`${name} · Source document dates ${from} to ${to}. Unposted Media documents and internal costs in the selected Accounting company. This is a posting-gap review, not a full reconciliation of Media profitability, receipts, allocations, accruals or all ledger balances. Sources may still require company assignment. A missing posting link does not prove an entry is absent: check existing manual journals and provisional costs before approving. Amounts are document currency, with no combined currency total. Approval rechecks source changes, permissions and posting rules.`;
  const proposal=(r:z.infer<typeof rowSchema>)=>r.eligible
    ? `Review existing journals and provisional costs, then post/link ${r.number??r.id} through the existing Accounting workflow. Net ${r.net}, tax ${r.tax}, total ${r.total} ${r.currency}; rate ${r.rate??"unavailable"} to ${r.base}. ${r.accruals.length?"Includes proposed net cost accruals: "+r.accruals.map(a=>`${a.amount} ${a.currency} (${a.reference})`).join("; "):"No cost accruals reported by the posting preview."}`
    : `Resolve the source prerequisite: ${r.reason||"Review the source in the posting center."}`;
  return {title:"Media → Accounting posting differences",href:"/finance/posting-center",scope,
    tables:[{heading:"Documents requiring review",columns:["Type","Document","Date","Party","Currency","Net","Tax","Total","Accounting status","Proposed solution"],rows:rows.map(r=>[r.type,r.number??r.id,r.date,r.party??"",r.currency,r.net,r.tax,r.total,r.status,proposal(r)])}],
    facts:{company:name,from,to,documentType,count:rows.length,scope:"unposted_document_bridge_only",noDifferences:rows.length===0?"No unposted source documents in this scope; other differences have not been tested.":undefined},
    corrections:rows.filter(r=>r.eligible&&r.status!=="posted").map(r=>({company,id:r.id,type:r.type,token:r.token,number:r.number??r.id,summary:proposal(r)})),
  };
}
