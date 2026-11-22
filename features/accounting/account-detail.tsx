// Inherits AccountingConsole's client boundary.
import { AuxiliaryLookup } from './auxiliaries';
import { PartySelect } from './allocation-controls';
import { partyDirectory } from './account-hierarchy';
import type { SavedAccount } from './setup-types';
import type { JournalLine } from './journal-model';

export function AccountDetail({company,account,line,onChange,disabled=false,required=true}:{company:string;account?:SavedAccount;line:JournalLine;onChange:(patch:Partial<JournalLine>)=>void;disabled?:boolean;required?:boolean}) {
 const kind=partyDirectory(account);
 if(kind)return <PartySelect fieldLabel="Auxiliary" company={company} kind={kind} value={(kind==='client'?line.clientId:line.vendorId)??''} label={line.partyLabel??undefined} disabled={disabled} required={required} onChange={(id,partyLabel)=>onChange({clientId:kind==='client'?id||null:null,vendorId:kind==='vendor'?id||null:null,auxiliaryId:null,partyLabel})}/>;
 if(account?.hasAuxiliary)return <AuxiliaryLookup company={company} account={account.code} value={line.auxiliaryId??''} required={required} disabled={disabled} onChange={auxiliaryId=>onChange({auxiliaryId:auxiliaryId||null,clientId:null,vendorId:null})}/>;
 return <input aria-label="Auxiliary" disabled value="" placeholder="Not applicable" style={{opacity:0.5}}/>;
}
