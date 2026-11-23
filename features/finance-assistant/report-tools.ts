// Credential-free adapter: its caller supplies the authenticated, RLS-scoped client.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { financialReportSections } from "@/features/accounting/financial-report-options-model";
import { statementGroups, type Statement } from "@/features/accounting/statement-model";
import type { AccountingSetup } from "@/features/accounting/setup-types";
import type { FinanceEvidence, FinancePlan } from "./contracts";

const amount = z.string().regex(/^-?\d+(\.\d+)?$/);
const accountSchema = z.object({account:z.string(),name:z.string(),currency:z.string(),opening:amount,debit:amount,credit:amount,closing:amount});
const reportSchema = z.object({currency:z.string(),accounts:z.array(accountSchema),count:z.number().optional()});
const partySchema = z.array(z.object({id:z.string().uuid(),name:z.string(),code:z.string().nullable().optional()}));

export async function executeFinanceReport(
  db: SupabaseClient, setup: AccountingSetup, yearId: string | null,
  plan: Exclude<FinancePlan, { action: "reply" }>,
): Promise<FinanceEvidence> {
  const company = setup.company;
  if (!company) throw new Error("Select an accounting company.");
  const year = setup.years.find(y => y.id === yearId);
  if ((!plan.from || !plan.to) && !year) throw new Error("Select a fiscal year or specify both dates.");
  const from = plan.from ?? year!.start_date, to = plan.to ?? year!.end_date;
  if (from > to) throw new Error("Invalid reporting period.");
  let partyId: string | null = null;
  let partyName: string | null = null;
  if (plan.action === "client_statement") {
    const found = await db.rpc("tw_accounting_party_lookup", {p_company:company.id,p_kind:"client",p_search:plan.clientName,p_selected:null});
    if (found.error) throw new Error("Client lookup unavailable.");
    const candidates = partySchema.parse(found.data);
    if (candidates.length !== 1) return {
      title:"Client selection",href:`/accounting?company=${company.id}#client-statements`,
      scope:candidates.length ? "Choose a client before retrieving a statement." : "No matching client found in the accounting directory.",
      facts:{candidates:candidates.slice(0,10).map(({name,code})=>({name,code})),moreMatches:candidates.length>10},
    };
    partyId = candidates[0].id; partyName = candidates[0].name;
  }
  const options = {includeAuxiliary:false,includeThirdParties:false,reportMode:plan.action === "pnl" ? "profit" : "statement",
    dateBasis:"journal",excludeClosing:plan.action === "pnl",display:plan.display,accountStatus:"all",types:[],includeUnlocked:true,
    excludeReversals:false,skipZero:false,skipInactivePeriod:false};
  const result = await db.rpc("tw_accounting_statement_filtered", {
    p_options:options,p_auxiliary:null,p_company:company.id,p_from:from,p_to:to,p_account:null,
    p_kind:partyId ? "client" : "all",p_party:partyId,p_currency:null,p_offset:0,
  });
  if (result.error) throw new Error("Accounting report unavailable.");
  const report = reportSchema.parse(result.data);
  const params = new URLSearchParams({company:company.id});
  if (year) params.set("year",year.id);
  const scope = `${company.name} · ${from} to ${to} · Journal dates · Posted transactions including unlocked entries · ${plan.display === "foreign" ? "Foreign currencies shown separately" : plan.display === "USD" ? "Second local: USD" : "Company base currency: " + company.base_currency}. ${plan.action === "pnl" ? "Closing entries excluded. Ledger-based income and expenses; completeness depends on recorded entries, not certified IFRS financial statements." : "Opening balances, debits, credits and closing balances from the accounting statement."} Report link opens the accounting screen; use the dates and display shown here.`;
  if (plan.action === "pnl") {
    const sections = financialReportSections({...report,auxiliaries:[]},setup.accounts,"profit",false,false);
    return {title:"Accounting Profit & Loss",href:`/accounting?${params}#financial-statements`,scope,
      facts:{company:company.name,from,to,display:plan.display,sections}};
  }
  const groups = statementGroups({...report,rows:[],count:report.count??0} as Statement);
  return {title:`${partyName} — account statement`,href:`/accounting?${params}#client-statements`,scope,
    facts:{company:company.name,client:partyName,from,to,display:plan.display,groups:groups.map(({currency,totals,accounts})=>({currency,totals,accounts}))}};
}
