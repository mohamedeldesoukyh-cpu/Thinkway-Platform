"use client";
import {useState,useTransition} from "react";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {cancelVendorIoAction} from "../cancel-vendor-io-action";
import type {VendorIoRow} from "../types";
export function VendorIoCancelTrigger({row, open: controlledOpen, onOpenChange}:{row:VendorIoRow; open?:boolean; onOpenChange?:(open:boolean)=>void}){
 const [localOpen,setLocalOpen]=useState(false),[reason,setReason]=useState(''); const open=controlledOpen ?? localOpen; const setOpen=onOpenChange ?? setLocalOpen;const [pending,start]=useTransition();const router=useRouter();
 if(row.status==='cancelled'||row.is_superseded)return null;
 return <>{controlledOpen === undefined ? <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50" onClick={()=>setOpen(true)}>Cancel IO</Button> : null}<Dialog open={open} onOpenChange={value=>{if(!pending)setOpen(value);}}><DialogContent><DialogHeader><DialogTitle>Cancel Vendor IO {row.document_number}</DialogTitle><DialogDescription>Cancel this IO for all its linked assignments and withdraw uninvoiced lines from billing. The issued document, serial number, approvals and signed files remain in history. Invoice, payment or published-work records block cancellation. The creator remains in the campaign; use Remove from campaign to cancel the assignment too.</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">Confirm that cancellation has been agreed where required. This records the cancellation in Thinkway; it does not notify the creator.</p><Label htmlFor="io-cancel-reason">Cancellation reason</Label><Textarea id="io-cancel-reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} disabled={pending}/><DialogFooter><Button variant="outline" disabled={pending} onClick={()=>setOpen(false)}>Keep IO</Button><Button variant="destructive" disabled={pending||reason.trim().length<3} onClick={()=>start(async()=>{try{const r=await cancelVendorIoAction({campaignId:row.campaign_header_id,ioId:row.id,reason});if(!r.ok){toast.error(r.message);return;}toast.success(r.message);setOpen(false);setReason('');router.refresh();}catch{toast.error('Could not cancel the IO. Your reason has been kept.');}})}>{pending?'Cancelling…':'Confirm cancellation'}</Button></DialogFooter></DialogContent></Dialog></>;
}
