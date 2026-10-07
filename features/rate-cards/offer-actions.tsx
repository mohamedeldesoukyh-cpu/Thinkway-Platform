"use client";
import {useEffect,useState,useTransition} from "react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {CreatorDetailSheet} from "@/features/campaigns/components/creator-detail-sheet-lazy";
import {CreatorPickerDialog} from "@/features/creators/picker/creator-picker-dialog";
import type {UnifiedCreatorResult} from "@/lib/creators/types";
import {parseProfileInput} from "@/lib/social/parse-profile-url";
import {Choice,TextField,useRateLanguage} from "./ui";
import {RateOverlay,RateSkeleton} from "./redesign-ui";
import {editRateOffer,ensureRateImportProfiles,getRateCardCreator} from "./actions";
import {errorLabel,taxonomyLabel} from "./labels";
import {rateDeliverables} from "./platforms";
import type {RateLine} from "./model";
import {packageDetailsSchema} from "./packages";

export type OfferAction="details"|"replace"|"urls"|"deliverable";
export function OfferActions({line,mode,expected,onClose,onSaved}:{line:RateLine;mode:OfferAction;expected:string;onClose:()=>void;onSaved:()=>void}){
 const {lang,t}=useRateLanguage();const ar=lang==="ar";const [busy,start]=useTransition();const [error,setError]=useState("");
 const [creator,setCreator]=useState<UnifiedCreatorResult|null>(null);
 const [replacement,setReplacement]=useState<UnifiedCreatorResult|null>(null);const [picker,setPicker]=useState(false);
 const [url,setUrl]=useState("");const [linked,setLinked]=useState(false);
 const [deliverable,setDeliverable]=useState(line.deliverable);
 const [name,setName]=useState(line.package_details?.name??"");const [reels,setReels]=useState(String(line.package_details?.reels??1));const [stories,setStories]=useState(String(line.package_details?.stories??0));
 const [urls,setUrls]=useState([0,1,2].map(i=>line.package_details?.profiles[i]?.profile_url??""));
 useEffect(()=>{if(mode!=="details")return;let live=true;getRateCardCreator(line.creator_ref).then(c=>{if(live){setCreator(c);if(!c)setError(t("unmatched"));}}).catch(e=>{if(live)setError(t(errorLabel(e)));});return()=>{live=false;};},[line.creator_ref,mode,t]);
 const run=(work:()=>Promise<void>)=>start(async()=>{try{setError("");await work();}catch(e){setError(t(errorLabel(e)));}});
 if(mode==="details")return creator?<CreatorDetailSheet creator={creator} open presentation="discoveryPack" onOpenChange={open=>{if(!open)onClose();}} onCreatorUpdated={c=>{setCreator(c);onSaved();}}/>:<RateOverlay title={line.creator_name} description={ar?"تفاصيل المبدع":"Creator details"} lang={lang} onClose={onClose}>{error?<p role="alert">{error}</p>:<RateSkeleton/>}</RateOverlay>;
 const title=mode==="replace"?(ar?"استبدال المبدع":"Replace creator"):mode==="urls"?(ar?"إضافة رابط حساب":"Add profile URL"):(ar?"تعديل نوع المحتوى / الباقة":"Edit deliverable / package");
 return <RateOverlay title={title} description={line.creator_name} lang={lang} busy={busy} onClose={onClose}>
  {error&&<p className="rx-ro" role="alert">{error}</p>}
  {mode==="replace"&&<><p>{ar?"يتم استبدال المبدع في هذا العرض وكل أسعاره فقط. تبقى القيم والعملات وأتعاب الوكالة كما هي. لا تتغير عروض الأسعار السابقة.":"Replace the creator for this offer and its pricing records only. Amounts, currencies and agency fees stay unchanged. Existing quotations are unaffected."}</p><Button variant="outline" disabled={busy} onClick={()=>setPicker(true)}>{t("selectCreator")}</Button><CreatorPickerDialog open={picker} onOpenChange={setPicker} selectionMode="single" panelLayout title={title} onConfirm={creators=>{setReplacement(creators[0]??null);setPicker(false);}}/>{replacement&&<><p><bdi>{line.creator_name}</bdi> → <bdi>{replacement.display_name}</bdi></p>{line.package_key&&<p>{ar?"تُستخدم روابط المبدع البديل لنفس منصات الباقة.":"Package links will use the replacement creator’s accounts for the same included platforms."}</p>}<Button disabled={busy||replacement.unified_id===line.creator_ref} onClick={()=>run(async()=>{await editRateOffer(line.version_id,line.id,{kind:"creator",creatorRef:replacement.unified_id},expected);onSaved();onClose();})}>{ar?"تأكيد الاستبدال":"Confirm replacement"}</Button></>}</>}
  {mode==="urls"&&<><TextField label={t("profileUrl")} value={url} onChange={v=>{setUrl(v);setLinked(false);}} disabled={busy}/><p>{ar?"يرتبط الحساب بهذا المبدع بعد التحقق من الرابط. الحساب الموجود لا يتكرر، والرابط الذي يخص مبدعاً آخر يُرفض.":"Links the account to this creator after checking the URL. Existing accounts are reused; a URL owned by another creator is rejected."}</p><Button disabled={busy||!parseProfileInput(url)||linked} onClick={()=>run(async()=>{await ensureRateImportProfiles([url],line.creator_ref,"edit");setLinked(true);onSaved();toast.success(t("saved"));})}>{ar?"ربط الحساب":"Link profile"}</Button>{linked&&<p role="status">{line.package_key?(ar?"تم ربط الحساب. استخدم تعديل الباقة لإضافته إلى المنصات المشمولة.":"Profile linked. Use Edit deliverable / package to include it in this package."):(ar?"تم ربط الحساب بالمبدع.":"Profile linked to the creator.")}</p>}</>}
  {mode==="deliverable"&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();run(async()=>{
   if(line.package_details){const profiles=urls.filter(s=>s.trim()).map(s=>parseProfileInput(s));if(profiles.some(p=>!p))throw new Error("invalid");const details=packageDetailsSchema.parse({name,reels:reels.trim()?Number(reels):NaN,stories:stories.trim()?Number(stories):NaN,profiles:profiles.map(p=>({platform:p!.platform,profile_url:p!.profile_url}))});await editRateOffer(line.version_id,line.id,{kind:"package",details},expected);}
   else await editRateOffer(line.version_id,line.id,{kind:"deliverable",deliverable},expected);
   onSaved();onClose();
  });}}><p>{ar?"تبقى الأسعار كما هي. راجع الأسعار بعد تغيير المحتوى أو عدد القطع.":"Prices stay unchanged. Review them after changing the deliverable or quantities."}</p>{line.package_details?<><TextField label={ar?"اسم الباقة":"Package name"} value={name} onChange={setName} disabled={busy}/><TextField label={ar?"عدد الريلز":"Reels"} value={reels} onChange={setReels} type="number" disabled={busy}/><TextField label={ar?"عدد الستوري":"Stories"} value={stories} onChange={setStories} type="number" disabled={busy}/>{urls.map((u,i)=><TextField key={i} label={`${t("profileUrl")} ${i+1}`} value={u} onChange={v=>setUrls(old=>old.map((s,j)=>j===i?v:s))} disabled={busy}/>)}<p>{ar?"من منصة واحدة إلى ثلاث منصات مختلفة. اربط أي حساب جديد بالمبدع قبل إضافته هنا.":"One to three distinct platforms. Link any new account to the creator before including it here."}</p></>:<Choice label={t("deliverable")} value={deliverable} onChange={setDeliverable} disabled={busy} options={rateDeliverables(line.platform).map(d=>({value:d.value,label:taxonomyLabel(d.value,lang,d.label)}))}/>}<Button type="submit" disabled={busy}>{t(busy?"busy":"save")}</Button></form>}
 </RateOverlay>;
}
