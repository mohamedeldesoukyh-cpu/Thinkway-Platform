import assert from "node:assert/strict";

import {
  MANUAL_REFRESH_TIMEOUT_MESSAGE,
  mapManualRefreshError,
  rethrowNextControlFlow,
} from "./manual-refresh-error";

assert.equal(
  mapManualRefreshError(
    new Error(
      "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error."
    )
  ),
  MANUAL_REFRESH_TIMEOUT_MESSAGE
);

assert.equal(
  mapManualRefreshError(new Error("FUNCTION_INVOCATION_TIMEOUT")),
  MANUAL_REFRESH_TIMEOUT_MESSAGE
);

const digestTimeout = Object.assign(new Error("An error occurred in the Server Components render."), {
  digest: "FUNCTION_INVOCATION_TIMEOUT",
});
assert.equal(mapManualRefreshError(digestTimeout), MANUAL_REFRESH_TIMEOUT_MESSAGE);

assert.equal(mapManualRefreshError(new Error("REDIS_URL missing.")), "REDIS_URL missing.");

const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/" });
assert.throws(() => rethrowNextControlFlow(redirect));

rethrowNextControlFlow(digestTimeout);

console.log("features/discovery/enrichment/manual-refresh-error.test.ts — all tests passed");
