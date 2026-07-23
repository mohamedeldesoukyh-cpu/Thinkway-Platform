import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildEntityDetailPath,
  buildEntityRouteKey,
  entityShortId,
  parseEntityRouteKey,
  shouldRedirectEntityRoute,
  slugifyDisplayName,
} from "./entity-slug";

const SAMPLE_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

describe("slugifyDisplayName", () => {
  it("slugifies display names", () => {
    assert.equal(slugifyDisplayName("NBK Summer 2026"), "nbk-summer-2026");
    assert.equal(slugifyDisplayName("  Hello — World!  "), "hello-world");
  });
});

describe("entityShortId", () => {
  it("returns first 8 hex chars", () => {
    assert.equal(entityShortId(SAMPLE_UUID), "a1b2c3d4");
  });
});

describe("parseEntityRouteKey", () => {
  it("detects uuid route keys", () => {
    assert.deepEqual(parseEntityRouteKey(SAMPLE_UUID), {
      kind: "uuid",
      uuid: SAMPLE_UUID,
    });
  });

  it("detects document numbers", () => {
    assert.deepEqual(parseEntityRouteKey("TW-2026-0042"), {
      kind: "documentNumber",
      value: "TW-2026-0042",
    });
  });

  it("detects slug-shortId keys", () => {
    assert.deepEqual(parseEntityRouteKey("nbk-summer-2026-a1b2c3d4"), {
      kind: "slugShortId",
      slug: "nbk-summer-2026",
      shortId: "a1b2c3d4",
    });
  });
});

describe("buildEntityRouteKey", () => {
  it("prefers slug-shortId when slug is available", () => {
    assert.equal(
      buildEntityRouteKey({
        id: SAMPLE_UUID,
        slug: "nbk-summer-2026",
        displayName: "NBK Summer 2026",
        documentNumber: "TW-2026-0042",
      }),
      "nbk-summer-2026-a1b2c3d4"
    );
  });
});

describe("buildEntityDetailPath", () => {
  it("builds encoded detail paths", () => {
    assert.equal(
      buildEntityDetailPath("/campaigns", {
        id: SAMPLE_UUID,
        slug: "nbk-summer-2026",
      }),
      "/campaigns/nbk-summer-2026-a1b2c3d4"
    );
  });
});

describe("shouldRedirectEntityRoute", () => {
  it("flags non-canonical route keys", () => {
    assert.equal(shouldRedirectEntityRoute(SAMPLE_UUID, "nbk-summer-2026-a1b2c3d4"), true);
    assert.equal(
      shouldRedirectEntityRoute("nbk-summer-2026-a1b2c3d4", "nbk-summer-2026-a1b2c3d4"),
      false
    );
  });
});
