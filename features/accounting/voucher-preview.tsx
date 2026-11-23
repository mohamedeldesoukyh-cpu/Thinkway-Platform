import {reportAmount} from './report-number';
import {reportingAmount} from './journal-entry-display';
import {formattedReportHtml} from './formatted-report-model';
import { ReportPreviewDialog } from './formatted-report-preview';
// Inherits AccountingConsole's client boundary.
export type PrintVoucher={rates?:Record<string,string|null>;bank?:string;instrumentNumber?:string;maturity?:string;company:string;title:string;number:string;date:string;activationDate?:string;party?:string;reference:string;base:string;currency:string;amount:string;allocations?:{number:string;amount:string}[];lines:{account:string;description:string;currency:string;foreignDebit:string;foreignCredit:string;debit:string;credit:string}[]};
export function voucherReport(v:PrintVoucher):import('./formatted-report-model').FormattedReport {
 const currencies=[...new Set(v.lines.map(l=>l.currency))];
 const journals=currencies.map(currency=>{
  const equivalent=currency===v.base&&v.base!=='USD'?'USD':v.base;
  const showEquivalent=equivalent!==currency;
  const converted=(value:string)=>value==='0'||value==='0.00'?'0.00':reportingAmount({account:'',description:'',lineCurrency:v.base,debit:value,credit:'0'},equivalent,v.base,v.rates??{});
  return {orientation:'landscape' as const,heading:'Journal voucher · '+v.number+' · '+currency,columns:['Account','Description','Currency','Debit '+currency,'Credit '+currency,...(showEquivalent?['Debit '+equivalent,'Credit '+equivalent]:[])],rows:v.lines.filter(l=>l.currency===currency).map(l=>[l.account,l.description,l.currency,l.foreignDebit,l.foreignCredit,...(showEquivalent?(equivalent===v.base?[l.debit,l.credit]:[converted(l.debit),converted(l.credit)]):[])])};
 });
 const isJournal=/journal|expense/i.test(v.title);
 return {title:v.title,company:v.company,caption:v.number+' · Journal date: '+v.date+(v.activationDate?' · Activation date: '+v.activationDate:'')+' · '+v.reference+(currencies.includes(v.base)&&v.base!=='USD'?' · USD equivalent uses the system rate dated '+v.date:''),sections:isJournal?journals:[{orientation:'portrait',heading:v.title+' · '+reportAmount(v.amount)+' '+v.currency+' · '+(v.party??'')+(v.bank?' · Bank: '+v.bank:'')+(v.instrumentNumber?' · Chq/TRF: '+v.instrumentNumber:'')+(v.maturity?' · Maturity: '+v.maturity:''),columns:['Invoice / advance','Amount ('+v.currency+')'],rows:[...(v.allocations?.map(a=>[a.number,a.amount])??[['Voucher amount',v.amount]]),['Prepared by','________________'],['Approved / received by','________________']]},...journals]};
}
export function voucherHtml(v:PrintVoucher){return formattedReportHtml(voucherReport(v));}
export function VoucherPreviewDialog({value,onClose}:{value:PrintVoucher|null;onClose:()=>void}){return <ReportPreviewDialog report={value?voucherReport(value):null} onClose={onClose} title="Voucher & journal preview" description="JVs use landscape. Receipt and payment pages use portrait, followed by their linked JV in landscape. Each transaction currency is shown separately."/>;}
