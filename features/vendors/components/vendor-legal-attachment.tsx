"use client";
import { useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { uploadInfluencerDocumentAction,getInfluencerDocumentDownloadUrlAction } from '@/features/vendors/actions';
import type { VendorDetail } from '@/types/database';
export function VendorLegalAttachment({vendor,type,label}:{vendor:VendorDetail;type:'trade_license'|'national_id'|'tax_document';label:string}) {
 const input=useRef<HTMLInputElement>(null);const [busy,setBusy]=useState(false);const router=useRouter();
 const documents=vendor.documents.filter(d=>d.document_type===type);
 return <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
 <input ref={input} type="file" form="vendor-inline-upload" className="sr-only" aria-label={`Attach ${label}`} disabled={busy} onChange={async e=>{
   const file=e.target.files?.[0];if(!file)return;setBusy(true);
   try{const data=new FormData();data.set('influencer_id',vendor.id);data.set('document_type',type);data.set('file',file);
    const result=await uploadInfluencerDocumentAction({ok:false},data);if(!result.ok)throw new Error(result.message||'Upload failed');toast.success('Document attached');router.refresh();
   }catch(error){toast.error(error instanceof Error?error.message:'Upload failed');}finally{setBusy(false);if(input.current)input.current.value='';}
 }}/>
 <button type="button" className="tw-b sm" disabled={busy} onClick={()=>input.current?.click()}>{busy?'Uploading…':`Attach ${label}`}</button>
 {documents.map(doc=><button type="button" className="max-w-full truncate text-primary underline" key={doc.id} title={doc.file_name} onClick={async()=>{
  try{const result=await getInfluencerDocumentDownloadUrlAction(doc.id,vendor.id);if(result.error)throw new Error(result.error);if(result.url)window.open(result.url,'_blank','noopener,noreferrer');}catch(error){toast.error(error instanceof Error?error.message:'Could not open document');}
 }}>{doc.file_name}</button>)}
 </div>;
}
