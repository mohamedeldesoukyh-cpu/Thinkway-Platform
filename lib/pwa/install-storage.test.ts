import assert from "node:assert/strict";
import test from "node:test";

const store = new Map<string, string>();
(
  globalThis as typeof globalThis & {
    window: {
      localStorage: {
        getItem: (key: string) => string | null;
        setItem: (key: string, value: string) => void;
        removeItem: (key: string) => void;
      };
    };
  }
).window = {
  localStorage: {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  },
};

import {
  PWA_DISMISS_KEY,
  PWA_DISMISS_MS,
  PWA_INSTALLED_KEY,
  isPwaInstallDismissed,
  isPwaMarkedInstalled,
  markPwaInstallDismissed,
  markPwaInstalled,
} from "./install-storage";

test("pwa install: missing dismissal is not dismissed", () => {
  store.clear();
  assert.equal(isPwaInstallDismissed(), false);
});

test("pwa install: honours 30-day dismissal window", () => {
  store.clear();
  const now = Date.UTC(2026, 6, 26);
  markPwaInstallDismissed(now);
  assert.equal(isPwaInstallDismissed(now + 1000), true);
  assert.equal(isPwaInstallDismissed(now + PWA_DISMISS_MS + 1), false);
  assert.ok(store.get(PWA_DISMISS_KEY));
});

test("pwa install: marks installed and clears dismissal", () => {
  store.clear();
  markPwaInstallDismissed();
  markPwaInstalled();
  assert.equal(isPwaMarkedInstalled(), true);
  assert.equal(store.get(PWA_DISMISS_KEY), undefined);
  assert.equal(store.get(PWA_INSTALLED_KEY), "1");
});
