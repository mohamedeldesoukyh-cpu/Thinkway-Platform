import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { StatementDesk } from './statement-desk';
import type { AccountingSetup } from './setup-types';
import type { MiniStatementSelection } from './mini-statement-model';
export type { MiniStatementSelection } from './mini-statement-model';
export function MiniStatement({setup,value,onClose}:{setup:AccountingSetup;value:MiniStatementSelection|null;onClose:()=>void}){return <Dialog open={!!value} onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="tw-accounting tw-ac-edit-dialog" style={{maxWidth:'1100px',maxHeight:'85vh',overflowY:'auto'}} onKeyDown={event=>event.stopPropagation()}><DialogHeader><DialogTitle>Mini statement · {value?.account}</DialogTitle><DialogDescription>Posted balances for the selected account and auxiliary or Third Party. Your unsaved voucher is retained.</DialogDescription></DialogHeader>{value&&<StatementDesk key={JSON.stringify(value)} setup={setup} preset={value.kind==='client'?'client':value.kind==='vendor'?'vendor':value.auxiliary?'auxiliary':'account'} initialSelection={value} onBusyChange={()=>{}}/>}</DialogContent></Dialog>;}
