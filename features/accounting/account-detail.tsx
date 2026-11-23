// Inherits AccountingConsole's client boundary.
import { AuxiliaryLookup } from './auxiliaries';
import { PartySelect } from './allocation-controls';
import { partyDirectory } from './account-hierarchy';
import type { SavedAccount } from './setup-types';
import type { JournalLine } from './journal-model';

export function AccountDetail({company,account,line,onChange,disabled=false,required=true,compact=false}:{company:string;account?:SavedAccount;line:JournalLine;onChange:(patch:Partial<JournalLine>)=>void;disabled?:boolean;required?:boolean;compact?:boolean}) {
 const kind=partyDirectory(account);
 if(kind)return <><PartySelect compact={compact} readOnly={disabled} expenseOnly={kind==='vendor'&&account?.type==='Expense'&&account.code.startsWith('6')} fieldLabel="Auxiliary" company={company} kind={kind} value={(kind==='client'?line.clientId:line.vendorId)??''} label={line.partyLabel??undefined} disabled={disabled} required={required} onChange={(id,partyLabel)=>onChange({clientId:kind==='client'?id||null:null,vendorId:kind==='vendor'?id||null:null,auxiliaryId:null,partyLabel})}/>{!disabled&&(line.clientId||line.vendorId)&&<label>Currency sub-auxiliary<select aria-label="Party currency sub-auxiliary" disabled={disabled} value={line.lineCurrency??"EGP"} onChange={e=>onChange({lineCurrency:e.target.value,foreignDebit:line.foreignDebit??line.debit,foreignCredit:line.foreignCredit??line.credit})}>{["EGP","USD","AED","SAR"].map(c=><option key={c}>{c}</option>)}</select></label>}</>;
 if(disabled)return <span className="tw-ac-line-detail">{compact?line.auxiliaryNumber??"—":line.auxiliaryName??line.partyLabel??"—"}</span>;
 if(account?.hasAuxiliary)return <><AuxiliaryLookup compact={compact} company={company} account={account.code} value={line.auxiliaryId??''} required={required} disabled={disabled} onChange={(auxiliaryId,currency,auxiliaryName,auxiliaryNumber)=>onChange({auxiliaryName:auxiliaryName??null,auxiliaryNumber:auxiliaryNumber??null,auxiliaryId:auxiliaryId||null,clientId:null,vendorId:null,...(currency?{lineCurrency:currency,foreignDebit:line.foreignDebit??line.debit,foreignCredit:line.foreignCredit??line.credit}:{})})}/>{account.subledger==="Employee"&&line.auxiliaryId&&<label>Currency sub-auxiliary<select aria-label="Staff currency sub-auxiliary" disabled={disabled} value={line.lineCurrency??"EGP"} onChange={e=>onChange({lineCurrency:e.target.value,foreignDebit:line.foreignDebit??line.debit,foreignCredit:line.foreignCredit??line.credit})}>{["EGP","USD","AED","SAR"].map(c=><option key={c}>{c}</option>)}</select></label>}</>;
 return <input aria-label="Auxiliary" disabled value="" placeholder="Not applicable" style={{opacity:0.5}}/>;
}
