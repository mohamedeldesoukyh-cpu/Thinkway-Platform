"use client";
import { useRef,useState } from "react";
import { Button } from "@/components/ui/button";

type Thread={id:string;subject:string;from:string};
type Email={id:string;from:string;subject:string;text?:string|null;eligible:boolean;attachments?:Array<{filename:string|null}>};
type Draft={recipient:string;text:string;approval:string;sendEnabled:boolean};
export function FinanceMailWorkspace({companyId,yearId}:{companyId:string;yearId:string|null}) {
  const [threads,setThreads]=useState<Thread[]>([]);
  const [messages,setMessages]=useState<Email[]>([]);
  const [threadId,setThreadId]=useState<string|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [status,setStatus]=useState("Email connection has not been checked.");
  const [busy,setBusy]=useState(false);
  const locked=useRef(false);
  async function run(work:()=>Promise<void>){if(locked.current)return;locked.current=true;setBusy(true);try{await work();}catch(error){setStatus(error instanceof Error?error.message:"Unable to load email.");}finally{locked.current=false;setBusy(false);}}
  async function api(path="",body?:unknown){
    const response=await fetch(`/api/accounting/assistant/mail${path}`,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(65000)}:{signal:AbortSignal.timeout(30000)});
    const value=await response.json();if(!response.ok)throw new Error(value.error||"Email request failed.");return value;
  }
  return <section className="mx-auto mt-6 w-full max-w-5xl space-y-4 rounded-xl border bg-card p-5" aria-label="Amgad email inbox">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Amgad’s email / بريد أمجد</h2><p className="text-sm text-muted-foreground">amgad@thinkwaymedia.com · Google Workspace → Resend</p></div>
      <Button variant="outline" disabled={busy} onClick={()=>void run(async()=>{const result=await api();setThreads(result.threads);setStatus(result.hasMore?"Connected. Showing the latest 25 conversations; older mail is available in Resend.":"Connected to Amgad’s Resend inbox.");})}>Refresh inbox</Button></div>
    <p className="text-sm" role="status">{busy?"Working…":status}</p>
    <p className="text-sm text-muted-foreground">Prepare a reply using the selected company and fiscal year, then review the exact recipient and report before sending. Attachments require manual review. Automatic replies are not enabled.</p>
    <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2">{threads.map(thread=><button key={thread.id} disabled={busy} className="block w-full rounded-lg border p-3 text-start hover:bg-muted" onClick={()=>void run(async()=>{setDraft(null);setMessages([]);setThreadId(thread.id);const result=await api(`?threadId=${thread.id}`);setMessages(result.messages);setStatus(result.hasMore?"This conversation has more than 100 messages. Open Resend for the full history.":"Choose an incoming request to prepare a reply.");})}><span className="block font-medium" dir="auto">{thread.subject||"(No subject)"}</span><span className="break-all text-xs">{thread.from}</span></button>)}</div>
    <div className="space-y-3">{messages.map(mail=><article key={mail.id} className="rounded-lg border p-3"><p className="break-all text-xs">{mail.from}</p><p className="my-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-sm" dir="auto">{mail.text||"No plain-text message available."}</p>{!!mail.attachments?.length&&<p className="text-sm">Attachments: {mail.attachments.map(a=>a.filename||"Unnamed file").join(", ")}</p>}<Button disabled={busy||!mail.eligible||!!mail.attachments?.length} variant="outline" onClick={()=>void run(async()=>{setDraft(null);const result=await api("",{action:"prepare",threadId,emailId:mail.id,companyId,yearId});setDraft(result);setStatus("Reply prepared. Review it below; approval expires in 10 minutes.");})}>Prepare finance reply</Button>{!mail.eligible&&<p className="mt-2 text-xs text-muted-foreground">Not an authorized incoming finance request.</p>}</article>)}</div></div>
    {draft&&<article className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">Review reply</h3><p className="break-all text-sm">To: {draft.recipient} · From: Amgad</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans text-sm" dir="auto">{draft.text}</pre><Button disabled={busy||!draft.sendEnabled} onClick={()=>void run(async()=>{await api("",{action:"send",approval:draft.approval});setDraft(null);setStatus("Reply accepted by Resend. Delivery status is available in Resend.");})}>Approve and send reply</Button>{!draft.sendEnabled&&<p className="text-sm text-muted-foreground">Sending is disabled in this environment.</p>}</article>}
  </section>;
}
