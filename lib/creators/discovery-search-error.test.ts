import assert from "node:assert/strict";

import {
  DISCOVERY_BROWSE_TIMEOUT_MESSAGE,
  DISCOVERY_SEARCH_MASKED_MESSAGE,
  DISCOVERY_SEARCH_TIMEOUT_MESSAGE,
  mapDiscoverySearchError,
} from "@/lib/creators/discovery-search-error";

assert.equal(
  mapDiscoverySearchError(
    new Error(
      "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error."
    )
  ),
  DISCOVERY_SEARCH_MASKED_MESSAGE
);

assert.equal(
  mapDiscoverySearchError(new Error("canceling statement due to statement timeout")),
  DISCOVERY_SEARCH_TIMEOUT_MESSAGE
);

assert.equal(
  mapDiscoverySearchError(new Error("canceling statement due to statement timeout"), {
    hasSearchQuery: false,
  }),
  DISCOVERY_BROWSE_TIMEOUT_MESSAGE
);

assert.equal(mapDiscoverySearchError(new Error("Creator search failed")), "Creator search failed");

console.log("lib/creators/discovery-search-error.test.ts — all tests passed");
