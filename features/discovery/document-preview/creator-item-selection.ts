import type { DocumentCreatorOption } from "./document-creator-selection-dialog";

/** Preserve exact lines; only priced packages must be selected as a unit. */
export function normalizeCreatorItemSelection(creators: DocumentCreatorOption[], ids: readonly string[]): Set<string> {
  const allowed = new Set(creators.flatMap(creator => creator.itemIds));
  const selected = new Set(ids.filter(id => allowed.has(id)));
  for (const creator of creators) {
    for (const option of creator.lineOptions ?? []) {
      if (option.itemIds.some(id => selected.has(id))) {
        for (const id of option.itemIds) if (allowed.has(id)) selected.add(id);
      }
    }
  }
  return selected;
}

export function seedCreatorItemSelection(creators: DocumentCreatorOption[], ids?: readonly string[]): Set<string> {
  return normalizeCreatorItemSelection(creators, ids?.length ? ids : creators.flatMap(creator => creator.itemIds));
}

export function toggleCreatorItems(selected: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(selected);
  const remove = ids.every(id => next.has(id));
  for (const id of ids) { if (remove) next.delete(id); else next.add(id); }
  return next;
}
