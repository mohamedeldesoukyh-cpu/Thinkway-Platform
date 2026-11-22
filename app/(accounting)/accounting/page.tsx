import { AccountingConsole } from "@/features/accounting/console";
import { loadAccountingSetup } from "@/features/accounting/setup-server";

export default async function AccountingPage({searchParams}:{searchParams:Promise<{company?:string|string[]}>}) {
  let initial;
  try { const query=await searchParams;initial = await loadAccountingSetup(typeof query.company==='string'?query.company:undefined); }
  catch(e) { return <main className="tw-accounting tw-accounting-access"><h1>Accounting setup unavailable</h1><p>{e instanceof Error?e.message:"Please retry."}</p><a href="/accounting">Retry</a></main>; }
  return <AccountingConsole initial={initial} />;
}
