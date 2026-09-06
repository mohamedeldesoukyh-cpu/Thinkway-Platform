import assert from "node:assert/strict";

import { resolveDiscoveryLoadMoreRoot } from "@/features/discovery/components/creator-search/creator-search-load-more-root";

function makeEl(
  partial: Partial<HTMLElement> & {
    scrollHeight: number;
    clientHeight: number;
    overflowY?: string;
    parent?: HTMLElement | null;
  }
): HTMLElement {
  const el = {
    scrollHeight: partial.scrollHeight,
    clientHeight: partial.clientHeight,
    parentElement: partial.parent ?? null,
  } as HTMLElement;
  return el;
}

const originalGetComputedStyle = global.getComputedStyle;

function withStyles(
  map: Map<HTMLElement, { overflowY: string }>,
  fn: () => void
) {
  global.getComputedStyle = ((el: Element) => {
    const entry = map.get(el as HTMLElement);
    return { overflowY: entry?.overflowY ?? "visible" } as CSSStyleDeclaration;
  }) as typeof getComputedStyle;
  try {
    fn();
  } finally {
    global.getComputedStyle = originalGetComputedStyle;
  }
}

const styles = new Map<HTMLElement, { overflowY: string }>();

const shell = makeEl({ scrollHeight: 4000, clientHeight: 800, overflowY: "auto" });
const listConstrained = makeEl({
  scrollHeight: 2400,
  clientHeight: 500,
  overflowY: "auto",
  parent: shell,
});
styles.set(shell, { overflowY: "auto" });
styles.set(listConstrained, { overflowY: "auto" });

withStyles(styles, () => {
  assert.equal(
    resolveDiscoveryLoadMoreRoot(listConstrained, 900),
    listConstrained,
    "prefers overflowing list scroller"
  );
});

const listGrown = makeEl({
  scrollHeight: 3200,
  clientHeight: 3200,
  overflowY: "auto",
  parent: shell,
});
styles.set(listGrown, { overflowY: "auto" });

withStyles(styles, () => {
  assert.equal(
    resolveDiscoveryLoadMoreRoot(listGrown, 900),
    shell,
    "when list grows with content, bind to shell overflow parent"
  );
});

const listShort = makeEl({
  scrollHeight: 400,
  clientHeight: 500,
  overflowY: "auto",
  parent: shell,
});
styles.set(listShort, { overflowY: "auto" });

withStyles(styles, () => {
  assert.equal(
    resolveDiscoveryLoadMoreRoot(listShort, 900),
    listShort,
    "short constrained list still owns IO so first pages auto-load"
  );
});

assert.equal(resolveDiscoveryLoadMoreRoot(null), null);

console.log("creator-search-load-more-root.test.ts — all tests passed");
