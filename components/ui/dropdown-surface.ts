import { cn } from "@/lib/utils";

/** Floating panel — white/blue gradient, soft shadow, 16px radius. */
export const DROPDOWN_SURFACE_CLASS = "thinkway-dropdown-surface";

/** Scrollable list inside checkbox / multi-select dropdowns. */
export const DROPDOWN_SURFACE_LIST_CLASS = "thinkway-dropdown-surface__list";

/** Row item — hover/focus blue tint, 10px radius. */
export const DROPDOWN_ITEM_CLASS = "thinkway-dropdown-item";

/** Selected checkbox row in multi-select lists. */
export const DROPDOWN_ITEM_SELECTED_CLASS = "thinkway-dropdown-item--selected";

/** Checkbox inside dropdown lists (#0057FF when checked). */
export const DROPDOWN_CHECKBOX_CLASS = "thinkway-dropdown-checkbox";

/** Collapsed field trigger — rounded border, chevrons icon. */
export const DROPDOWN_TRIGGER_CLASS = "thinkway-dropdown-trigger";

/** Search row at top of searchable dropdown panels. */
export const DROPDOWN_SEARCH_CLASS = "thinkway-dropdown-search";

/** Empty state inside dropdown lists. */
export const DROPDOWN_EMPTY_CLASS = "thinkway-dropdown-empty";

/** Backward-compatible aliases used by Discovery / quotation modules. */
export const DISCOVERY_DIALOG_SELECT_CONTENT_CLASS = DROPDOWN_SURFACE_CLASS;
export const DISCOVERY_CHECKBOX_POPOVER_CONTENT_CLASS = DROPDOWN_SURFACE_CLASS;
export const DISCOVERY_CHECKBOX_POPOVER_LIST_CLASS = DROPDOWN_SURFACE_LIST_CLASS;
export const DISCOVERY_DIALOG_LIST_ITEM_CLASS = DROPDOWN_ITEM_CLASS;
export const DISCOVERY_DIALOG_SELECT_ITEM_CLASS = DROPDOWN_ITEM_CLASS;
export const DISCOVERY_DIALOG_CHECKBOX_CLASS = DROPDOWN_CHECKBOX_CLASS;

export function dropdownSurfaceClass(className?: string) {
  return cn(DROPDOWN_SURFACE_CLASS, className);
}

export function dropdownItemClass(selected?: boolean, className?: string) {
  return cn(DROPDOWN_ITEM_CLASS, selected && DROPDOWN_ITEM_SELECTED_CLASS, className);
}
