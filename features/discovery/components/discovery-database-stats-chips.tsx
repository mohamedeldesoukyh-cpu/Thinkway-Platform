"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { DiscoveryCategoryStat } from "@/lib/discovery/database-stats";
import {
  CREATOR_CATEGORY_UNCATEGORIZED,
  applyCategoriesToUrlParams,
  buildCreatorSearchHref,
  categoriesFromUrlParams,
  categoryFilterLabel,
  removeCategoryFromList,
  toggleCategoryInList,
} from "@/lib/creators/category-filter";
import { cn } from "@/lib/utils";

type DiscoveryDatabaseStatsChipsProps = {
  categories: DiscoveryCategoryStat[];
  uncategorized: DiscoveryCategoryStat | undefined;
};

const SEARCH_PATH = "/discovery/search";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function isCategoryActive(activeCategories: string[], categoryValue: string): boolean {
  return activeCategories.includes(categoryValue);
}

function CategoryChip({
  active,
  onClick,
  href,
  children,
  className,
}: {
  active: boolean;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const chipClass = cn(
    "inline-flex items-center gap-[5px] rounded-[20px] border px-[11px] py-1 text-[11.5px] font-semibold transition-colors",
    active
      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
      : "border-[var(--tw-border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-muted/80",
    className
  );

  if (href) {
    return (
      <Link href={href} className={chipClass} aria-current={active ? "page" : undefined}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={chipClass} aria-pressed={active}>
      {children}
    </button>
  );
}

/**
 * Category chips — matches HTML `.d-cats` / `.d-cat-chip` (inline with creators stat).
 */
export function DiscoveryDatabaseStatsChips({
  categories,
  uncategorized,
}: DiscoveryDatabaseStatsChipsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategories = categoriesFromUrlParams(searchParams);
  const isSearchPage = pathname === SEARCH_PATH;
  const isUnfilteredSearch = isSearchPage && activeCategories.length === 0;

  const replaceCategories = (nextCategories: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    applyCategoriesToUrlParams(params, nextCategories);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  const handleToggleCategory = (category: string) => {
    replaceCategories(toggleCategoryInList(activeCategories, category));
  };

  const handleRemoveCategory = (category: string) => {
    replaceCategories(removeCategoryFromList(activeCategories, category));
  };

  const handleClearCategories = () => {
    replaceCategories([]);
  };

  if (categories.length === 0 && !uncategorized) {
    return <p className="text-[11px] text-muted-foreground">No category tags yet</p>;
  }

  return (
    <>
      <div className="ml-1.5 flex min-w-0 flex-wrap items-center gap-2">
        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-3)]">
          By category
        </span>
        <CategoryChip
          active={isUnfilteredSearch}
          href={isSearchPage ? undefined : buildCreatorSearchHref()}
          onClick={isSearchPage ? handleClearCategories : undefined}
        >
          All
        </CategoryChip>
        {categories.map((item) => {
          const active = isCategoryActive(activeCategories, item.label);
          return (
            <CategoryChip
              key={item.label}
              active={active}
              href={isSearchPage ? undefined : buildCreatorSearchHref(item.label)}
              onClick={isSearchPage ? () => handleToggleCategory(item.label) : undefined}
            >
              <span>{item.label}</span>
              <b className={cn("font-bold", active ? "text-white" : "text-[var(--text)]")}>
                {formatCount(item.count)}
              </b>
            </CategoryChip>
          );
        })}
        {uncategorized ? (
          <CategoryChip
            active={isCategoryActive(activeCategories, CREATOR_CATEGORY_UNCATEGORIZED)}
            href={
              isSearchPage ? undefined : buildCreatorSearchHref(CREATOR_CATEGORY_UNCATEGORIZED)
            }
            onClick={
              isSearchPage
                ? () => handleToggleCategory(CREATOR_CATEGORY_UNCATEGORIZED)
                : undefined
            }
            className={
              isCategoryActive(activeCategories, CREATOR_CATEGORY_UNCATEGORIZED)
                ? undefined
                : "border-dashed"
            }
          >
            <span>Uncategorized</span>
            <b
              className={cn(
                "font-bold",
                isCategoryActive(activeCategories, CREATOR_CATEGORY_UNCATEGORIZED)
                  ? "text-white"
                  : "text-[var(--text)]"
              )}
            >
              {formatCount(uncategorized.count)}
            </b>
          </CategoryChip>
        ) : null}
      </div>

      {isSearchPage && activeCategories.length > 0 ? (
        <div className="flex basis-full min-w-0 flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-3)]">
            Active
          </span>
          {activeCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleRemoveCategory(category)}
              className={cn(
                "group inline-flex items-center gap-1 rounded-[20px] border border-[var(--tw-border)] bg-[var(--surface)] py-0.5 pr-1 pl-[11px]",
                "text-[11.5px] font-semibold text-[var(--text-2)] transition-colors hover:bg-muted"
              )}
            >
              <span className="max-w-[160px] truncate">{categoryFilterLabel(category)}</span>
              <XIcon className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
