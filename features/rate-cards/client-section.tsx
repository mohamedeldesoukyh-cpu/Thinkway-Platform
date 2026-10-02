"use client";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clientRateCardSetting, listRateCards } from "./actions";
import type { RateVersion } from "./model";
import { errorLabel } from "./labels";
import { useRateLanguage } from "./ui";
export function RateCardEnableField() {
  const {t,lang}=useRateLanguage();
  return <label dir={lang==="ar"?"rtl":"ltr"} className="flex items-center gap-2 rounded-lg border p-4"><input type="checkbox" name="rate_cards_enabled" value="true"/>{t("enable")}</label>;
}
export function ClientRateCardSection({clientId}:{clientId:string}) {
  const {t,lang}=useRateLanguage();const [enabled,setEnabled]=useState<boolean|null>(null);const [rows,setRows]=useState<RateVersion[]>([]);const [busy,start]=useTransition();
  useEffect(()=>{let live=true;clientRateCardSetting(clientId).then(v=>live&&setEnabled(v)).catch(()=>{});return()=>{live=false;};},[clientId]);
  useEffect(()=>{if(!enabled)return;let live=true;listRateCards({client:clientId}).then(r=>live&&setRows(r.rows)).catch(e=>toast.error(t(errorLabel(e))));return()=>{live=false;};},[enabled,clientId,t]);
  if(enabled===null)return null;
  return <section dir={lang==="ar"?"rtl":"ltr"} className="my-4 space-y-3 rounded-xl border p-4"><h2 className="font-semibold">{t("title")}</h2><label className="flex items-center gap-2"><input type="checkbox" disabled={busy} checked={enabled} onChange={e=>{const value=e.target.checked;start(async()=>{try{await clientRateCardSetting(clientId,value);setEnabled(value);}catch(error){toast.error(t(errorLabel(error)));}});}}/>{t("enable")}</label><p className="text-sm text-muted-foreground">{t("optional")}</p>{enabled&&<><ul className="space-y-2 text-sm">{rows.map(r=><li key={r.id}>{r.name} · {r.brand_name??t("clientLevel")} · {r.version} · {t(r.status)}</li>)}</ul><Button asChild variant="outline"><Link href={`/rate-cards?client=${clientId}`}>{t("manage")}</Link></Button></>}</section>;
}
