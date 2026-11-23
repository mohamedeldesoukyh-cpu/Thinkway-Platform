import {formatDocumentNumberForDisplay} from '@/lib/documents/format-document-number';
import type {AccountingSetup,FiscalYear} from './setup-types';
export function workingYear(setup:AccountingSetup,today:string):FiscalYear|undefined {
 return setup.years.find(y=>y.id===setup.workingYearId)??setup.years.find(y=>!y.closed&&y.start_date<=today&&y.end_date>=today)??[...setup.years].reverse().find(y=>!y.closed)??setup.years.at(-1);
}
export function yearDate(setup:AccountingSetup,today:string):string {const y=workingYear(setup,today);return !y?today:today<y.start_date?y.start_date:today>y.end_date?y.end_date:today;}
export function documentParts(value:string|null|undefined){const m=/^(JV|RV|PV|AL|IC|CI|RR|PR)-(\d{4})-(\d+)$/.exec(value??'');return m?{type:m[1],year:m[2],number:BigInt(m[3]).toString()}:{type:'',year:'',number:formatDocumentNumberForDisplay(value)};}
export function documentLabel(value:string|null|undefined){const p=documentParts(value);return p.year?`${p.type} ${p.number} · Year ${p.year}`:p.number;}
export function numberSearch(value:string){return /^\d+$/.test(value)?'%-'+BigInt(value).toString().padStart(6,'0'):null;}
