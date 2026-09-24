"use client";
import {useTransition} from 'react';import {useRouter} from 'next/navigation';import {toast} from 'sonner';import {confirmCreatorInvoice} from '@/features/finance/vat/ledger-actions';
export function ConfirmCreatorInvoice({id}:{id:string}){const [pending,start]=useTransition();const router=useRouter();return <button disabled={pending} className="rounded border p-2" onClick={()=>start(async()=>{const r=await confirmCreatorInvoice(id);if(!r.ok)toast.error(r.error);else{toast.success('VAT confirmed');router.refresh();}})}>{pending?'Saving…':'Confirm VAT reviewed'}</button>;}
