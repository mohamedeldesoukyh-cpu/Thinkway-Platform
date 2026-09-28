"use client";
import type { CommercialIoSnapshot } from "../types";
import { useCallback, useEffect, useState } from "react";
import { CommercialReveal, CommercialViewIcon } from "./commercial-motion";
import { useRouter } from "next/navigation";

type Io = {id:string;number:string|null;status:string;approved:boolean;canApprove:boolean;available:boolean};
export function CommercialClientIo({token,initial}:{token:string;initial?:CommercialIoSnapshot}) {
  const router=useRouter();
  const href=`/api/review/client-io?sign=${encodeURIComponent(token)}`;
  const [io,setIo]=useState<Io|null>(initial?.io ?? null);
  const [loading,setLoading]=useState(!initial);
  const [message,setMessage]=useState(initial?.message ?? "");
  const [error,setError]=useState("");
  const [confirm,setConfirm]=useState(false);
  const [email,setEmail]=useState("");
  const [pending,setPending]=useState(false);
  const reload=useCallback(async()=>{
    try {
      const response=await fetch(`${href}&format=status`,{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw Error(data.error || "Could not load Client IO.");
      setIo(data.io);setMessage(data.message);setError("");
      if(data.io?.approved) setConfirm(false);
    } catch(e) {setError(e instanceof Error ? e.message : "Could not load Client IO.");}
    finally {setLoading(false);}
  },[href]);
  useEffect(()=>{if(!initial) void reload();const onFocus=()=>{void reload();};window.addEventListener("focus",onFocus);return()=>window.removeEventListener("focus",onFocus);},[reload,initial]);
  async function approve(event:React.FormEvent) {
    event.preventDefault();setPending(true);setError("");
    try {
      const response=await fetch(href,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ioId:io?.id,email})});
      const result=await response.json();
      if(!response.ok) throw Error(result.error || "Approval failed.");
      setConfirm(false);await reload();router.refresh();
    } catch(e) {setError(e instanceof Error ? e.message : "Approval failed.");}
    finally {setPending(false);}
  }
  return <CommercialReveal className="cm-doc">
    <p className="ck">Client IO</p><h2>{io?.number || "Client insertion order"}</h2>
    <span className={`cm-pill ${io?.approved ? "success" : "info"}`} role="status">{loading ? "Loading…" : io?.approved ? "Approved" : io?.canApprove ? "Awaiting your approval" : io ? "Current document" : "Not available yet"}</span>
    <p className="note">{loading ? "Loading Client IO…" : io ? io.approved ? "View and download the approved Client IO, including its approval date." : !io.available ? "Client IO unavailable — please contact Thinkway." : io.canApprove ? "Awaiting your approval. View the Client IO before approving." : "Current Client IO — approval becomes available once sent with an active approval link." : message}</p>
    <div className="sumbar-cta" style={{marginTop:12}}>
      {io?.available ? <><a className="btn sec cm-icon" aria-label="View Client IO" title="View Client IO" href={`${href}&ioId=${encodeURIComponent(io.id)}&source=current&view=1&format=html`} target="_blank" rel="noopener noreferrer"><CommercialViewIcon /></a><a className="btn pri" href={`${href}&ioId=${encodeURIComponent(io.id)}&source=current`}>Download PDF</a></> : <><button className="btn sec cm-icon" aria-label="View Client IO" title="View Client IO" disabled><CommercialViewIcon /></button><button className="btn pri" disabled>Download PDF</button></>}
      {io && <button className="btn sec" disabled={!io.canApprove || io.approved || pending} onClick={()=>setConfirm(true)}>{io.approved ? "Approved" : "Approve Client IO"}</button>}
    </div>
    {io?.available && ["sent","under_client_review"].includes(io.status) && <p className="note"><a href={`${href}&ioId=${encodeURIComponent(io.id)}&view=1&format=html`} target="_blank" rel="noopener noreferrer">View saved {io.approved ? "approved" : "issued"} IO</a>{" · "}<a href={`${href}&ioId=${encodeURIComponent(io.id)}`}>Download saved {io.approved ? "approved" : "issued"} IO</a></p>}
    {confirm && <form onSubmit={approve} style={{marginTop:16}}>
      <p className="note">Confirm approval of the saved issued {io?.number} shown in the link above. Enter your email to record your approval and receive confirmation.</p>
      <input id="commercial-io-approver-email" className="noteinput" type="email" required aria-label="Approver email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={pending}/>
      <button className="btn pri" type="submit" disabled={pending}>{pending ? "Approving…" : "Confirm approval"}</button>
      <button className="btn sec" type="button" disabled={pending} onClick={()=>setConfirm(false)}>Cancel</button>
    </form>}
    {error && <p role="alert" className="sumbar-msg">{error} <button type="button" className="btn sec" onClick={()=>void reload()}>Retry</button></p>}
  </CommercialReveal>;
}
