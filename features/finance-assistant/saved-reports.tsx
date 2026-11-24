"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FinanceReply } from "./contracts";
export function FinanceSavedReports({companyId,onRun}:{companyId:string;onRun:(reply:FinanceReply)=>void}){
 const [rows,setRows]=useState<Array<{id:string;name:string}>>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
 async function run(id?:string){setBusy(true);setStatus("");try{
  const response=await fetch("/api/accounting/assistant/saved-reports"+(id?"":`?company=${companyId}`),id?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"run",id,companyId})}:{cache:"no-store"});
  const data=await response.json();if(!response.ok)throw Error(data.error);if(id)onRun(data);else{setRows(data);if(!data.length)setStatus("No saved custom reports yet.");}
 }catch(e){setStatus(e instanceof Error?e.message:"Reports unavailable.");}finally{setBusy(false);}}
 return <section className="mt-6 rounded-lg border p-4"><h3 className="font-semibold">My custom accounting reports</h3><p className="my-2 text-sm text-muted-foreground">Describe the measures, grouping, period and columns you need, then save the resulting report for reuse.</p><Button disabled={busy} variant="outline" onClick={()=>void run()}>Load saved reports</Button>{rows.map(row=><Button key={row.id} disabled={busy} variant="outline" className="ml-2 mt-2" onClick={()=>void run(row.id)}>{row.name}</Button>)}{status&&<p role="status" className="mt-2 text-sm">{status}</p>}</section>;
}
