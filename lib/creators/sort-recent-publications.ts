import type { CreatorRecentPublication } from "./types";

/** Old evidence is retained, but the recent feed must show newest posts first. */
export function sortRecentPublications(publications: readonly CreatorRecentPublication[]): CreatorRecentPublication[] {
  const timestamp = (publication: CreatorRecentPublication) => {
    const value = publication.posted_at ? Date.parse(publication.posted_at) : NaN;
    return Number.isFinite(value) ? value : -Infinity;
  };
  return [...publications].sort((a, b) => timestamp(b) - timestamp(a));
}
