"use client";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Label } from "@/components/ui/label";
import type { MasterDataOptions } from "@/lib/master-data/queries";

type CategorySubcategoryFieldsProps = {
  masterData: MasterDataOptions;
  categoryId: string;
  subcategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  onSubcategoryChange: (subcategoryId: string) => void;
  disabled?: boolean;
};

export function CategorySubcategoryFields({
  masterData,
  categoryId,
  subcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  disabled,
}: CategorySubcategoryFieldsProps) {
  const categoryOptions = masterData.categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const subcategories = masterData.subcategories.filter(
    (s) => categoryId && s.category_id === categoryId
  );

  const subcategoryOptions = subcategories.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  function handleCategoryChange(value: string) {
    onCategoryChange(value);
    onSubcategoryChange("");
  }

  return (
    <>
      <div className="grid gap-2">
        <Label>Category</Label>
        <SearchableSelect
          value={categoryId}
          onValueChange={handleCategoryChange}
          options={categoryOptions}
          placeholder="Select category"
          disabled={disabled}
        />
      </div>
      <div className="grid gap-2">
        <Label>Subcategory</Label>
        <SearchableSelect
          value={subcategoryId}
          onValueChange={onSubcategoryChange}
          options={subcategoryOptions}
          placeholder={
            categoryId ? "Select subcategory" : "Select a category first"
          }
          disabled={disabled || !categoryId}
        />
        {categoryId && subcategoryOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No subcategories for this category.
          </p>
        ) : null}
      </div>
    </>
  );
}
