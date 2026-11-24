"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FinanceEvidence } from "./contracts";

type Correction=NonNullable<FinanceEvidence["corrections"]>[number];
export function FinanceCorrectionReview({correction}:{correction:Correction}){
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[attempted,setAttempted]=useState(false);
  const [message,setMessage]=useState(""),[journal,setJournal]=useState<string|null>(null);
  const running=useRef(false);
  async function execute(){
    if(!confirmed||running.current||attempted)return;
    running.current=true;setBusy(true);setAttempted(true);setMessage("");
    try{
      const result=await fetch("/api/accounting/assistant/corrections",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...correction,operation:"post"})});
      const data=await result.json();
      if(!result.ok)throw Error(data.error||"Posting was not confirmed.");
      const check=await fetch("/api/accounting/media-posting?"+new URLSearchParams({mode:"source",company:correction.company,type:correction.type,id:correction.id}),{cache:"no-store"});
      const source=await check.json();
      if(!check.ok||source.status!=="posted"||source.journal!==data.journal)throw Error("The posting request completed, but its final state could not be verified. Check the posting center before retrying.");
      setJournal(source.journal);setMessage("Verified: this document is posted and linked to its Accounting journal. Ask Amgad to refresh the differences report for the remaining items.");
    }catch(e){setMessage(e instanceof Error?e.message:"Result uncertain. Review the posting center before retrying.");}
    finally{setBusy(false);setConfirmed(false);running.current=false;}
  }
  return <section className="mt-4 rounded-lg border p-4" aria-label={`Proposed correction ${correction.number}`}>
    <h3 className="font-semibold">Proposed accounting correction · {correction.number}</h3>
    <p className="mt-2 text-sm" dir="auto">{correction.summary}</p>
    <p className="mt-2 text-sm">Only mohamedeldesouky@thinkwaymedia.com may approve accounting corrections proposed by Amgad. Email instructions never execute them.</p>
    <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy||attempted} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the source, company, amounts, tax and accruals, and checked for existing manual or provisional entries. I approve this document’s posting/linking.</label>
    <Button className="mt-3" disabled={!confirmed||busy||attempted} onClick={()=>void execute()}>{busy?"Posting and verifying…":"Approve and apply correction"}</Button>
    {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
    {journal&&<Link className="mt-2 block underline" href={`/accounting?company=${correction.company}&journal=${journal}#journals`}>View verified journal</Link>}
    {attempted&&!journal&&!busy&&<p className="mt-2 text-sm">Refresh the report before taking any further action on this document.</p>}
  </section>;
}
