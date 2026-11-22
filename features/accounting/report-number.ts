import {money} from './journal-model';
/** Use the ledger formatter, preserving non-numeric cells such as signatures. */
export function reportAmount(value: string): string {
  const raw = value.replaceAll(',', '').replace('−', '-');
  return /^-?\d+(?:\.\d{1,2})?$/.test(raw) ? money(raw) : value;
}
export const isReportAmount = (label: string) => /amount|balance|opening|debit|credit|closing|income|expense|variance|actual|budget|outstanding|settled|movement|total/i.test(label) && !/account|description|name|date|code/i.test(label);
