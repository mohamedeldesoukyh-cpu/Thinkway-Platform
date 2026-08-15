import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { closeCompanionWindow, openCompanionWindow } from "./open-companion-window";

const originalWindow = globalThis.window;

afterEach(() => {
  if (originalWindow) {
    globalThis.window = originalWindow;
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

describe("openCompanionWindow", () => {
  it("opens a named full-size popup and focuses it", () => {
    const opened = {
      closed: false,
      focused: false,
      focus() {
        this.focused = true;
      },
    };
    const calls: unknown[][] = [];

    globalThis.window = {
      innerWidth: 1440,
      innerHeight: 900,
      screen: { availWidth: 1920, availHeight: 1080 },
      open(...args: unknown[]) {
        calls.push(args);
        return opened;
      },
    } as unknown as Window;

    const result = openCompanionWindow("/campaigns/tw/media-plan?popup=1", "thinkway-media-plan-1");
    assert.equal(result, opened);
    assert.equal(opened.focused, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.[0], "/campaigns/tw/media-plan?popup=1");
    assert.equal(calls[0]?.[1], "thinkway-media-plan-1");
    const features = String(calls[0]?.[2] ?? "");
    assert.match(features, /popup=yes/);
    assert.match(features, /width=1920/);
    assert.match(features, /height=1080/);
  });
});

describe("closeCompanionWindow", () => {
  it("closes the current window", () => {
    let closed = false;
    globalThis.window = {
      closed: false,
      close() {
        closed = true;
        this.closed = true;
      },
    } as unknown as Window;

    assert.equal(closeCompanionWindow(), true);
    assert.equal(closed, true);
  });
});
