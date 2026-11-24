"use client";
import { useRef,useState } from "react";
import { Button } from "@/components/ui/button";
type Job={id:string;sender:string;status:string;created_at:string;response_text:string|null;error_code:string|null};
export function FinanceAutomationWorkspace({companyId,yearId}:{companyId:string;yearId:string|null}){
 const [config,setConfig]=useState<{enabled:boolean;company_id:string;year_id:string}|null>(null);
 const [jobs,setJobs]=useState<Job[]>([]);const [status,setStatus]=useState("Check automation to load its configuration and request history.");const [busy,setBusy]=useState(false);const lock=useRef(false);
 async function api(body?:unknown){const response=await fetch('/api/accounting/assistant/automation',body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
 async function refresh(){const data=await api();setConfig(data.config);setJobs(data.jobs);setStatus([
  data.config?.enabled?'Report preparation is enabled for the saved company/year.':'Report preparation is disabled.',
  data.webhookConfigured?'Incoming-email verification is configured; provider registration and delivery must also be verified.':'Automatic receipt is not configured. Requests will not arrive in the processing queue automatically.',
  data.autoSendEnabled?'Automatic delivery is enabled.':'Automatic delivery is disabled. Prepared replies remain in this workspace.',
 ].join(' '));}
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);try{await work();}catch(e){setStatus(e instanceof Error?e.message:'Automation unavailable');}finally{lock.current=false;setBusy(false);}}
 return <section className="mx-auto mt-6 max-w-5xl space-y-4 rounded-xl border bg-card p-5" aria-label="Amgad automatic processing"><h2 className="font-semibold">Automatic email preparation</h2><p className="text-sm text-muted-foreground">Delegate read-only reports for the selected company and fiscal year. Requests are limited to the three approved finance addresses. No transactions are posted. Disabling stops pending work; a send already in progress may finish.</p>
 <div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={()=>void run(refresh)}>Check automation</Button><Button disabled={busy||!yearId} onClick={()=>void run(async()=>{await api({action:'configure',companyId,yearId,enabled:true});await refresh();})}>Enable automatic preparation</Button><Button disabled={busy||!config?.enabled} variant="outline" onClick={()=>void run(async()=>{await api({action:'configure',companyId:config!.company_id,yearId:config!.year_id,enabled:false});await refresh();})}>Disable automation</Button><Button disabled={busy||!config?.enabled} variant="outline" onClick={()=>void run(async()=>{await api({action:'process'});await refresh();})}>Process next request</Button></div>
 <p role="status" className="text-sm">{busy?'Working…':status}</p>{config&&<p className="text-sm">Preparation: {config.enabled?'Enabled':'Disabled'} · Scope {config.company_id===companyId&&config.year_id===yearId?'matches selected company/year':'differs from the current selection'}</p>}
 {jobs.map(job=><details key={job.id} className="rounded border p-3"><summary className="cursor-pointer text-sm">{job.sender} · {job.status} · {new Date(job.created_at).toLocaleString()}</summary>{job.error_code&&<p className="text-sm">Status detail: {job.error_code}</p>}{job.response_text&&<pre dir="auto" className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans text-sm">{job.response_text}</pre>}</details>)}
 </section>;
}
