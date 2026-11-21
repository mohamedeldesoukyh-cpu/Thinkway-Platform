export function cents(value:string):bigint {
 if(!/^-?\d+(\.\d{1,2})?$/.test(value))throw new Error('Invalid monetary amount');
 const negative=value.startsWith('-');const [whole,fraction='']=value.replace('-','').split('.');
 return (BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,'0')))*(negative?-BigInt(1):BigInt(1));
}
export function decimal(value:bigint):string {const v=value<BigInt(0)?-value:value;return `${value<BigInt(0)?'-':''}${v/BigInt(100)}.${String(v%BigInt(100)).padStart(2,'0')}`;}
export function money(value:string|bigint):string {const s=typeof value==='bigint'?decimal(value):decimal(cents(value));const [whole,fraction]=s.split('.');return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')}.${fraction}`;}
export function totals(lines:{debit:string;credit:string}[]) {let debit=BigInt(0),credit=BigInt(0);for(const l of lines){debit+=cents(l.debit||'0');credit+=cents(l.credit||'0');}return {debit,credit,difference:debit-credit};}
export type JournalLine={account:string;description:string;debit:string;credit:string;name?:string;foreignDebit?:string|null;foreignCredit?:string|null};
export type Journal={source_invoice_id?:string|null;transaction_currency?:string|null;exchange_rate?:string|null;exchange_rate_date?:string|null;unpost_reason?:string|null;id:string;company_id:string;entry_date:string;reference:string;memo:string;status:'draft'|'posted'|'cancelled'|'pending';voucher_number:string|null;version:number;reversal_of:string|null;created_at:string;posted_at:string|null;reversal_reason:string|null};
export type JournalDetail={journal:Journal;lines:JournalLine[];reversal:Journal|null};
export type TrialRow={code:string;name:string;type:string;active:boolean;opening:string;debit:string;credit:string;closing:string};
export type LedgerRow={id:string;date:string;number:string;memo:string;reference:string;line:number;description:string;debit:string;credit:string;balance:string;reversalOf:string|null};
export type LedgerReport={opening:string;debit:string;credit:string;closing:string;count:number;rows:LedgerRow[]};
export function reportCsv(rows:string[][]):string {return '\uFEFF'+rows.map(row=>row.map(value=>`"${(/^[\s]*[=+@-]/.test(value)?"'":'')+value.replaceAll('"','""')}"`).join(',')).join('\r\n');}
