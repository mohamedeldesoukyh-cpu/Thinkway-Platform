/** Opt-in only — repairs mutate billing state and block campaign page TTFB. */
export function isBillingRepairOnLoadEnabled(): boolean {
  return process.env.BILLING_REPAIR_ON_LOAD === "1";
}
