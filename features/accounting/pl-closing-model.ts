import {cents,decimal,type JournalLine} from './journal-model';
export type ClosingBalance={account:string;name:string;auxiliary:string|null;client?:string|null;vendor?:string|null;client_code?:string|null;vendor_code?:string|null;balance:string};
export type ClosingDraft={date:string;memo:string;reference:string;lines:JournalLine[];workflow?:'general'|'closing';sourceFile?:File};
export function closingDraft(rows:ClosingBalance[],selected:string[],destination:string,year:string,date:string,base:string):ClosingDraft {
 const grouped=new Map<string,{row:ClosingBalance;balance:bigint}>();
 for(const row of rows){if(!selected.includes(row.account))continue;const key=JSON.stringify([row.account,row.auxiliary,row.client,row.vendor]);const previous=grouped.get(key);grouped.set(key,{row,balance:(previous?.balance??BigInt(0))+cents(row.balance)});}
 const memo='Closing TRX — '+year;const lines:JournalLine[]=[];let net=BigInt(0);
 for(const {row,balance} of grouped.values()){if(!balance)continue;net-=balance;const debit=decimal(balance<BigInt(0)?-balance:BigInt(0)),credit=decimal(balance>BigInt(0)?balance:BigInt(0));lines.push({account:row.account,description:memo,auxiliaryId:row.auxiliary,clientId:row.client,vendorId:row.vendor,partyLabel:row.client_code??row.vendor_code,lineCurrency:base,lineRate:'1',debit,credit,foreignDebit:debit,foreignCredit:credit});}
 if(net){const debit=decimal(net<BigInt(0)?-net:BigInt(0)),credit=decimal(net>BigInt(0)?net:BigInt(0));lines.push({account:destination,description:memo,lineCurrency:base,lineRate:'1',debit,credit,foreignDebit:debit,foreignCredit:credit});}
 if(lines.length<2)throw Error('Select accounts with remaining balances to create a balanced JV.');
 if(lines.length>200)throw Error('The selection exceeds the 200-line JV limit. Reduce the selected accounts before continuing.');
 return {date,memo,reference:'PL-CLOSE-'+year,lines};
}
