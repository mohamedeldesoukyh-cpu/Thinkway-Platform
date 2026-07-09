import type { BrandMatchCandidate } from "@/lib/domains/intelligence/types";

import { brandMatchesAlias } from "./brand-resolution";
import type { BrandDetectionResult } from "./match-brand-from-profile";
import { pickBrandIdFromAccessibleList } from "./match-brand-from-profile";

export type BrandLinkOption = {
  brandId: string;
  brandName: string;
  clientName: string;
};

export type BrandSelectRow = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
};

function toLinkOption(row: BrandSelectRow | BrandMatchCandidate): BrandLinkOption {
  if ("brandId" in row) {
    return {
      brandId: row.brandId,
      brandName: row.brandName,
      clientName: row.clientName,
    };
  }
  return {
    brandId: row.id,
    brandName: row.name,
    clientName: row.clientName,
  };
}

/** Merge full accessible brand list with detection hints; detected brands sort to top. */
export function buildBrandLinkDialogOptions(
  allBrands: BrandSelectRow[],
  detection?: BrandDetectionResult | null
): BrandLinkOption[] {
  const byId = new Map<string, BrandLinkOption>();

  for (const brand of allBrands) {
    byId.set(brand.id, toLinkOption(brand));
  }

  const priorityIds: string[] = [];
  const addPriority = (candidate: BrandMatchCandidate) => {
    if (allBrands.length > 0 && !allBrands.some((brand) => brand.id === candidate.brandId)) {
      return;
    }
    if (!byId.has(candidate.brandId)) {
      byId.set(candidate.brandId, toLinkOption(candidate));
    }
    if (!priorityIds.includes(candidate.brandId)) {
      priorityIds.push(candidate.brandId);
    }
  };

  if (detection?.bestMatch) {
    addPriority(detection.bestMatch);
  }
  for (const candidate of detection?.candidates ?? []) {
    addPriority(candidate);
  }

  const priority = priorityIds
    .map((id) => byId.get(id))
    .filter((row): row is BrandLinkOption => Boolean(row));

  const rest = [...byId.values()]
    .filter((row) => !priorityIds.includes(row.brandId))
    .sort((a, b) => a.brandName.localeCompare(b.brandName));

  return [...priority, ...rest];
}

/** Extra search terms so alias queries (e.g. Etisalat ↔ E&) match in SearchableSelect. */
export function brandLinkSearchKeywords(brandName: string, clientName: string): string[] {
  const keywords = new Set<string>([brandName, clientName]);
  for (const alias of ["Etisalat", "E&", "Eand", "eand", "etisalat"]) {
    if (brandMatchesAlias(alias, brandName)) {
      keywords.add(alias);
      keywords.add("Etisalat");
      keywords.add("E&");
    }
  }
  return [...keywords];
}

/** Pick the default brand selection once the full accessible list has loaded. */
export function resolveDefaultBrandSelection(
  brandOptions: BrandLinkOption[],
  detection?: BrandDetectionResult | null
): string {
  const preferredIds = [
    detection?.bestMatch?.brandId,
    detection?.candidates[0]?.brandId,
  ].filter((id): id is string => Boolean(id));

  for (const brandId of preferredIds) {
    if (brandOptions.some((option) => option.brandId === brandId)) {
      return brandId;
    }
  }

  if (brandOptions.length === 1) {
    return brandOptions[0]!.brandId;
  }

  if (detection && brandOptions.length > 0) {
    const fromAccessible = pickBrandIdFromAccessibleList(
      detection,
      brandOptions.map((option) => ({
        id: option.brandId,
        name: option.brandName,
        clientId: "",
        clientName: option.clientName,
      }))
    );
    if (fromAccessible) return fromAccessible;
  }

  return "";
}
