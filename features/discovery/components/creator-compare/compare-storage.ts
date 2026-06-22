import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { MAX_CREATOR_COMPARE } from "@/lib/creators/creator-compare-bundle";

export const CREATOR_COMPARE_STORAGE_KEY = "thinkway:creator-compare-queue:v1";

/** @deprecated Use CREATOR_COMPARE_STORAGE_KEY */
export const CREATOR_SEARCH_COMPARE_KEY = CREATOR_COMPARE_STORAGE_KEY;

export function stashCompareQueue(creators: UnifiedCreatorResult[]): void {
  if (typeof sessionStorage === "undefined") return;
  const payload = creators.slice(0, MAX_CREATOR_COMPARE);
  sessionStorage.setItem(CREATOR_COMPARE_STORAGE_KEY, JSON.stringify(payload));
}

export function readCompareQueue(): UnifiedCreatorResult[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CREATOR_COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UnifiedCreatorResult[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CREATOR_COMPARE) : [];
  } catch {
    return [];
  }
}

export function writeCompareQueue(creators: UnifiedCreatorResult[]): void {
  stashCompareQueue(creators);
}

export function clearCompareQueue(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(CREATOR_COMPARE_STORAGE_KEY);
}
