export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

export function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function levenshtein(a: string, b: string): number {
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

export function fuzzyConfidence(queryNorm: string, candidateNorm: string): number {
  if (!queryNorm || !candidateNorm) return 0;
  if (candidateNorm === queryNorm) return 98;
  if (candidateNorm.includes(queryNorm) || queryNorm.includes(candidateNorm)) return 88;

  const compactQuery = queryNorm.replace(/\s+/g, "");
  const compactCandidate = candidateNorm.replace(/\s+/g, "");
  if (compactCandidate === compactQuery) return 92;
  if (compactCandidate.includes(compactQuery) || compactQuery.includes(compactCandidate)) {
    return 85;
  }

  const distance = levenshtein(compactQuery, compactCandidate);
  const maxLen = Math.max(compactQuery.length, compactCandidate.length);
  const similarity = 1 - distance / maxLen;
  return similarity >= 0.72 ? Math.round(similarity * 78) : 0;
}
