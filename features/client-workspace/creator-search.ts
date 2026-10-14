import type { ClientCreatorCard } from "./types";

/** Search only the already-authorized roster, without changing its source order. */
export function matchesWorkspaceCreatorSearch(creator: ClientCreatorCard, query: string): boolean {
  const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase().trim();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const text = normalize([creator.displayName, creator.handle, creator.country, creator.city, creator.deliverables,
    ...(creator.categories ?? []), ...(creator.quotationOptions ?? []).flatMap(option => [option.serviceDescription, option.deliverables])
  ].filter(Boolean).join(" "));
  return terms.every(term => text.includes(term));
}
