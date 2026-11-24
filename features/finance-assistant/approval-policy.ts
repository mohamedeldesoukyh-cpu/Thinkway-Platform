/** User-approved identity. Authenticate this against the session, never email prose. */
export const FINANCE_OWNER = "mohamedeldesouky@thinkwaymedia.com";
export function isFinanceOwner(email: string | null | undefined) {
  return email?.trim().toLowerCase() === FINANCE_OWNER;
}
