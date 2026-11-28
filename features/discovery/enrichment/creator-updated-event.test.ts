import test from "node:test";
import assert from "node:assert/strict";
import { CREATOR_UPDATED_EVENT, notifyCreatorUpdated, subscribeCreatorUpdates } from "./creator-updated-event";

test("enrichment refresh signals same-tab and other-tab searches and unsubscribes cleanly", () => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget();
  const writes: string[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(target, {
    localStorage: { setItem: (key: string, value: string) => writes.push(`${key}=${value}`) },
  }) });
  try {
    let refreshes = 0;
    const unsubscribe = subscribeCreatorUpdates(() => refreshes++);
    notifyCreatorUpdated();
    assert.equal(refreshes, 1);
    assert.equal(writes.length, 1);
    assert.ok(writes[0].startsWith(CREATOR_UPDATED_EVENT));
    const storage = new Event("storage");
    Object.defineProperty(storage, "key", { value: CREATOR_UPDATED_EVENT });
    target.dispatchEvent(storage);
    assert.equal(refreshes, 2);
    unsubscribe();
    notifyCreatorUpdated();
    target.dispatchEvent(storage);
    assert.equal(refreshes, 2);
  } finally {
    if (prior) Object.defineProperty(globalThis, "window", prior);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
