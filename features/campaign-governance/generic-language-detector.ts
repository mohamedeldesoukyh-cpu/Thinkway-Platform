/** Deterministic generic language and copy-paste detection — no LLM. */

export const GENERIC_PHRASE_BLOCKLIST = [
  "leverage",
  "synergy",
  "synergies",
  "best-in-class",
  "world-class",
  "cutting-edge",
  "game-changer",
  "paradigm shift",
  "low-hanging fruit",
  "move the needle",
  "think outside the box",
  "holistic approach",
  "best practice",
  "best practices",
  "robust solution",
  "seamless experience",
  "end-to-end",
  "next-level",
  "unlock potential",
  "drive engagement",
  "elevate the brand",
  "disruptive",
  "innovative solution",
  "360 campaign",
  "360-degree",
  "turnkey",
  "value-add",
  "actionable insights",
  "data-driven approach",
  "strategic alignment",
  "go-to-market",
  "best of breed",
  "state-of-the-art",
  "touch base",
  "circle back",
  "at the end of the day",
  "moving forward",
  "in today's landscape",
  "in the ever-changing landscape",
  "comprehensive strategy",
  "holistic strategy",
  "unique value proposition",
  "lorem ipsum",
  "[placeholder]",
  "tbd",
  "todo",
  "insert here",
  "xxx",
  "coming soon",
] as const;

export type GenericLanguageFinding = {
  phrase: string;
  section: string;
  context: string;
};

export type CopyPasteFinding = {
  sectionA: string;
  sectionB: string;
  similarity: number;
  threshold: number;
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

/** Jaccard similarity between two texts (0–1). */
export function computeTextSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function detectGenericPhrases(
  sections: Record<string, string>
): GenericLanguageFinding[] {
  const findings: GenericLanguageFinding[] = [];

  for (const [section, text] of Object.entries(sections)) {
    const lower = text.toLowerCase();
    for (const phrase of GENERIC_PHRASE_BLOCKLIST) {
      if (lower.includes(phrase)) {
        const idx = lower.indexOf(phrase);
        const start = Math.max(0, idx - 30);
        const end = Math.min(text.length, idx + phrase.length + 30);
        findings.push({
          phrase,
          section,
          context: text.slice(start, end).trim(),
        });
      }
    }
  }

  return findings;
}

export function detectCrossSectionCopyPaste(
  sections: Record<string, string>,
  threshold = 0.72
): CopyPasteFinding[] {
  const findings: CopyPasteFinding[] = [];
  const keys = Object.keys(sections);

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = sections[keys[i]!]!;
      const b = sections[keys[j]!]!;
      if (a.length < 40 || b.length < 40) continue;
      const similarity = computeTextSimilarity(a, b);
      if (similarity >= threshold) {
        findings.push({
          sectionA: keys[i]!,
          sectionB: keys[j]!,
          similarity: Math.round(similarity * 100) / 100,
          threshold,
        });
      }
    }
  }

  return findings;
}

export function detectPriorCampaignCopyPaste(
  currentSections: Record<string, string>,
  priorCampaignTexts: string[],
  threshold = 0.68
): Array<{ section: string; similarity: number; priorIndex: number }> {
  const findings: Array<{ section: string; similarity: number; priorIndex: number }> = [];

  for (const [section, text] of Object.entries(currentSections)) {
    if (text.length < 40) continue;
    priorCampaignTexts.forEach((prior, idx) => {
      const similarity = computeTextSimilarity(text, prior);
      if (similarity >= threshold) {
        findings.push({ section, similarity: Math.round(similarity * 100) / 100, priorIndex: idx });
      }
    });
  }

  return findings;
}

export function simpleTextHash(text: string): string {
  let hash = 0;
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
