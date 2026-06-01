import type { ProfileEnrichmentPayload } from "@/lib/social/enrich-platform-account";

export type FetchProfileEnrichmentInput = {
  profile_url?: string;
  username?: string;
  platform?: string;
  influencer_id?: string;
  account_id?: string;
  skip_enrichment?: boolean;
};

export async function fetchProfileEnrichment(
  input: FetchProfileEnrichmentInput
): Promise<ProfileEnrichmentPayload & { error?: string }> {
  const response = await fetch("/api/vendors/platform-accounts/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as ProfileEnrichmentPayload & {
    error?: string;
    parsed?: ProfileEnrichmentPayload["parsed"];
  };

  if (!response.ok || !data.parsed) {
    return {
      parsed: null as unknown as ProfileEnrichmentPayload["parsed"],
      enrichment: null,
      duplicates: [],
      error: data.error ?? "Could not enrich this profile.",
    };
  }

  return data as ProfileEnrichmentPayload;
}
