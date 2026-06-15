import { normalizeHandle, normalizeName } from "@/lib/intelligence/entity-resolution/normalize";

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
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

export function stringSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const handleLeft = normalizeHandle(a);
  const handleRight = normalizeHandle(b);
  if (handleLeft && handleRight && handleLeft === handleRight) return 0.98;

  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 0;
  const distance = levenshtein(left, right);
  return Math.max(0, Math.round((1 - distance / maxLen) * 10000) / 10000);
}

export function bestFuzzyMatch<T extends { id: string; label: string }>(
  needle: string | null | undefined,
  candidates: T[],
  minScore = 0.82
): { id: string; label: string; score: number } | null {
  if (!needle?.trim()) return null;

  let best: { id: string; label: string; score: number } | null = null;
  for (const candidate of candidates) {
    const score = stringSimilarity(needle, candidate.label);
    if (score < minScore) continue;
    if (!best || score > best.score) {
      best = { id: candidate.id, label: candidate.label, score };
    }
  }
  return best;
}
