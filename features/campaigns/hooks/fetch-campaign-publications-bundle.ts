import type { CampaignPublicationsBundleResult } from "@/lib/campaigns/publications-bundle-loader";

export async function fetchCampaignPublicationsBundle(
  campaignId: string
): Promise<CampaignPublicationsBundleResult> {
  try {
    const response = await fetch(`/api/campaigns/${campaignId}/publications-bundle`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });

    const body = (await response.json()) as CampaignPublicationsBundleResult;
    if (!response.ok && body.ok === false) {
      return body;
    }
    if (!response.ok) {
      return {
        ok: false,
        error: `Failed to load publications (${response.status}).`,
      };
    }
    return body;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load publications.",
    };
  }
}
