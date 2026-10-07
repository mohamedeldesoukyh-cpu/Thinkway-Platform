"use client";
import {useState} from "react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {CreatorAvatarImage} from "@/components/creator/creator-avatar-image";
import {CombineCreatorsDialog} from "@/features/discovery/components/combine-creators-dialog";
import {DeleteDiscoveryCreatorDialog} from "@/features/discovery/delete-creator/delete-discovery-creator-dialog";
import {creatorProfileSourceFromUnified} from "@/lib/creators/creator-profile-source";
import type {UnifiedCreatorResult} from "@/lib/creators/types";
import type {ImportRow} from "./model";
import {getRateImportConflictCreator} from "./actions";
import {Modal,useRateLanguage} from "./ui";

export function ImportConflicts({rows,onResolved}:{rows:ImportRow[];onResolved:()=>Promise<void>}){
 const {lang}=useRateLanguage(),ar=lang==="ar";
 const [creator,setCreator]=useState<UnifiedCreatorResult|null>(null),[mode,setMode]=useState<"view"|"merge"|"delete">("view"),[loading,setLoading]=useState(false);
 const conflicts=rows.filter(row=>row.conflicts?.length);
 if(!conflicts.length)return null;
 async function open(ref:string,next:"view"|"delete"){
  setLoading(true);try{const c=await getRateImportConflictCreator(ref);if(c){setCreator(c);setMode(next);}else await onResolved();}catch{toast.error(ar?"تعذر تحميل المبدع":"Could not load creator");}finally{setLoading(false);}
 }
 async function resolved(){setCreator(null);setLoading(true);try{await onResolved();}catch{toast.error(ar?"أعد فحص التعارض":"Recheck the conflict to continue");}finally{setLoading(false);}}
 return <section className="ru-conflicts space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
  <h3 className="font-semibold">{ar?"الاستيراد متوقف — راجع تعارض المبدعين":"Import paused — review creator conflicts"}</h3>
  <p className="text-sm">{ar?"الملف والتقدم محفوظان هنا. راجع المبدع القديم ثم ادمجه أو احذفه لتكمل نفس الاستيراد.":"Your file stays here. Nothing is merged automatically. Review the existing creators, then recheck to continue."}</p>
  {conflicts.map(row=><div key={row.row} className="space-y-2"><strong>{ar?"الصف":"Row"} {row.row}</strong>{row.conflicts!.map(c=><div key={c.ref} className="flex flex-wrap items-center gap-2 rounded border bg-white p-2"><span className="flex-1">{c.name}</span><Button disabled={loading} variant="outline" onClick={()=>open(c.ref,"view")}>{ar?"عرض / دمج":"View / merge"}</Button><Button disabled={loading} variant="outline" aria-label={`${ar?"حذف المبدع القديم":"Delete existing creator"} ${c.name}`} title={ar?"حذف السجل القديم بعد التأكيد":"Delete the existing record after confirmation"} onClick={()=>open(c.ref,"delete")}>{ar?"حذف المبدع…":"Delete creator…"}</Button></div>)}</div>)}
  <Button disabled={loading} variant="outline" onClick={resolved}>{ar?"إعادة الفحص والمتابعة":"Recheck and continue"}</Button>
  {creator&&mode==="view"&&<Modal open title={creator.display_name} description={ar?"المبدع الموجود في المنصة":"Existing creator in Thinkway"} lang={lang} onClose={()=>setCreator(null)}>
   <CreatorAvatarImage avatarUrl={creatorProfileSourceFromUnified(creator).avatarUrl} profileUrl={creatorProfileSourceFromUnified(creator).profile_url}/>
   <p>{creator.unified_id}</p>{creator.platforms.map(p=><div key={p.id} className="flex gap-3"><strong>{p.platform}</strong><span>{p.handle}</span><span>{p.follower_count?.toLocaleString()} {ar?"متابع":"followers"}</span>{p.profile_url&&/^https?:\/\//.test(p.profile_url)&&<a href={p.profile_url} target="_blank" rel="noopener noreferrer">{ar?"عرض الحساب":"View profile"}</a>}</div>)}
   <p className="text-sm">{ar?"احتفظ بهذا المبدع واختر السجل القديم لنقل الأعمال والسجل التاريخي إليه. الحذف متاح فقط للسجلات غير المرتبطة.":"Keep this creator and select the old record to transfer its jobs and history here. Delete is available only for unlinked records."}</p>
   <Button onClick={()=>setMode("merge")}>{ar?"احتفاظ ودمج / استبدال":"Keep this creator · merge / replace"}</Button><Button variant="destructive" onClick={()=>setMode("delete")}>{ar?"حذف المبدع القديم":"Delete existing creator"}</Button>
  </Modal>}
  {creator&&mode==="merge"&&<CombineCreatorsDialog open targetCreator={creator} onOpenChange={open=>{if(!open)setCreator(null);}} onMerged={()=>{void resolved();}}/>}
  {creator&&mode==="delete"&&<DeleteDiscoveryCreatorDialog open creator={creator} onOpenChange={open=>{if(!open)setCreator(null);}} onDeleted={()=>{void resolved();}}/>}
 </section>;
}
