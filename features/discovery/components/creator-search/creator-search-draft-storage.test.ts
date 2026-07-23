import assert from "node:assert/strict";

import {
  clearDiscoverySearchDraft,
  readDiscoverySearchDraft,
  writeDiscoverySearchDraft,
} from "./creator-search-draft-storage";

const KEY = "thinkway:discovery-search-draft";

function mockSessionStorage() {
  const store = new Map<string, string>();
  const original = globalThis.sessionStorage;

  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });

  return () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: original,
    });
  };
}

const restoreSession = mockSessionStorage();

writeDiscoverySearchDraft("  cheroukcherif  ");
assert.equal(readDiscoverySearchDraft(), "cheroukcherif");
assert.equal(globalThis.sessionStorage.getItem(KEY), "  cheroukcherif  ");

clearDiscoverySearchDraft();
assert.equal(readDiscoverySearchDraft(), "");
assert.equal(globalThis.sessionStorage.getItem(KEY), null);

restoreSession();

console.log(
  "features/discovery/components/creator-search/creator-search-draft-storage.test.ts — passed"
);
