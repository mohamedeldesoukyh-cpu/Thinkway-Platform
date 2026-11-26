"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useWorkspaceUndo } from '@/lib/productivity/workspace-undo';
import { updateVendorOverviewAction, updateVendorLegalAction, updateVendorCommercialCrmAction, updateVendorFinanceAction, updateVendorBankDetailsAction, savePlatformAccountsAction } from '@/features/vendors/actions';

const actions = {
  'vendor-overview-form': updateVendorOverviewAction,
  'vendor-legal-form': updateVendorLegalAction,
  'vendor-commercial-form': updateVendorCommercialCrmAction,
  'vendor-finance-form': updateVendorFinanceAction,
  'vendor-bank-details-form': updateVendorBankDetailsAction,
  'platform-accounts-form': savePlatformAccountsAction,
};
type Section = { dirty: boolean; save: () => Promise<boolean>; discard?:()=>void };
type Session = { editing: boolean; saving: boolean; start: () => void; discard: () => void; save: () => Promise<void>; register: (key:string, section:Section) => () => void };
const Context = createContext<Session|null>(null);
export const useVendorEditSession = () => useContext(Context);

function serialize(form:HTMLFormElement) {
  return JSON.stringify([...new FormData(form)].filter(([,v])=>typeof v==='string'));
}

export function VendorEditSession({children,revision}:{children:ReactNode;revision?:string}) {
  const router=useRouter(); const history=useWorkspaceUndo();
  const [editing,setEditing]=useState(false); const [saving,setSaving]=useState(false); const [version,setVersion]=useState(0);
  const root=useRef<HTMLDivElement>(null); const baseline=useRef(new Map<string,string>()); const sections=useRef(new Map<string,Section>()); const busy=useRef(false);
  const inputValues=useRef(new WeakMap<HTMLInputElement|HTMLTextAreaElement,string>());
  const register=(key:string,section:Section)=>{sections.current.set(key,section);return ()=>{sections.current.delete(key);};};
  function discard(){if(busy.current)return;for(const section of sections.current.values())section.discard?.();history?.clear();setEditing(false);setVersion(v=>v+1);baseline.current.clear();}
  function start(){history?.clear();setEditing(true);requestAnimationFrame(()=>{for(const id of Object.keys(actions)){const form=root.current?.querySelector<HTMLFormElement>(`#${id}`);if(form)baseline.current.set(id,serialize(form));}});}
  async function save(){
    if(!editing||busy.current)return;
    const changed=Object.entries(actions).flatMap(([id,action])=>{const form=root.current?.querySelector<HTMLFormElement>(`#${id}`);return form&&serialize(form)!==baseline.current.get(id)?[{id,form,action,data:new FormData(form)}]:[];});
    for(const item of changed){if(!item.form.checkValidity()){item.form.reportValidity();toast.error('Please complete the highlighted fields before saving.');return;}}
    const extraSections=[...sections.current.values()];
    busy.current=true;setSaving(true);
    try {
      for(const item of changed){const result=await item.action({ok:false},item.data);if(!result.ok)throw new Error(result.message||'Could not save creator details.');baseline.current.set(item.id,JSON.stringify([...item.data].filter(([,v])=>typeof v==='string')));}
      for(const section of extraSections){if(section.dirty&&!await section.save())throw new Error('Some payment details could not be saved. Your remaining edits are still open.');}
      toast.success('All creator changes saved');history?.clear();setEditing(false);router.refresh();
    }catch(error){toast.error(error instanceof Error?error.message:'Save failed. Your edits are still open.');}
    finally{busy.current=false;setSaving(false);}
  }
  const [visibleRevision,setVisibleRevision]=useState(revision);
  if(!editing&&!saving&&visibleRevision!==revision)setVisibleRevision(revision);
  useEffect(()=>{
    if(!editing||!root.current)return;
    const captureNewForms=()=>{for(const id of Object.keys(actions)){const form=root.current?.querySelector<HTMLFormElement>('#'+id);if(form&&!baseline.current.has(id))baseline.current.set(id,serialize(form));}};
    const observer=new MutationObserver(captureNewForms);observer.observe(root.current,{subtree:true,childList:true});return()=>observer.disconnect();
  },[editing]);
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();event.stopImmediatePropagation();void save();}};window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true);});
  return <Context.Provider value={{editing,saving,start,discard,save,register}}><div ref={root} key={`${version}:${visibleRevision??""}`} className="flex min-h-0 flex-1 flex-col" data-vendor-editing={editing} onFocusCapture={event=>{const field=event.target;if(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)inputValues.current.set(field,field.value);}} onInputCapture={event=>{
    const field=event.target;if(!editing||!(field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)||!field.name||['hidden','checkbox','radio'].includes(field.type)||['trade_license','national_id_number','base_rate','preferred_currency','negotiation_notes','commercial_notes'].includes(field.name))return;
    const before=inputValues.current.get(field)??field.defaultValue;const after=field.value;inputValues.current.set(field,after);if(before===after)return;
    const apply=(value:string)=>{field.value=value;inputValues.current.set(field,value);};
    history?.record({owner:field.form?.id+':'+field.name,label:field.name,undo:()=>apply(before),redo:()=>apply(after),available:()=>field.isConnected&&!field.disabled});
  }} onSubmitCapture={event=>{if(event.target instanceof HTMLFormElement&&event.target.id in actions){event.preventDefault();event.stopPropagation();void save();}}}>{children}</div></Context.Provider>;
}
