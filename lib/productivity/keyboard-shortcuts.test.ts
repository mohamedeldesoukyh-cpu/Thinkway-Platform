import { describe, expect, it } from "vitest";

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

describe("isNativeEditShortcut", () => {
  it("allows clipboard and undo shortcuts through", () => {
    for (const key of ["c", "x", "v", "a", "z", "y"] as const) {
      expect(
        isNativeEditShortcut(
          keyEvent({ key, ctrlKey: true })
        )
      ).toBe(true);
    }
  });

  it("keeps app save/submit shortcuts available to the handler", () => {
    expect(isNativeEditShortcut(keyEvent({ key: "s", ctrlKey: true }))).toBe(false);
    expect(isNativeEditShortcut(keyEvent({ key: "Enter", ctrlKey: true }))).toBe(false);
  });

  it("keeps ctrl+shift+a available for workspace select-all", () => {
    expect(
      isNativeEditShortcut(
        keyEvent({ key: "A", ctrlKey: true, shiftKey: true })
      )
    ).toBe(false);
  });
});
