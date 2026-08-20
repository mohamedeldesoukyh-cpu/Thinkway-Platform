import { MAX_SHORTLIST_PASTE_CREATORS } from "@/lib/discovery/add-creator-constants";

export type ShortlistPastePreview = {
  parsedCount: number;
  invalidCount: number;
  overflowCount: number;
  addableCount: number;
};

export function shortlistPastePreview(
  parsedCount: number,
  invalidCount: number,
  max = MAX_SHORTLIST_PASTE_CREATORS
): ShortlistPastePreview {
  const addableCount = Math.min(parsedCount, max);
  return {
    parsedCount,
    invalidCount,
    overflowCount: Math.max(0, parsedCount - max),
    addableCount,
  };
}

export function describeShortlistPastePreview(preview: ShortlistPastePreview): string {
  const parts: string[] = [];
  if (preview.parsedCount > 0) {
    parts.push(
      `${preview.parsedCount} profile${preview.parsedCount === 1 ? "" : "s"} detected`
    );
  }
  if (preview.overflowCount > 0) {
    parts.push(`first ${preview.addableCount} will be added`);
  }
  if (preview.invalidCount > 0) {
    parts.push(
      `${preview.invalidCount} unrecognized link${preview.invalidCount === 1 ? "" : "s"}`
    );
  }
  return parts.join(" · ");
}

export type ShortlistPasteAddOutcome = {
  added: number;
  alreadyOnList: number;
  created: number;
  existing: number;
  failed: number;
  invalid: number;
};

export function describeShortlistPasteAddOutcome(
  outcome: ShortlistPasteAddOutcome
): string {
  const parts: string[] = [];
  if (outcome.added > 0) {
    parts.push(`${outcome.added} added`);
  }
  if (outcome.alreadyOnList > 0) {
    parts.push(`${outcome.alreadyOnList} already on list`);
  }
  if (outcome.created > 0 && outcome.added > 0) {
    parts.push(`${outcome.created} new in Discovery`);
  }
  if (outcome.failed > 0) {
    parts.push(`${outcome.failed} failed`);
  }
  if (outcome.invalid > 0) {
    parts.push(
      `${outcome.invalid} invalid link${outcome.invalid === 1 ? "" : "s"}`
    );
  }
  return parts.join(" · ") || "No creators added";
}

export function looksLikePastedProfileList(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length < 2) return false;
  return (
    /https?:\/\/|instagram\.com|tiktok\.com|youtube\.com|snapchat\.com|(?:twitter|x)\.com|facebook\.com|fb\.com/i.test(
      trimmed
    ) || tokens.filter((token) => token.startsWith("@")).length >= 2
  );
}
