"use client";
import {useEffect,useRef,useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {SearchableSelect} from "@/components/forms/searchable-select";
import {formatDocumentNumberForDisplay as doc} from "@/lib/documents/format-document-number";
import {recordClientAdvance} from "../advance-actions";
import type {CollectionsPageData} from "../redesign-data";

export function AdvanceReceiptForm({data,selectedClient}:{data:CollectionsPageData;selectedClient:string}){
 const router=useRouter();const [pending,start]=useTransition();const saving=useRef(false);const request=useRef("");
 const [client,setClient]=useState(selectedClient);const [campaign,setCampaign]=useState("");const [amount,setAmount]=useState("");const [currency,setCurrency]=useState("EGP");const [date,setDate]=useState(data.asOf.slice(0,10));const [method,setMethod]=useState<"bank_transfer"|"wire"|"check"|"credit_card"|"debit_card"|"paypal"|"other">("bank_transfer");const [reference,setReference]=useState("");const [notes,setNotes]=useState("");const [error,setError]=useState("");
 useEffect(()=>{setClient(selectedClient);setCampaign("");},[selectedClient]);
 return <form className="tw-c" data-payment-create aria-busy={pending} onSubmit={e=>{e.preventDefault();if(pending||saving.current||!client)return;saving.current=true;setError("");request.current||=crypto.randomUUID();start(async()=>{try{const result=await recordClientAdvance({request:request.current,client,campaign:campaign||null,amount:Number(amount),currency:currency as "EGP",date,method,reference,notes});if(!result.ok)setError(result.error??"Could not save advance.");else{toast.success("Receipt saved. Available campaign invoices have been settled; any remainder stays Advance.");setAmount("");setReference("");setNotes("");request.current="";router.refresh();}}catch{setError("Could not save advance. Retry with the same details.");}finally{saving.current=false;}});}}>
 <div className="tw-ch"><span className="tw-ct">Record advance payment</span><span className="tw-cs">Money received before invoicing · client required, campaign optional</span></div>
 <div className="tw-form">
 <div className="tw-f"><label className="tw-lbl" htmlFor="advance-client">Client</label><SearchableSelect id="advance-client" className="tw-in" value={client} searchPlaceholder="Search client name or code…" options={data.clients.map(c=>({value:c.id,label:c.name,description:doc(c.document_number),keywords:[c.document_number??""]}))} onValueChange={v=>{setClient(v);setCampaign("");}}/></div>
 <div className="tw-f"><label className="tw-lbl" htmlFor="advance-campaign">Campaign (optional)</label><select id="advance-campaign" className="tw-in" value={campaign} onChange={e=>setCampaign(e.target.value)}><option value="">No campaign · client advance</option>{(data.campaigns??[]).filter(c=>c.client_id===client).map(c=><option key={c.id} value={c.id}>{doc(c.document_number)} · {c.name}</option>)}</select></div>
 <label className="tw-f">Amount received<input className="tw-in" type="number" required min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
 <label className="tw-f">Currency<select className="tw-in" value={currency} onChange={e=>setCurrency(e.target.value)}>{["EGP","AED","USD","SAR","EUR","GBP"].map(c=><option key={c}>{c}</option>)}</select></label>
 <label className="tw-f">Payment date<input className="tw-in" type="date" required max={data.asOf.slice(0,10)} value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label className="tw-f">Method<select className="tw-in" value={method} onChange={e=>setMethod(e.target.value as typeof method)}>{["bank_transfer","wire","check","credit_card","debit_card","paypal","other"].map(m=><option key={m} value={m}>{m.replaceAll("_"," ")}</option>)}</select></label>
 <label className="tw-f">Bank reference<input className="tw-in" maxLength={120} value={reference} onChange={e=>setReference(e.target.value)}/></label>
 <label className="tw-f">Notes<input className="tw-in" maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
 </div><div className="tw-note">Campaign advances automatically become Actual when applied to an issued invoice in the same currency. Unlinked advances stay available until you choose Settle against an invoice. Any unused amount stays Advance.</div>
 {error&&<div className="tw-note wrn" role="alert">{error}</div>}<div className="tw-ch"><span className="tw-hint">Ctrl+S saves this receipt.</span><span className="tw-sp"/><button className="tw-b pri" disabled={pending||!client}>{pending?"Saving…":"Save advance"}</button></div></form>;
}
