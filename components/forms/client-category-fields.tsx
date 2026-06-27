"use client";

import { SearchableSelect } from "@/components/forms/searchable-select";
import {
  ClientFormField,
  ClientFormGrid,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/clients/components/client-form-ui";
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
  layout?: "stack" | "grid" | "inline";
};

export function ClientCategoryFields({
  categorySlug,
  subcategorySlug,
  onCategoryChange,
  onSubcategoryChange,
  disabled,
  layout = "stack",
}: ClientCategoryFieldsProps) {
  const categoryOptions = getClientCategoryOptions();
  const subcategoryOptions = getClientSubcategoryOptions(categorySlug);

  function handleCategoryChange(value: string) {
    onCategoryChange(value);
    onSubcategoryChange("");
  }

  const categoryField = (
    <ClientFormField label="Category">
      <SearchableSelect
        value={categorySlug}
        onValueChange={handleCategoryChange}
        options={categoryOptions}
        placeholder="Select category"
        disabled={disabled}
        className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
      />
    </ClientFormField>
  );

  const subcategoryField = (
    <ClientFormField label="Subcategory">
      <SearchableSelect
        value={subcategorySlug}
        onValueChange={onSubcategoryChange}
        options={subcategoryOptions}
        placeholder={
          categorySlug ? "Select subcategory" : "Select a category first"
        }
        disabled={disabled || !categorySlug}
        className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
      />
      {categorySlug && subcategoryOptions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No subcategories for this category.
        </p>
      ) : null}
    </ClientFormField>
  );

  if (layout === "inline") {
    return (
      <>
        {categoryField}
        {subcategoryField}
      </>
    );
  }

  if (layout === "grid") {
    return (
      <ClientFormGrid>
        {categoryField}
        {subcategoryField}
      </ClientFormGrid>
    );
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
