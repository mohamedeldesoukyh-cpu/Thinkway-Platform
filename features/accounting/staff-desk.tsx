// Reuse the existing Employee directory and shared detail identities.
import {useState} from 'react';
import type {AccountingSetup,SavedAccount} from './setup-types';
import {AuxiliaryManager} from './auxiliaries';
import {CodeLookup} from './code-lookup';

export function StaffDesk({setup,onBusyChange,onOpenAccount}:{setup:AccountingSetup;onBusyChange:(busy:boolean)=>void;onOpenAccount:(account:SavedAccount)=>void}) {
 const sources=setup.accounts.filter(a=>a.active&&a.kind==='Control'&&a.subledger==='Employee'&&!a.auxiliarySource);
 const [code,setCode]=useState(sources.find(a=>a.hasAuxiliary)?.code??sources[0]?.code??'');
 const [busy,setBusy]=useState(false);
 const source=sources.find(a=>a.code===code);
 const linked=setup.accounts.filter(a=>a.code===code||a.auxiliarySource===code);
 return <section className="tw-ac-setup-panel"><h2>Third Parties · Staff</h2>
  <p>Create staff names in one shared directory. Configure staff costs, advances, salaries payable and other staff accounts with Third Parties · Staff, then select this directory as their shared source. Each account keeps its own balance; the same staff identity is retained across all linked accounts.</p>
  <label>Staff directory account<CodeLookup label="Staff directory account" value={code} onChange={setCode} disabled={busy} options={sources.map(a=>({code:a.code,name:a.name}))}/></label>
  {source?<>
   {setup.access.manage&&<button type="button" className="tw-ac-button" disabled={busy} onClick={()=>onOpenAccount(source)}>Configure staff directory</button>}
   {source.hasAuxiliary?<AuxiliaryManager key={`${source.code}:${source.version}`} company={setup.company!.id} account={source} manage={setup.access.manage} onBusyChange={value=>{setBusy(value);onBusyChange(value);}}/>:<p>Enable Own Auxiliary in this account’s setup to create the staff directory. Other staff accounts can share its list.</p>}
   <h3>Linked staff accounts</h3><div className="tw-ac-journal-table-scroll"><table className="tw-ac-journal-table"><thead><tr><th>Code</th><th>Account</th></tr></thead><tbody>{linked.map(a=><tr key={a.code}><td>{a.code}</td><td>{a.name}</td></tr>)}</tbody></table></div>
   <p>Use Auxiliary Statements with the staff member selected and no account filter to view the consolidated statement across linked staff accounts.</p>
  </>:<p>Create a GL account with the Third Parties · Staff directory in Chart of Accounts first.</p>}
 </section>;
}
