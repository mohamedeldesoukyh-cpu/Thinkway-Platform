import { cents, decimal, type JournalLine } from './journal-model';

export type EntryLine = JournalLine & { side?: 'D' | 'C'; autoBalance?: boolean };
export function entrySide(line: EntryLine): 'D' | 'C' {
  if (line.enteredSide) return line.enteredSide;
  if (line.side) return line.side;
  return Number(line.foreignCredit ?? line.credit) !== 0 ? 'C' : 'D';
}
export function entryAmount(line: EntryLine): string {
  if (line.enteredAmount != null) return line.enteredAmount;
  return entrySide(line) === 'D' ? line.foreignDebit ?? line.debit : line.foreignCredit ?? line.credit;
}
export function amountPatch(side: 'D' | 'C', amount: string) {
  let negative=false;try{negative=cents(amount)<BigInt(0);}catch{}
  const magnitude=negative?decimal(-cents(amount)):amount;const effective=negative?(side==='D'?'C':'D'):side;
  return { side, autoBalance:false, enteredAmount:negative?amount:null,enteredSide:negative?side:null, foreignDebit: effective === 'D' ? magnitude : '0', foreignCredit: effective === 'C' ? magnitude : '0' };
}
export function balancingSuggestion(lines: EntryLine[], index: number, base: string, rates: Record<string, string | null>): Partial<EntryLine> | null {
  const current = lines[index];
  if (index === 0 || current.side && !current.autoBalance) return null;
  try {
    if (!current.autoBalance && (cents(current.foreignDebit ?? current.debit) !== BigInt(0) || cents(current.foreignCredit ?? current.credit) !== BigInt(0))) return null;
    const others = lines.filter((_, i) => i !== index);
    const difference = others.reduce((sum, line) => sum + cents(line.debit) - cents(line.credit), BigInt(0));
    if (difference === BigInt(0)) return current.autoBalance ? {...amountPatch(entrySide(current),'0'),autoBalance:true} : null;
    const currency = current.lineCurrency || others.find(line => cents(line.debit) !== BigInt(0) || cents(line.credit) !== BigInt(0))?.lineCurrency || base;
    const magnitude = decimal(difference < BigInt(0) ? -difference : difference);
    const amount = reportingAmount({account:'',description:'',debit:magnitude,credit:'0',lineCurrency:base}, currency, base, rates);
    if (cents(amount) <= BigInt(0)) return null;
    return {...amountPatch(difference > BigInt(0) ? 'C' : 'D', amount), autoBalance:true, lineCurrency:currency};
  } catch { return null; }
}
/** Display-only reporting currency. Stored local debits and credits remain authoritative. */
export function reportingAmount(line: EntryLine, target: string, base: string, rates: Record<string, string | null>, source = base): string {
  try {
    if (target === (line.lineCurrency ?? source)) return decimal(cents(entryAmount(line)));
    const negative=line.enteredAmount!=null&&cents(line.enteredAmount)<BigInt(0);
    const effective=negative?(entrySide(line)==='D'?'C':'D'):entrySide(line);
    const local = decimal((negative?-BigInt(1):BigInt(1))*cents(effective === 'D' ? line.debit : line.credit));
    if (target === base) return decimal(cents(local));
    const rate = rates[target];
    if (!rate || !/^\d+(\.\d{1,8})?$/.test(rate)) return 'Rate required';
    const [whole, fraction = ''] = rate.split('.');
    const scaled = BigInt(whole) * BigInt(100000000) + BigInt(fraction.padEnd(8, '0'));
    if (scaled <= BigInt(0)) return 'Rate required';
    const amount = cents(local);
    const magnitude=amount<BigInt(0)?-amount:amount;return decimal(((magnitude * BigInt(100000000) + scaled / BigInt(2)) / scaled)*(amount<BigInt(0)?-BigInt(1):BigInt(1)));
  } catch { return 'Amount / rate required'; }
}
