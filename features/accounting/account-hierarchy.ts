import type { SavedAccount } from './setup-types';
import type { JournalLine } from './journal-model';

// Group headings and old directory-generated party aliases are not transaction GLs.
export function isLedgerAccount(account: SavedAccount): boolean {
  return account.kind !== 'Group' && !account.clientId && !account.vendorId;
}
export function partyDirectory(account?: SavedAccount): 'client' | 'vendor' | null {
  if (account?.kind !== 'Control') return null;
  return account.subledger === 'Customer' ? 'client' : account.subledger === 'Supplier / creator' ? 'vendor' : null;
}
export function lineDetailComplete(account: SavedAccount | undefined, line: JournalLine): boolean {
  if (!account || !isLedgerAccount(account)) return false;
  const directory = partyDirectory(account);
  return directory === 'client' ? !!line.clientId : directory === 'vendor' ? !!line.vendorId : !account.hasAuxiliary || !!line.auxiliaryId;
}
