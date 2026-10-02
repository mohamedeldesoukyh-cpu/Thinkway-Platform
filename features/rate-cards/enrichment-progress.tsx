"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {getCreatorRefreshPollStatusAction,refreshCreatorAllAction} from "@/features/discovery/enrichment/actions";
import {useRateLanguage} from "./ui";
import {errorLabel} from "./labels";
import {toast} from "sonner";

export function EnrichmentProgress({creators}:{creators:{id:string;name:string;created:boolean;queued:boolean;pollId?:string}[]}){
  const {t}=useRateLanguage();const [attempt,setAttempt]=useState(0);const [statuses,setStatuses]=useState<Record<string,string>>({});
  useEffect(()=>{
    let live=true,offset=0;const states:Record<string,string>={};
    const poll=async()=>{
      const pending=creators.filter(c=>(c.queued||statuses[c.id]==="queued")&&(c.pollId||c.id.startsWith("inf:"))&&!['completed','failed'].includes(states[c.id]));
      const batch=pending.slice(offset,offset+10);offset=offset+10>=pending.length?0:offset+10;
      await Promise.all(batch.map(async c=>{try{const result=await getCreatorRefreshPollStatusAction(c.pollId??c.id.slice(4));states[c.id]=result.syncStatus;if(live)setStatuses(s=>({...s,[c.id]:result.syncStatus}));}catch{/* Keep queued status visible and retry on the next poll. */}}));
    };
    const timer=setInterval(()=>void poll(),5000);void poll();return()=>{live=false;clearInterval(timer);};
  },[creators,attempt]);
  if(!creators.length)return null;
  return <section className="space-y-2 rounded-lg border p-3" aria-live="polite"><p>{t("createdCount")}: {creators.filter(c=>c.created).length} · {t("enriched")}: {creators.filter(c=>statuses[c.id]==="completed").length} / {creators.length}</p><p className="text-sm text-muted-foreground">{t("enrichmentHelp")}</p><div className="max-h-48 overflow-auto">{creators.map(c=><div className="flex items-center justify-between gap-3 py-1" key={c.id}><span>{c.name}</span><span>{t(!c.queued&&!statuses[c.id]?"enrichmentDeferred":statuses[c.id]==="completed"?"completed":statuses[c.id]==="failed"?"failed":['running','processing','syncing'].includes(statuses[c.id])?"enrichment":"queued")}</span>{(statuses[c.id]==="failed"||(!c.queued&&!statuses[c.id]))&&<Button size="sm" variant="outline" onClick={async()=>{try{const result=await refreshCreatorAllAction(c.pollId??c.id.slice(4));if(!result.ok)throw new Error("enrichment");setAttempt(a=>a+1);setStatuses(s=>({...s,[c.id]:"queued"}));}catch(e){toast.error(t(errorLabel(e)));}}}>{t("retry")}</Button>}</div>)}</div></section>;
}
