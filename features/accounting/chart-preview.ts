import {partyCode} from './party-code';
import type {AccountingSetup} from './setup-types';
import type {FormattedReport} from './formatted-report-model';
export type ChartAuxiliary={account_code:string;number:number|string;name:string;active:boolean};
export function chartPreview(setup:AccountingSetup,codes:string[],auxiliaries:ChartAuxiliary[]|null):FormattedReport{
 const accounts=setup.accounts.filter(a=>codes.includes(a.code));
 const rows=accounts.flatMap(a=>[[a.code,a.name,a.kind,a.type,a.normal,a.active?'Active':'Inactive'],...(auxiliaries&&(a.hasAuxiliary||a.kind==='Control'||a.directorySource)?auxiliaries.filter(x=>x.account_code===(a.auxiliarySource||a.code)).map(x=>[a.code+' / '+partyCode(String(x.number)),x.name,'Auxiliary','','',x.active?'Active':'Inactive']):[])]);
 return {title:'Chart of Accounts',company:setup.company!.name,caption:auxiliaries?'Including auxiliaries':'Accounts only',sections:[{heading:'Chart of Accounts',columns:['Code','Name','Use','Type','Normal balance','Status'],rows}]};
}
