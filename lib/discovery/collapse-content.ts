/** Collapse content — bundle two creators under a shared header in shortlist / quotation. */

export const COLLAPSE_CONTENT_LABEL = "Collap";

export const COLLAPSE_CONTENT_PREVIEW_LABEL = "Collap content";

export function collapseContentPreviewLabel(
  label: string = COLLAPSE_CONTENT_LABEL
): string {
  const trimmed = label.trim();
  if (!trimmed) return COLLAPSE_CONTENT_PREVIEW_LABEL;
  if (trimmed.toLowerCase().endsWith("content")) return trimmed;
  return `${trimmed} content`;
}

export type CollapseContentRef = {
  collapse_group_id: string | null;
  collapse_label: string | null;
};

export function resolveCollapseContentLabel(
  items: Array<Pick<CollapseContentRef, "collapse_label">>
): string {
  for (const item of items) {
    const label = item.collapse_label?.trim();
    if (label) return label;
  }
  return COLLAPSE_CONTENT_LABEL;
}
