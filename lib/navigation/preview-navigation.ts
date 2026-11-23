export const PREVIEW_NAVIGATION_EVENT = "thinkway:preview-navigation";

/** Keep preview navigation in the current app so Back can reuse the route cache. */
export function openDocumentPreview(href: string) {
  window.dispatchEvent(new CustomEvent(PREVIEW_NAVIGATION_EVENT, { detail: { href, close: false } }));
}

export function closeDocumentPreview(href: string) {
  window.dispatchEvent(new CustomEvent(PREVIEW_NAVIGATION_EVENT, { detail: { href, close: true } }));
}
