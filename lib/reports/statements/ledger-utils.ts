import { roundMoney } from "@/lib/analytics/aggregations/round";

import type { StatementLedgerLine, StatementLedgerLineKind } from "./statement-types";

export type RawLedgerLine = Omit<StatementLedgerLine, "balance">;

const KIND_SORT_ORDER: Record<StatementLedgerLineKind, number> = {
  invoice: 0,
  vendor_io: 0,
  payment: 1,
  vendor_payment: 1,
};

export function sortLedgerLines(lines: RawLedgerLine[]): RawLedgerLine[] {
  return [...lines].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    const kindCompare = KIND_SORT_ORDER[a.kind] - KIND_SORT_ORDER[b.kind];
    if (kindCompare !== 0) return kindCompare;
    return a.document_number.localeCompare(b.document_number);
  });
}

/** AR: debit increases balance; AP: credit increases balance. */
export function applyRunningBalance(
  lines: RawLedgerLine[],
  mode: "ar" | "ap"
): StatementLedgerLine[] {
  let balance = 0;
  return lines.map((line) => {
    balance =
      mode === "ar"
        ? balance + line.debit - line.credit
        : balance + line.credit - line.debit;
    return {
      ...line,
      balance: roundMoney(balance),
    };
  });
}

export function filterLinesByDateRange(
  lines: RawLedgerLine[],
  fromDate: string | null,
  toDate: string | null
): RawLedgerLine[] {
  return lines.filter((line) => {
    if (fromDate && line.date < fromDate) return false;
    if (toDate && line.date > toDate) return false;
    return true;
  });
}

export function summarizeLedger(lines: StatementLedgerLine[]): {
  total_debit: number;
  total_credit: number;
  closing_balance: number;
} {
  const total_debit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
  const total_credit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));
  const closing_balance = lines.length > 0 ? lines[lines.length - 1]!.balance : 0;
  return { total_debit, total_credit, closing_balance };
}
