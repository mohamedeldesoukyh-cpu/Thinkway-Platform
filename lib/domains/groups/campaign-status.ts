/** Shared group/campaign status helpers. */

export function isCancelledCampaignStatus(status: string): boolean {
  return status === "cancelled";
}
