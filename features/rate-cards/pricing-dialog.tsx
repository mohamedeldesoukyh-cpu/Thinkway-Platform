"use client";
import {useState,useTransition} from "react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {applyRatePricing,previewRatePricing} from "./actions";
import {pricingRuleSchema,type PricingRule} from "./model";
import {errorLabel,taxonomyLabel,type Label} from "./labels";
import {Modal,Choice,TextField,cell,useRateLanguage} from "./ui";

export function PricingDialog({versionId,onClose,onDone}:{versionId:string;onClose:()=>void;onDone:()=>void}){
  const {lang,t}=useRateLanguage();const [busy,start]=useTransition();
  const [rule,setRule]=useState<PricingRule>({mode:"cost_gp_pct",percent:0,agencyFee:null,overwrite:false});
  const [preview,setPreview]=useState<Awaited<ReturnType<typeof previewRatePricing>>|null>(null);
  const change=(patch:Partial<PricingRule>)=>{setRule(r=>({...r,...patch}));setPreview(null);};
  const run=(fn:()=>Promise<void>)=>start(async()=>{try{await fn();}catch(e){toast.error(t(errorLabel(e)));}});
  return <Modal open onClose={()=>!busy&&onClose()} title={t("pricing")} description={t("pricingHelp")} lang={lang}>
    <div className="grid gap-3 sm:grid-cols-2">
      <Choice label={t("pricing")} value={rule.mode} empty={false} disabled={busy} options={[{value:"cost_gp_pct",label:t("gp")},{value:"cost_markup_pct",label:t("markup")},{value:"none",label:t("feeOnly")}]} onChange={mode=>change({mode:mode as PricingRule["mode"]})}/>
      {rule.mode!=="none"&&<TextField label={t("percentage")} type="number" value={String(rule.percent)} disabled={busy} onChange={v=>change({percent:Number(v)})}/>}
      <TextField label={t("agencyFee")} type="number" value={rule.agencyFee==null?"":String(rule.agencyFee)} disabled={busy} onChange={v=>change({agencyFee:v===""?null:Number(v)})}/>
      <Choice label={t("action")} value={String(rule.overwrite)} disabled={busy} empty={false} options={[{value:"false",label:t("missing")},{value:"true",label:t("overwrite")}]} onChange={v=>change({overwrite:v==="true"})}/>
    </div>
    <Button disabled={busy||!pricingRuleSchema.safeParse(rule).success} onClick={()=>run(async()=>setPreview(await previewRatePricing(versionId,rule)))}>{t("preview")}</Button>
    {preview&&<><p>{t("affected")}: {preview.rows.length}</p><div className="max-h-80 overflow-auto"><table className="w-full"><thead><tr>{["creator","platform","deliverable","before","after","gp","markup","agencyFee"].map(k=><th className={cell} key={k}>{t(k as Label)}</th>)}</tr></thead><tbody>{preview.rows.map((r,i)=><tr className="border-t" key={i}><td className={cell}>{r.rate.creator_name}</td><td className={cell}>{taxonomyLabel(r.rate.platform??"",lang)}</td><td className={cell}>{taxonomyLabel(r.rate.deliverable??"",lang)}</td><td className={cell}>{r.before??"—"}</td><td className={cell}>{r.rate.currency} {r.rate.amount.toLocaleString(lang)}</td><td className={cell}>{r.gp_percent?.toFixed(2)??"—"}%</td><td className={cell}>{r.markup_percent?.toFixed(2)??"—"}%</td><td className={cell}>{r.rate.agency_fee_percent??"—"}%</td></tr>)}</tbody></table></div><Button disabled={busy||!preview.rows.length} onClick={()=>run(async()=>{await applyRatePricing(versionId,rule,preview.fingerprint);toast.success(t("saved"));onDone();})}>{t(busy?"busy":"confirmApply")}</Button></>}
  </Modal>;
}
