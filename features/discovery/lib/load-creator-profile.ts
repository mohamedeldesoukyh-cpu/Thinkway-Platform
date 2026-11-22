import type { UnifiedCreatorResult } from "@/lib/creators/types";

const pending = new Map<string, Promise<UnifiedCreatorResult | null>>();

/** Profile reads run independently of queued Server Actions (save/enrichment). */
export function loadCreatorProfile(reference: string): Promise<UnifiedCreatorResult | null> {
  const trimmed = reference.trim();
  if (!trimmed) return Promise.resolve(null);
  const id = trimmed.includes(":") ? trimmed : `inf:${trimmed}`;
  const existing = pending.get(id);
  if (existing) return existing;
  const request = fetch(`/api/creators/${encodeURIComponent(id)}/profile`, { cache: "no-store" })
    .then(async response => {
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Could not load creator profile");
      return response.json() as Promise<UnifiedCreatorResult>;
    }).finally(() => { if (pending.get(id) === request) pending.delete(id); });
  pending.set(id, request);
  return request;
}
