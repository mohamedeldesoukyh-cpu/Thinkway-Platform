/**
 * Resolve the Element that actually scrolls Creator Search results.
 *
 * Nested `.discovery-search-exact-scroll` is the intended root, but when the flex
 * height chain breaks the list grows with content and the app shell
 * (`body > … > overflow-y-auto`) becomes the real scroller. Binding
 * IntersectionObserver to the non-scrolling list then never fires load-more.
 */

function isOverflowYScrollable(style: CSSStyleDeclaration): boolean {
  const oy = style.overflowY;
  return oy === "auto" || oy === "scroll" || oy === "overlay";
}

function elementScrollsY(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1;
}

export function resolveDiscoveryLoadMoreRoot(
  listScroll: HTMLElement | null,
  viewportHeight: number = typeof window !== "undefined" ? window.innerHeight : 0
): Element | null {
  if (!listScroll) return null;

  const listStyle = getComputedStyle(listScroll);
  const listCanScroll = isOverflowYScrollable(listStyle);
  const listOverflows = elementScrollsY(listScroll);

  if (listCanScroll && listOverflows) {
    return listScroll;
  }

  // List is a scrollport but content fits — still prefer it when it looks flex-constrained
  // (not grown to full document height). Short first pages auto-page via IO.
  const grewWithContent =
    listCanScroll &&
    !listOverflows &&
    listScroll.clientHeight > 0 &&
    viewportHeight > 0 &&
    listScroll.scrollHeight > viewportHeight * 0.9;

  if (listCanScroll && listScroll.clientHeight >= 120 && !grewWithContent) {
    return listScroll;
  }

  let node: HTMLElement | null = listScroll.parentElement;
  const docRoot =
    typeof document !== "undefined" ? document.documentElement : null;
  while (node && node !== docRoot) {
    const style = getComputedStyle(node);
    if (isOverflowYScrollable(style) && elementScrollsY(node)) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}
