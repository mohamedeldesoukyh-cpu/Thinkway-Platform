import type { QuotationItemSeed } from "@/lib/domains/commercial/quotation-types";

type Identity = Pick<QuotationItemSeed, "influencer_id" | "profile_id" | "unified_id">;

/** Link imports reuse the roster; deliberate alternative options use the existing option action. */
export function newProfileLinkSeeds(seeds: QuotationItemSeed[], existing: Identity[]) {
  const seen = [...existing];
  return seeds.filter((seed) => {
    if (seen.some((row) => (seed.unified_id && row.unified_id === seed.unified_id) ||
      (seed.influencer_id && row.influencer_id === seed.influencer_id) ||
      (seed.profile_id && row.profile_id === seed.profile_id))) return false;
    seen.push(seed);
    return true;
  });
}
