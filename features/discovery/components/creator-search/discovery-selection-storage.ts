export const DISCOVERY_SELECTION_STORAGE_KEY = "thinkway:discovery-selection:v1";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

export function stashDiscoverySelection(creators: UnifiedCreatorResult[]): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(DISCOVERY_SELECTION_STORAGE_KEY, JSON.stringify(creators));
}

export function readDiscoverySelection(): UnifiedCreatorResult[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(DISCOVERY_SELECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UnifiedCreatorResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearDiscoverySelection(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(DISCOVERY_SELECTION_STORAGE_KEY);
}
