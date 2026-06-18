"use client";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Label } from "@/components/ui/label";
import {
  getClientCategoryOptions,
  getClientSubcategoryOptions,
} from "@/lib/clients/client-category-taxonomy";

type ClientCategoryFieldsProps = {
  categorySlug: string;
  subcategorySlug: string;
  onCategoryChange: (categorySlug: string) => void;
  onSubcategoryChange: (subcategorySlug: string) => void;
  disabled?: boolean;
};

export function ClientCategoryFields({
  categorySlug,
  subcategorySlug,
  onCategoryChange,
  onSubcategoryChange,
  disabled,
}: ClientCategoryFieldsProps) {
  const categoryOptions = getClientCategoryOptions();
  const subcategoryOptions = getClientSubcategoryOptions(categorySlug);

  function handleCategoryChange(value: string) {
    onCategoryChange(value);
    onSubcategoryChange("");
  }

  return (
    <>
      <div className="grid gap-2">
        <Label>Category</Label>
        <SearchableSelect
          value={categorySlug}
          onValueChange={handleCategoryChange}
          options={categoryOptions}
          placeholder="Select category"
          disabled={disabled}
        />
      </div>
      <div className="grid gap-2">
        <Label>Subcategory</Label>
        <SearchableSelect
          value={subcategorySlug}
          onValueChange={onSubcategoryChange}
          options={subcategoryOptions}
          placeholder={
            categorySlug ? "Select subcategory" : "Select a category first"
          }
          disabled={disabled || !categorySlug}
        />
        {categorySlug && subcategoryOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No subcategories for this category.
          </p>
        ) : null}
      </div>
    </>
  );
}
