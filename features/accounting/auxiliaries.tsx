// Inherits AccountingConsole's client boundary.
import { useEffect,useState } from 'react';
import { accountingRead,accountingWrite,PartySelect } from './allocation-controls';
import { CodeLookup } from './code-lookup';
import type { SavedAccount } from './setup-types';
export type Auxiliary={id:string;number:number;name:string;active:boolean;version:number;client_id:string|null;vendor_id:string|null};
export function AuxiliaryFields({company,accounts,codes,value,onChange}:{company:string;accounts:SavedAccount[];codes:string[];value:Record<string,string>;onChange:(value:Record<string,string>)=>void}){return <>{[...new Set(codes)].map(code=>{const a=accounts.find(a=>a.code===code);return a?.hasAuxiliary&&a.kind==='Posting'?<label key={code}>{a.name} auxiliary<AuxiliaryLookup company={company} account={code} value={value[code]??''} onChange={id=>onChange({...value,[code]:id})}/></label>:null;})}</>;}
export function AuxiliaryLookup({company,account,value,onChange,disabled=false}:{company:string;account:string;value:string;onChange:(id:string)=>void;disabled?:boolean}){
 const [rows,setRows]=useState<Auxiliary[]>([]),[typed,setTyped]=useState(''),[error,setError]=useState('');
 useEffect(()=>{const a=new AbortController();void accountingRead({mode:'auxiliaries',company,account},a.signal).then(setRows).catch(e=>{if(!a.signal.aborted)setError(e.message);});return()=>a.abort();},[company,account]);
 const current=rows.find(r=>r.id===value);
 return <><CodeLookup label={`Auxiliary for ${account}`} value={current?String(current.number):typed} options={rows.filter(r=>r.active||r.id===value).map(r=>({code:String(r.number),name:r.name}))} disabled={disabled} onChange={code=>{setTyped(code);onChange(rows.find(r=>String(r.number)===code)?.id??'');}}/>{error&&<small role="alert">{error}</small>}</>;
}
export function AuxiliaryManager({company,account,manage}:{company:string;account:SavedAccount;manage:boolean}){
 const [rows,setRows]=useState<Auxiliary[]>([]),[epoch,setEpoch]=useState(0),[name,setName]=useState(''),[party,setParty]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const kind=account.kind==='Control'&&account.subledger==='Customer'?'client':account.kind==='Control'&&account.subledger==='Supplier / creator'?'vendor':null;
 useEffect(()=>{const a=new AbortController();void accountingRead({mode:'auxiliaries',company,account:account.code},a.signal).then(setRows).catch(e=>{if(!a.signal.aborted)setError(e.message);});return()=>a.abort();},[company,account.code,epoch]);
 async function save(row?:Auxiliary){setBusy(true);setError('');try{await accountingWrite('auxiliary-save',{company,account:account.code,id:row?.id??null,version:row?.version??null,name:row?.name??name,active:row?!row.active:true,client:kind==='client'?party||null:null,vendor:kind==='vendor'?party||null:null});setName('');setParty('');setEpoch(e=>e+1);}catch(e){setError(e instanceof Error?e.message:'Could not save auxiliary');}finally{setBusy(false);}}
 return <div className="tw-ac-span"><h3>Auxiliaries · {account.code}</h3><p>Numbers start at 1 for this account and are never reused. Client/vendor links retain their original Thinkway codes.</p>{error&&<p role="alert" className="tw-ac-error">{error}</p>}
 <div className="tw-ac-journal-table-scroll"><table className="tw-ac-journal-table"><thead><tr><th>Auxiliary</th><th>Name</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.number}</td><td>{r.name}</td><td>{r.active?'Active':'Inactive'}</td><td>{manage&&<button type="button" className="tw-ac-text-button" disabled={busy} onClick={()=>void save(r)}>{r.active?'Deactivate':'Activate'}</button>}</td></tr>)}</tbody></table></div>
 {manage&&<><label>New auxiliary name<input value={name} disabled={busy||!!kind} onChange={e=>setName(e.target.value)} maxLength={150}/></label>{kind&&<PartySelect company={company} kind={kind} value={party} disabled={busy} onChange={setParty}/>}<button type="button" className="tw-ac-button" disabled={busy||(kind?!party:!name.trim())} onClick={()=>void save()}>Add auxiliary · next number</button></>}
 </div>;
}
