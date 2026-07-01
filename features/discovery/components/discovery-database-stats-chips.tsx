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
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
    active
      ? "border-[#1D9E75]/40 bg-[#1D9E75]/10 font-medium text-[#1D9E75]"
      : "border-border/80 bg-background text-foreground hover:border-[#1D9E75]/30",
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
          By category
        </span>
        <CategoryChip
          active={isUnfilteredSearch}
          href={isSearchPage ? undefined : buildCreatorSearchHref()}
          onClick={isSearchPage ? handleClearCategories : undefined}
          className={
            isUnfilteredSearch
              ? "border-[#1D9E75]/40 bg-[#1D9E75]/10 font-medium text-[#1D9E75]"
              : "border-border/80 bg-background text-muted-foreground hover:border-[#1D9E75]/30 hover:text-foreground"
          }
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
              <span className="font-medium">{item.label}</span>
              <span
                className={cn(
                  "tabular-nums",
                  active ? "text-[#1D9E75]/80" : "text-muted-foreground"
                )}
              >
                {formatCount(item.count)}
              </span>
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
                ? "border-[#1D9E75]/40 bg-[#1D9E75]/10 font-medium text-[#1D9E75]"
                : "border-dashed border-border/80 bg-background text-muted-foreground hover:border-[#1D9E75]/30 hover:text-foreground"
            }
          >
            <span>Uncategorized</span>
            <span className="tabular-nums">{formatCount(uncategorized.count)}</span>
          </CategoryChip>
        ) : null}
      </div>

      {isSearchPage && activeCategories.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
            Active
          </span>
          {activeCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleRemoveCategory(category)}
              className={cn(
                "group inline-flex items-center gap-1 rounded-full border border-[#1D9E75]/25 bg-[#1D9E75]/5 py-0.5 pr-1 pl-2",
                "text-[11px] font-medium text-[#1D9E75] transition-colors hover:bg-[#1D9E75]/10"
              )}
            >
              <span className="max-w-[160px] truncate">{categoryFilterLabel(category)}</span>
              <XIcon className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
