import { normalizeEntityName } from "@/lib/validation/hierarchy";
import type { AgencyOrDirect } from "@/types/database";

export type DuplicateMatchType = "exact" | "fuzzy" | "legal_name" | "alias" | "code";

export type ClientDuplicateCandidate = {
  id: string;
  name: string;
  legal_name: string | null;
  document_number: string;
  agency_or_direct: string | null;
  name_ar?: string | null;
};

export type BrandDuplicateCandidate = {
  id: string;
  name: string;
  document_number: string;
  client_id: string;
  client_name?: string | null;
};

export type DuplicateSearchResult<T> = T & {
  matchType: DuplicateMatchType;
  score: number;
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function fuzzyScore(queryNorm: string, candidateNorm: string): number {
  if (!queryNorm || !candidateNorm) return 0;
  if (candidateNorm === queryNorm) return 100;
  if (candidateNorm.includes(queryNorm) || queryNorm.includes(candidateNorm)) return 85;
  const distance = levenshtein(queryNorm, candidateNorm);
  const maxLen = Math.max(queryNorm.length, candidateNorm.length);
  const similarity = 1 - distance / maxLen;
  return similarity >= 0.72 ? Math.round(similarity * 80) : 0;
}

export function scoreClientDuplicate(
  query: string,
  candidate: ClientDuplicateCandidate,
  agencyOrDirect?: AgencyOrDirect | null
): DuplicateSearchResult<ClientDuplicateCandidate> | null {
  const queryNorm = normalizeEntityName(query);
  if (!queryNorm) return null;

  const nameNorm = normalizeEntityName(candidate.name);
  const legalNorm = candidate.legal_name ? normalizeEntityName(candidate.legal_name) : "";
  const aliasNorm = candidate.name_ar ? normalizeEntityName(candidate.name_ar) : "";
  const codeNorm = normalizeEntityName(candidate.document_number);

  if (nameNorm === queryNorm) {
    return { ...candidate, matchType: "exact", score: 100 };
  }
  if (legalNorm && legalNorm === queryNorm) {
    return { ...candidate, matchType: "legal_name", score: 98 };
  }
  if (aliasNorm && aliasNorm === queryNorm) {
    return { ...candidate, matchType: "alias", score: 96 };
  }
  if (codeNorm.includes(queryNorm)) {
    return { ...candidate, matchType: "code", score: 94 };
  }

  const fuzzyCandidates = [
    { matchType: "fuzzy" as const, score: fuzzyScore(queryNorm, nameNorm) },
    { matchType: "legal_name" as const, score: legalNorm ? fuzzyScore(queryNorm, legalNorm) : 0 },
    { matchType: "alias" as const, score: aliasNorm ? fuzzyScore(queryNorm, aliasNorm) : 0 },
  ].sort((a, b) => b.score - a.score);

  const best = fuzzyCandidates[0];
  if (!best || best.score < 60) return null;

  if (
    agencyOrDirect &&
    candidate.agency_or_direct &&
    candidate.agency_or_direct !== agencyOrDirect &&
    best.score < 90
  ) {
    return null;
  }

  return { ...candidate, matchType: best.matchType, score: best.score };
}

export function scoreBrandDuplicate(
  query: string,
  candidate: BrandDuplicateCandidate
): DuplicateSearchResult<BrandDuplicateCandidate> | null {
  const queryNorm = normalizeEntityName(query);
  if (!queryNorm) return null;

  const nameNorm = normalizeEntityName(candidate.name);
  const codeNorm = normalizeEntityName(candidate.document_number);

  if (nameNorm === queryNorm) {
    return { ...candidate, matchType: "exact", score: 100 };
  }
  if (codeNorm.includes(queryNorm)) {
    return { ...candidate, matchType: "code", score: 94 };
  }

  const score = fuzzyScore(queryNorm, nameNorm);
  if (score < 60) return null;

  return { ...candidate, matchType: "fuzzy", score };
}

export function rankDuplicateResults<T extends { score: number }>(results: T[]): T[] {
  return [...results].sort((a, b) => b.score - a.score);
}

export function duplicateMatchTypeLabel(matchType: DuplicateMatchType): string {
  switch (matchType) {
    case "exact":
      return "Exact name match";
    case "legal_name":
      return "Legal entity name match";
    case "alias":
      return "Alias match";
    case "code":
      return "Document code match";
    default:
      return "Similar name";
  }
}
