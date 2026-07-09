import type { SupabaseClient } from "@supabase/supabase-js";

import { getCampaignsList } from "@/lib/services/campaigns/campaign-service";
import { normalizeCampaignDocumentNumber } from "@/lib/intelligence/entity-resolution/normalize";
import { bestFuzzyMatch } from "@/lib/intelligence/entity-resolution/fuzzy";

export type CampaignResolveResult = {
  id: string;
  name: string;
  documentNumber: string;
  confidence: number;
};

export type CampaignResolveOutput = {
  resolved: CampaignResolveResult | null;
  candidates: CampaignResolveResult[];
  needsDisambiguation: boolean;
};

/**
 * Search campaigns by name or document number using existing campaign services.
 * Prefers document number exact match, then name ILIKE, then fuzzy match.
 */
export async function resolveCampaignByQuery(
  supabase: SupabaseClient,
  query: string,
  options?: { limit?: number }
): Promise<CampaignResolveOutput> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { resolved: null, candidates: [], needsDisambiguation: false };
  }

  const limit = options?.limit ?? 5;
  const candidates: CampaignResolveResult[] = [];

  const docNumber = normalizeCampaignDocumentNumber(trimmed);
  if (docNumber) {
    const { campaigns } = await getCampaignsList(supabase, {
      search: docNumber,
      page: 1,
    });
    const exactDoc = campaigns.find(
      (c) => c.document_number?.toUpperCase() === docNumber.toUpperCase()
    );
    if (exactDoc) {
      const result: CampaignResolveResult = {
        id: exactDoc.id,
        name: exactDoc.name,
        documentNumber: exactDoc.document_number ?? docNumber,
        confidence: 1.0,
      };
      return { resolved: result, candidates: [result], needsDisambiguation: false };
    }
  }

  const { campaigns } = await getCampaignsList(supabase, {
    search: trimmed,
    page: 1,
  });

  for (const campaign of campaigns.slice(0, limit)) {
    const nameLower = campaign.name.toLowerCase();
    const queryLower = trimmed.toLowerCase();
    let confidence = 0.7;

    if (nameLower === queryLower) {
      confidence = 1.0;
    } else if (nameLower.includes(queryLower) || queryLower.includes(nameLower)) {
      confidence = 0.85;
    }

    candidates.push({
      id: campaign.id,
      name: campaign.name,
      documentNumber: campaign.document_number ?? "",
      confidence,
    });
  }

  if (candidates.length === 0) {
    const fuzzyHeaders = campaigns.map((c) => ({
      id: c.id,
      label: c.name,
      documentNumber: c.document_number ?? "",
    }));

    const fuzzy = bestFuzzyMatch(trimmed, fuzzyHeaders, 0.75);
    if (fuzzy) {
      const match = campaigns.find((c) => c.id === fuzzy.id);
      if (match) {
        candidates.push({
          id: match.id,
          name: match.name,
          documentNumber: match.document_number ?? "",
          confidence: fuzzy.score,
        });
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);

  if (candidates.length === 0) {
    return { resolved: null, candidates: [], needsDisambiguation: false };
  }

  if (candidates.length === 1 && candidates[0].confidence >= 0.85) {
    return {
      resolved: candidates[0],
      candidates,
      needsDisambiguation: false,
    };
  }

  const topTwoClose =
    candidates.length >= 2 &&
    candidates[0].confidence - candidates[1].confidence < 0.1 &&
    candidates[0].confidence < 0.95;

  if (topTwoClose || (candidates.length > 1 && candidates[0].confidence < 0.9)) {
    return {
      resolved: null,
      candidates: candidates.slice(0, limit),
      needsDisambiguation: true,
    };
  }

  return {
    resolved: candidates[0],
    candidates,
    needsDisambiguation: false,
  };
}

/** Extract campaign name references from user message. */
export function extractCampaignQueryFromMessage(message: string): string | null {
  const patterns = [
    /(?:campaign\s+)?["']([^"']+)["']\s+campaign/i,
    /(?:analyze|review|check|health\s+check|brief\s+for)\s+(?:campaign\s+)?["']?([^"'.!?]+?)["']?(?:\s+campaign|\s*$|[.,!?])/i,
    /campaign\s+(?:called|named)\s+["']?([^"'.!?]+?)["']?(?:\s|$|[.,!?])/i,
    /for\s+(?:the\s+)?["']?([A-Z][\w\s-]+?)["']?\s+campaign/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return null;
}

/** Workflows that require campaign resolution. */
export const CAMPAIGN_REQUIRED_WORKFLOWS = new Set([
  "analyze-campaign",
  "generate-brief",
  "campaign-health-check",
]);
