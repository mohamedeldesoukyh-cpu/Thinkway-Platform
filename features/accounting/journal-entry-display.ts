import { cents, decimal, type JournalLine } from './journal-model';

export type EntryLine = JournalLine & { side?: 'D' | 'C' };
export function entrySide(line: EntryLine): 'D' | 'C' {
  if (line.side) return line.side;
  return Number(line.foreignCredit ?? line.credit) !== 0 ? 'C' : 'D';
}
export function entryAmount(line: EntryLine): string {
  return entrySide(line) === 'D' ? line.foreignDebit ?? line.debit : line.foreignCredit ?? line.credit;
}
export function amountPatch(side: 'D' | 'C', amount: string) {
  return { side, foreignDebit: side === 'D' ? amount : '0', foreignCredit: side === 'C' ? amount : '0' };
}
export function balancingSuggestion(lines: EntryLine[], index: number, base: string, rates: Record<string, string | null>): Partial<EntryLine> | null {
  const current = lines[index];
  if (index === 0 || current.side) return null;
  try {
    if (cents(current.foreignDebit ?? current.debit) !== BigInt(0) || cents(current.foreignCredit ?? current.credit) !== BigInt(0)) return null;
    const others = lines.filter((_, i) => i !== index);
    const difference = others.reduce((sum, line) => sum + cents(line.debit) - cents(line.credit), BigInt(0));
    if (difference === BigInt(0)) return null;
    const currency = current.lineCurrency || others.find(line => cents(line.debit) !== BigInt(0) || cents(line.credit) !== BigInt(0))?.lineCurrency || base;
    const magnitude = decimal(difference < BigInt(0) ? -difference : difference);
    const amount = reportingAmount({account:'',description:'',debit:magnitude,credit:'0',lineCurrency:base}, currency, base, rates);
    if (cents(amount) <= BigInt(0)) return null;
    return {...amountPatch(difference > BigInt(0) ? 'C' : 'D', amount), lineCurrency:currency};
  } catch { return null; }
}
/** Display-only reporting currency. Stored local debits and credits remain authoritative. */
export function reportingAmount(line: EntryLine, target: string, base: string, rates: Record<string, string | null>, source = base): string {
  try {
    if (target === (line.lineCurrency ?? source)) return decimal(cents(entryAmount(line)));
    const local = entrySide(line) === 'D' ? line.debit : line.credit;
    if (target === base) return decimal(cents(local));
    const rate = rates[target];
    if (!rate || !/^\d+(\.\d{1,8})?$/.test(rate)) return 'Rate required';
    const [whole, fraction = ''] = rate.split('.');
    const scaled = BigInt(whole) * BigInt(100000000) + BigInt(fraction.padEnd(8, '0'));
    if (scaled <= BigInt(0)) return 'Rate required';
    const amount = cents(local);
    return decimal((amount * BigInt(100000000) + scaled / BigInt(2)) / scaled);
  } catch { return 'Amount / rate required'; }
}
