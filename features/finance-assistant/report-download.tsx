"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceEvidence } from "./contracts";
export function FinanceReportDownload({plan,companyId,yearId}:{plan:NonNullable<FinanceEvidence["reportPlan"]>;companyId:string;yearId:string|null}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [saved,setSaved]=useState(false);
 async function save(){setBusy(true);setError("");try{const r=await fetch("/api/accounting/assistant/saved-reports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save",companyId,yearId,plan})});if(!r.ok)throw Error((await r.json()).error);setSaved(true);}catch(e){setError(e instanceof Error?e.message:"Save failed.");}finally{setBusy(false);}}
 async function download(){setBusy(true);setError("");try{
  const response=await fetch("/api/accounting/assistant/report",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId,yearId,plan})});
  if(!response.ok)throw Error((await response.json()).error||"Export failed.");
  const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download="Amgad-accounting-report.pdf";link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }catch(e){setError(e instanceof Error?e.message:"Export failed.");}finally{setBusy(false);}}
 return <div className="my-3"><Button disabled={busy} variant="outline" onClick={()=>void download()}>{busy?"Working…":"Download system PDF"}</Button>{plan.action==="custom_ledger"&&<Button disabled={busy||saved} className="ml-2" variant="outline" onClick={()=>void save()}>{saved?"Report saved":"Save custom report"}</Button>}<p className="mt-1 text-xs text-muted-foreground">Regenerates this report from current system records using the displayed filters.</p>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
