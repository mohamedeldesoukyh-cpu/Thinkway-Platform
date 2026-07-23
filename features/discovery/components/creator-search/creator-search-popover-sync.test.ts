import assert from "node:assert/strict";

import { shouldPropagateDebouncedSearchDraft } from "./creator-search-popover-sync";

// Normal typing: parent query lags while draft debounces.
assert.equal(
  shouldPropagateDebouncedSearchDraft({
    debouncedDraft: "username",
    draftSearch: "username",
    searchQuery: "",
    previousSearchQuery: "",
  }),
  true
);

// External clear before draft resync: debounced value matches stale draft.
assert.equal(
  shouldPropagateDebouncedSearchDraft({
    debouncedDraft: "username",
    draftSearch: "username",
    searchQuery: "",
    previousSearchQuery: "username",
  }),
  false
);

// External clear after draft resync: wait for debounce to settle.
assert.equal(
  shouldPropagateDebouncedSearchDraft({
    debouncedDraft: "username",
    draftSearch: "",
    searchQuery: "",
    previousSearchQuery: "username",
  }),
  false
);

// Cleared state settled — nothing to propagate.
assert.equal(
  shouldPropagateDebouncedSearchDraft({
    debouncedDraft: "",
    draftSearch: "",
    searchQuery: "",
    previousSearchQuery: "",
  }),
  false
);

// External replace with a new query (URL navigation).
assert.equal(
  shouldPropagateDebouncedSearchDraft({
    debouncedDraft: "old",
    draftSearch: "old",
    searchQuery: "new",
    previousSearchQuery: "old",
  }),
  false
);

// Stale debounce mid-typing should not propagate.
assert.equal(
  shouldPropagateDebouncedSearchDraft({
    debouncedDraft: "use",
    draftSearch: "username",
    searchQuery: "",
    previousSearchQuery: "",
  }),
  false
);

console.log(
  "features/discovery/components/creator-search/creator-search-popover-sync.test.ts — passed"
);
