import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

test("PWA must not unregister+reload loop; Client Review skips SW", () => {
  const provider = readFileSync(resolve("components/pwa/pwa-provider.tsx"), "utf8");
  const update = readFileSync(resolve("components/pwa/pwa-update-prompt.tsx"), "utf8");

  assert.equal(provider.includes("existing.map((registration) => registration.unregister())"), true);
  assert.equal(provider.includes("isClientReviewPath"), true);
  // Unregister only on /review — not before every register.
  assert.equal(provider.includes("if (isClientReviewPath(pathname))"), true);
  const unregisterIdx = provider.indexOf("registration.unregister()");
  const registerIdx = provider.indexOf("navigator.serviceWorker.register");
  assert.ok(unregisterIdx > 0 && registerIdx > unregisterIdx);
  assert.equal(
    provider.slice(unregisterIdx, registerIdx).includes("isClientReviewPath") ||
      provider.indexOf("isClientReviewPath(pathname)") < unregisterIdx,
    true
  );

  assert.equal(update.includes("USER_RELOAD_KEY"), true);
  assert.equal(update.includes('userRequested = window.sessionStorage.getItem(USER_RELOAD_KEY) === "1"'), true);
  assert.equal(update.includes("if (!userRequested) return;"), true);
  assert.equal(update.includes("isClientReviewPath"), true);
});
