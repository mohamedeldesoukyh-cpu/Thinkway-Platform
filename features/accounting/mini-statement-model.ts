import type { JournalLine } from './journal-model';

export type MiniStatementSelection = {account:string;auxiliary?:string;kind?:'all'|'client'|'vendor';party?:string};

export function lineStatementSelection(
 line: Pick<JournalLine,'account'|'auxiliaryId'|'clientId'|'vendorId'>,
 account?: {clientId?:string|null;vendorId?:string|null},
): MiniStatementSelection | null {
 if (!line.account) return null;
 const client = line.clientId || account?.clientId;
 const vendor = line.vendorId || account?.vendorId;
 return {account:line.account,auxiliary:line.auxiliaryId || '',kind:client?'client':vendor?'vendor':'all',party:client || vendor || ''};
}
