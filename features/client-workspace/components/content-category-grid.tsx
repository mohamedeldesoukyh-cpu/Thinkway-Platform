"use client";

import { contentCategoriesForDisplay, categoryTheme } from "../content-categories";
import type { ClientContentCategory } from "../types";
import { CategoryGlyph } from "./review-icons";

export function ContentCategoryGrid({
  items,
  fallback,
  emptyLabel = "Category unavailable",
}: {
  items?: ClientContentCategory[] | null;
  fallback?: Array<string | null | undefined> | null;
  emptyLabel?: string;
}) {
  const categories = contentCategoriesForDisplay(items, fallback);
  if (categories.length === 0) {
    return <p className="unavailable">{emptyLabel}</p>;
  }
  return (
    <div className="cats">
      {categories.map((category) => {
        const theme = categoryTheme(category.label);
        return (
          <div className="catc" key={category.label}>
            <div className="ic" style={{ background: theme.bg, color: theme.color }}>
              <CategoryGlyph family={theme.family} />
            </div>
            {category.percent != null ? <p className="p">{category.percent}%</p> : null}
            <p className="l">{category.label}</p>
          </div>
        );
      })}
    </div>
  );
}
