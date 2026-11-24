import {useState} from "react";
import {Button} from "@/components/ui/button";
import type {FinanceEvidence} from "./contracts";
type Prepared={approval:string;subject:string;text:string;recipients:{to:string[];cc:string[]};sendEnabled:boolean};
export function FinanceComposeWorkspace({plan,companyId,yearId}:{plan:NonNullable<FinanceEvidence["reportPlan"]>;companyId:string;yearId:string|null}){
 const [to,setTo]=useState(""),[cc,setCc]=useState(""),[note,setNote]=useState(""),[language,setLanguage]=useState("en"),[purpose,setPurpose]=useState("statement");
 const [prepared,setPrepared]=useState<Prepared|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[receipt,setReceipt]=useState("");
 async function act(action:"prepare"|"send"|"preview-pdf"){
  setBusy(true);setError("");if(action==="prepare"){setPrepared(null);setReceipt("");}
  try{
   const addresses=(v:string)=>v.split(/[,;]/).map(s=>s.trim()).filter(Boolean);
   const response=await fetch("/api/accounting/assistant/compose",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action==="prepare"?{action,companyId,yearId,plan,recipients:{to:addresses(to),cc:addresses(cc)},language,purpose,note}:{action,approval:prepared?.approval})});
   if(!response.ok)throw Error((await response.json()).error||"Email operation failed.");
   if(action==="preview-pdf"){const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download="Amgad-accounting-report.pdf";link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
   else if(action==="prepare")setPrepared(await response.json());else{const result=await response.json();setReceipt(result.id);}
  }catch(e){setError(e instanceof Error?e.message:"Email failed. Retry the same prepared message if delivery is uncertain.");}finally{setBusy(false);}
 }
 return <details className="my-3 rounded border p-3"><summary className="cursor-pointer text-sm font-medium">Email report / follow up on payment</summary><p className="mt-2 text-xs text-muted-foreground">Only mohamedeldesouky@thinkwaymedia.com may approve sending. Enter the intended client recipients and any people to copy. Review the exact recipients, message and attached system PDF before sending.</p><fieldset disabled={busy} onChange={()=>{setPrepared(null);setReceipt("");}} className="mt-3 space-y-2">
 <label className="block text-sm">To (comma-separated)<input className="mt-1 block min-h-11 w-full rounded border bg-background px-3" value={to} onChange={e=>setTo(e.target.value)}/></label>
 <label className="block text-sm">CC (optional)<input className="mt-1 block min-h-11 w-full rounded border bg-background px-3" value={cc} onChange={e=>setCc(e.target.value)}/></label>
 <label className="block text-sm">Language<select className="ml-2 min-h-11 rounded border bg-background" value={language} onChange={e=>setLanguage(e.target.value)}><option value="en">English</option><option value="ar">العربية</option></select></label>
 <label className="block text-sm">Purpose<select className="ml-2 min-h-11 rounded border bg-background" value={purpose} onChange={e=>setPurpose(e.target.value)}><option value="statement">Send report / statement</option>{plan.action==="client_outstanding"&&<option value="payment_followup">Request payment update</option>}</select></label>
 <label className="block text-sm">Additional message (optional)<textarea dir="auto" className="mt-1 block w-full rounded border bg-background p-3" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label></fieldset>
 <Button className="mt-3" variant="outline" disabled={busy||!to.trim()} onClick={()=>void act("prepare")}>Prepare formatted email</Button>
 {prepared&&<div className="mt-3 space-y-2 rounded border p-3"><p className="text-sm">To: {prepared.recipients.to.join(", ")}<br/>CC: {prepared.recipients.cc.join(", ")||"None"}<br/>Subject: {prepared.subject}</p><p dir="auto" className="whitespace-pre-wrap text-sm">{prepared.text}</p><Button disabled={busy} variant="outline" onClick={()=>void act("preview-pdf")}>Preview exact PDF attachment</Button><Button className="ml-2" disabled={busy||!prepared.sendEnabled||!!receipt} onClick={()=>void act("send")}>{receipt?"Sent":"Send reviewed email"}</Button>{!prepared.sendEnabled&&<p className="text-xs text-muted-foreground">Sending is disabled on dev. No client email has been sent.</p>}{receipt&&<p role="status" className="text-sm">Provider receipt: {receipt}</p>}</div>}{error&&<p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</details>;
}
