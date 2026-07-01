/** URL/query value for creators with no category tags. */
export const CREATOR_CATEGORY_UNCATEGORIZED = "__uncategorized__";

export const CREATOR_SEARCH_CATEGORY_PARAM = "category";
export const CREATOR_SEARCH_QUERY_PARAM = "q";

type CategoryUrlReader = {
  getAll: (name: string) => string[];
};

/** Normalize a single category value from URL or filter input. */
export function categoryFilterFromUrlParam(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/** Read all selected categories from URL search params (supports repeated `category` keys). */
export function categoriesFromUrlParams(source: CategoryUrlReader): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const raw of source.getAll(CREATOR_SEARCH_CATEGORY_PARAM)) {
    const value = categoryFilterFromUrlParam(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    categories.push(value);
  }
  return categories;
}

export function normalizeCategoryList(
  categories: string | string[] | null | undefined
): string[] {
  if (!categories) return [];
  const list = Array.isArray(categories) ? categories : [categories];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of list) {
    const value = categoryFilterFromUrlParam(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

export function categoriesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

/** Toggle a category in a multi-select list (add if absent, remove if present). */
export function toggleCategoryInList(categories: string[], category: string): string[] {
  const value = categoryFilterFromUrlParam(category);
  if (!value) return categories;
  const index = categories.indexOf(value);
  if (index >= 0) {
    return categories.filter((_, i) => i !== index);
  }
  return [...categories, value];
}

export function removeCategoryFromList(categories: string[], category: string): string[] {
  const value = categoryFilterFromUrlParam(category);
  if (!value) return categories;
  return categories.filter((item) => item !== value);
}

export function buildCreatorSearchHref(categories?: string | string[] | null): string {
  const base = "/discovery/search";
  const list = normalizeCategoryList(categories);
  if (list.length === 0) return base;
  const params = new URLSearchParams();
  for (const category of list) {
    params.append(CREATOR_SEARCH_CATEGORY_PARAM, category);
  }
  return `${base}?${params.toString()}`;
}

export function applyCategoriesToUrlParams(
  params: URLSearchParams,
  categories: string[]
): URLSearchParams {
  params.delete(CREATOR_SEARCH_CATEGORY_PARAM);
  for (const category of categories) {
    params.append(CREATOR_SEARCH_CATEGORY_PARAM, category);
  }
  return params;
}

export function isUncategorizedCategoryFilter(category: string | undefined | null): boolean {
  return category === CREATOR_CATEGORY_UNCATEGORIZED;
}

export function creatorIsUncategorized(creator: {
  browse_category_tags?: string[] | null;
  categories?: string[] | null;
}): boolean {
  return creatorBrowseCategoryTags(creator).length === 0;
}

/** Stored influencer / discovery category tags used for browse filters (not merged audience interests). */
export function creatorBrowseCategoryTags(creator: {
  browse_category_tags?: string[] | null;
  categories?: string[] | null;
}): string[] {
  const stored = normalizeCategoryList(creator.browse_category_tags);
  if (stored.length > 0) return stored;
  return normalizeCategoryList(creator.categories);
}

/** Stored influencer categories for Discovery list/detail (not merged audience interests). */
export function creatorStoredCategoriesForDisplay(creator: {
  browse_category_tags?: string[] | null;
  categories?: string[] | null;
}): string[] {
  return creatorBrowseCategoryTags(creator);
}

function categoryTagMatchesFilter(tag: string, filterCategory: string): boolean {
  return tag.trim().toLowerCase() === filterCategory.trim().toLowerCase();
}

export function categoryFilterLabel(category: string): string {
  return isUncategorizedCategoryFilter(category) ? "Uncategorized" : category;
}

/** Resolve browse filters to a deduplicated category list (prefers `categories`, falls back to legacy `category`). */
export function resolveBrowseCategories(filters: {
  categories?: string[] | null;
  category?: string | null;
}): string[] {
  const fromList = normalizeCategoryList(filters.categories);
  if (fromList.length > 0) return fromList;
  const legacy = categoryFilterFromUrlParam(filters.category);
  return legacy ? [legacy] : [];
}

export function creatorMatchesBrowseCategories(
  creator: {
    browse_category_tags?: string[] | null;
    categories?: string[] | null;
  },
  categories: string[]
): boolean {
  const resolved = normalizeCategoryList(categories);
  if (resolved.length === 0) return true;

  const tags = creatorBrowseCategoryTags(creator);

  return resolved.some((category) => {
    if (isUncategorizedCategoryFilter(category)) {
      return tags.length === 0;
    }
    return tags.some((tag) => categoryTagMatchesFilter(tag, category));
  });
}

/** True when browse should use the unified search index (unfiltered empty query). */
export function shouldUseUnifiedBrowseIndexPath(filters: {
  search?: string | null;
  source?: string | null;
  categories?: string[] | null;
  category?: string | null;
}): boolean {
  const sourceFilter = filters.source ?? "all";
  if (filters.search?.trim()) return false;
  if (sourceFilter !== "all") return false;
  return resolveBrowseCategories(filters).length === 0;
}

type CategoryQueryable = {
  overlaps: (column: string, value: string[]) => CategoryQueryable;
  or: (filters: string) => CategoryQueryable;
};

/** Apply OR semantics for category filters on array columns (`categories`, `category_tags`). */
export function applyCategoriesToArrayColumnQuery<T extends CategoryQueryable>(
  query: T,
  column: "categories" | "category_tags",
  categories: string[]
): T {
  const resolved = normalizeCategoryList(categories);
  if (resolved.length === 0) return query;

  const regular = resolved.filter((category) => !isUncategorizedCategoryFilter(category));
  const includeUncategorized = resolved.some(isUncategorizedCategoryFilter);

  if (includeUncategorized && regular.length > 0) {
    const overlapParts = regular.map((category) => `${column}.cs.{${quotePostgresArrayValue(category)}}`);
    return query.or(`${overlapParts.join(",")},${column}.is.null,${column}.eq.{}`) as T;
  }

  if (includeUncategorized) {
    return query.or(`${column}.is.null,${column}.eq.{}`) as T;
  }

  return query.overlaps(column, regular) as T;
}

function quotePostgresArrayValue(value: string): string {
  if (/^[A-Za-z0-9_]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
