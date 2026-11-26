import { isValidClientIoEmail } from "./client-io-send-recipients";

export type RecipientSuggestion = { name: string; email: string };

export function uniqueRecipientSuggestions(rows: RecipientSuggestion[]): RecipientSuggestion[] {
  const byEmail = new Map<string, RecipientSuggestion>();
  for (const row of rows) {
    const email = row.email.trim();
    const name = row.name.trim();
    if (!isValidClientIoEmail(email)) continue;
    const key = email.toLowerCase();
    const previous = byEmail.get(key);
    if (!previous || (!previous.name && name)) byEmail.set(key, { name, email });
  }
  return [...byEmail.values()];
}
