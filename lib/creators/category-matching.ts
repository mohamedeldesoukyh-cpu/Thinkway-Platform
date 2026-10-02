import { CREATOR_CATEGORY_KEYWORDS, CREATOR_CATEGORY_LABELS } from "./category-keywords";

// Exact labels only: do not turn a substring such as "carpet" into Automotive.
const aliases: Readonly<Record<string, string>> = {
  ...CREATOR_CATEGORY_KEYWORDS,
  momlife: "Parenting",
  momsoftiktok: "Parenting",
  mumlife: "Parenting",
  "beauty & cosmetics": "Beauty",
};

export function canonicalCategoryLabel(raw: string): string {
  const value = raw.trim().replace(/^#+/, "").trim();
  const key = value.toLowerCase();
  return (Object.hasOwn(aliases, key) ? aliases[key] : undefined)
    ?? CREATOR_CATEGORY_LABELS.find((label) => label.toLowerCase() === key)
    ?? value;
}

/** Candidate SQL and post-hydration filtering must recognize the same family. */
export function expandCategoryQueryLabels(categories: readonly string[]): string[] {
  const values = new Set<string>();
  for (const raw of categories) {
    const canonical = canonicalCategoryLabel(raw);
    if (!canonical) continue;
    const family = Object.entries(aliases)
      .filter(([, label]) => label.toLowerCase() === canonical.toLowerCase())
      .map(([alias]) => alias);
    for (const value of [raw.trim(), canonical, ...family]) {
      values.add(value);
      if (value !== "__uncategorized__") values.add(`#${value.replace(/^#+/, "")}`);
    }
  }
  return [...values];
}
