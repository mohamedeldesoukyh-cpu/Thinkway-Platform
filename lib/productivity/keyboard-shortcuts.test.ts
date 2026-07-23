import assert from "node:assert/strict";
import test from "node:test";

import { isNativeEditShortcut } from "./keyboard-shortcuts";

function keyEvent(
  init: Partial<KeyboardEvent> & { key: string }
): KeyboardEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  } as KeyboardEvent;
}

test("allows clipboard and undo shortcuts through", () => {
  for (const key of ["c", "x", "v", "a", "z", "y"] as const) {
    assert.equal(isNativeEditShortcut(keyEvent({ key, ctrlKey: true })), true);
  }
});

test("keeps app save/submit shortcuts available to the handler", () => {
  assert.equal(isNativeEditShortcut(keyEvent({ key: "s", ctrlKey: true })), false);
  assert.equal(isNativeEditShortcut(keyEvent({ key: "Enter", ctrlKey: true })), false);
});

test("keeps ctrl+shift+a available for workspace select-all", () => {
  assert.equal(
    isNativeEditShortcut(keyEvent({ key: "A", ctrlKey: true, shiftKey: true })),
    false
  );
});

test("does not throw when keyboard events omit key", () => {
  const event = {
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    code: "KeyS",
  } as KeyboardEvent;

  assert.doesNotThrow(() => isNativeEditShortcut(event));
  assert.equal(isNativeEditShortcut(event), false);
});
