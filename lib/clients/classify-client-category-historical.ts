import type { SupabaseClient } from "@supabase/supabase-js";

import type { HistoricalClassificationMatch } from "@/lib/clients/classify-client-category-types";
import { isValidClientCategoryPair } from "@/lib/clients/client-category-taxonomy";

function normalizeForHistoricalMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLegalSuffixes(name: string): string {
  const suffixes = new Set([
    "ltd",
    "limited",
    "llc",
    "inc",
    "corp",
    "corporation",
    "plc",
    "gmbh",
    "sa",
    "ag",
    "co",
    "company",
    "egypt",
    "uae",
    "ksa",
  ]);
  const tokens = name.split(" ").filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!;
    if (suffixes.has(last)) {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens.join(" ");
}

function nameVariants(name: string): string[] {
  const normalized = normalizeForHistoricalMatch(name);
  const stripped = stripLegalSuffixes(normalized);
  return [...new Set([normalized, stripped].filter(Boolean))];
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(b.split(" ").filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

type HistoricalClientRow = {
  id: string;
  name: string;
  client_category: string | null;
  client_subcategory: string | null;
};

export async function findHistoricalClientClassification(
  supabase: SupabaseClient,
  companyName: string,
  options?: { excludeClientId?: string }
): Promise<HistoricalClassificationMatch | null> {
  const trimmed = companyName.trim();
  if (trimmed.length < 3) {
    return null;
  }

  const variants = nameVariants(trimmed);
  const primaryToken = variants[0]?.split(" ")[0];
  if (!primaryToken || primaryToken.length < 3) {
    return null;
  }

  let query = supabase
    .from("clients")
    .select("id, name, client_category, client_subcategory")
    .not("client_category", "is", null)
    .not("client_subcategory", "is", null)
    .not("approved_by_user", "is", null)
    .ilike("name", `%${primaryToken}%`)
    .limit(50);

  if (options?.excludeClientId) {
    query = query.neq("id", options.excludeClientId);
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    return null;
  }

  let best: HistoricalClassificationMatch | null = null;

  for (const row of data as HistoricalClientRow[]) {
    if (!row.client_category || !row.client_subcategory) {
      continue;
    }
    if (
      !isValidClientCategoryPair(row.client_category, row.client_subcategory)
    ) {
      continue;
    }

    const candidateVariants = nameVariants(row.name);
    let score = 0;

    for (const inputVariant of variants) {
      for (const candidateVariant of candidateVariants) {
        if (inputVariant === candidateVariant) {
          score = 1;
          break;
        }
        if (
          inputVariant.includes(candidateVariant) ||
          candidateVariant.includes(inputVariant)
        ) {
          score = Math.max(score, 0.92);
        }
        score = Math.max(score, tokenOverlapScore(inputVariant, candidateVariant));
      }
      if (score >= 1) {
        break;
      }
    }

    if (score < 0.75) {
      continue;
    }

    const confidence = Math.round(90 + score * 10);
    if (!best || confidence > best.confidence) {
      best = {
        categorySlug: row.client_category,
        subcategorySlug: row.client_subcategory,
        matchedName: row.name,
        confidence: Math.min(confidence, 100),
      };
    }
  }

  return best;
}
