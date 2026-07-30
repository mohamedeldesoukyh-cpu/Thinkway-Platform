/**
 * Filtered-list Previous/Next navigation context.
 * Spec: docs/architecture/PRODUCTIVITY_NAVIGATION_UX_SPRINT.md (D3)
 *
 * Persists the full filtered result set (not just the current page) until filters change.
 */

export type ListNavEntity =
  | "campaigns"
  | "quotations"
  | "shortlists"
  | "cio"
  | "vio";

export type ListNavContext = {
  entity: ListNavEntity;
  /** Ordered ids for the full filtered set. */
  ids: string[];
  /** Fingerprint of active filters/sort — stale when mismatched. */
  filterKey: string;
  updatedAt: string;
};

const STORAGE_PREFIX = "tw:list-nav:";

function storageKey(entity: ListNavEntity): string {
  return `${STORAGE_PREFIX}${entity}`;
}

export function writeListNavContext(
  entity: ListNavEntity,
  input: { ids: string[]; filterKey: string }
): void {
  if (typeof window === "undefined") return;
  const payload: ListNavContext = {
    entity,
    ids: input.ids,
    filterKey: input.filterKey,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.sessionStorage.setItem(storageKey(entity), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readListNavContext(entity: ListNavEntity): ListNavContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(entity));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ListNavContext;
    if (!parsed?.ids?.length || parsed.entity !== entity) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearListNavContext(entity: ListNavEntity): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(entity));
  } catch {
    /* ignore */
  }
}

export function resolveListNavNeighbors(
  entity: ListNavEntity,
  currentId: string,
  expectedFilterKey?: string | null
): {
  prevId: string | null;
  nextId: string | null;
  index: number;
  total: number;
  filterKey: string | null;
} {
  const ctx = readListNavContext(entity);
  if (!ctx) {
    return { prevId: null, nextId: null, index: -1, total: 0, filterKey: null };
  }
  if (expectedFilterKey != null && ctx.filterKey !== expectedFilterKey) {
    return {
      prevId: null,
      nextId: null,
      index: -1,
      total: 0,
      filterKey: ctx.filterKey,
    };
  }
  const index = ctx.ids.indexOf(currentId);
  if (index < 0) {
    return {
      prevId: null,
      nextId: null,
      index: -1,
      total: ctx.ids.length,
      filterKey: ctx.filterKey,
    };
  }
  return {
    prevId: index > 0 ? ctx.ids[index - 1]! : null,
    nextId: index < ctx.ids.length - 1 ? ctx.ids[index + 1]! : null,
    index,
    total: ctx.ids.length,
    filterKey: ctx.filterKey,
  };
}

/** Stable filter fingerprint for list nav invalidation. */
export function buildListNavFilterKey(parts: Record<string, unknown>): string {
  const keys = Object.keys(parts).sort();
  return keys
    .map((key) => {
      const value = parts[key];
      if (value == null || value === "") return `${key}=`;
      if (Array.isArray(value)) return `${key}=${value.join(",")}`;
      return `${key}=${String(value)}`;
    })
    .join("&");
}
