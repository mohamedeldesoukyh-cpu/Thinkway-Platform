import {cents,decimal} from './journal-model';
export type Bank={id:string;name:string;account_code:string;auxiliary_id:string|null;currency:string;bank_reference:string;active:boolean;version:number};
export type BankRow={id:string;row_number:number;entry_date:string;reference:string;description:string;amount:string;match_id:string|null};
export type BankStatement={id:string;bank_id:string;reference:string;from_date:string;to_date:string;opening:string;closing:string;status:'open'|'closed'|'void';version:number};
export type BankLine={journal:string;line:number;date:string;number:string;description:string;amount:string;debit:string;credit:string;matched:string|null;cleared_date:string|null};
export type BankReport={bank:Bank;statement:BankStatement|null;rows:BankRow[];ledger:BankLine[];matches:{id:string;reason:string;created_at:string}[];balance:string;outstanding:string;count:number};
export type ImportRow={date:string;reference:string;description:string;amount:string};
/** Strict portable CSV format; quoted commas/newlines and escaped quotes are supported. */
export function parseBankCsv(input:string):ImportRow[]{
 if(input.length>2_000_000)throw new Error('Use a CSV smaller than 2 MB');
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 const source=input.replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
  if(closed&&ch!==','&&ch!=='\r'&&ch!=='\n')throw new Error('Unexpected text after a quoted CSV field');
  if(ch==='"'){if(field)throw new Error('Quote must start a CSV field');quoted=true;}
  else if(ch===','){row.push(field);field='';closed=false;}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&source[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';closed=false;}
  else field+=ch;
 }
 if(quoted)throw new Error('Unclosed CSV quote');row.push(field);if(row.some(v=>v.trim()))rows.push(row);
 const header=rows.shift()?.map(v=>v.trim().toLowerCase());
 if(header?.join(',')!=='date,reference,description,amount')throw new Error('Use columns: date,reference,description,amount');
 if(!rows.length||rows.length>2000)throw new Error('Import 1–2000 rows per statement');
 return rows.map((r,index)=>{const [date,reference,description,raw]=r.map(v=>v.trim());
  if(r.length!==4||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error(`Check the date on row ${index+2}`);
  if(!/^-?\d{1,12}(\.\d{1,2})?$/.test(raw)||cents(raw)===BigInt(0))throw new Error(`Use a nonzero signed amount on row ${index+2}; no thousands separators`);
  if(reference.length>120||description.length>500)throw new Error(`Reference or description too long on row ${index+2}`);
  return {date,reference,description,amount:decimal(cents(raw))};
 });
}
export function bankSelectionTotal(amounts:string[]){return decimal(amounts.reduce((n,a)=>n+cents(a),BigInt(0)));}
