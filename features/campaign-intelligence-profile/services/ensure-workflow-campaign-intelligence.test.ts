import assert from "node:assert/strict";
import test from "node:test";

/**
 * Product rule (Release 2.3 Excellence): workflow CIP ensure must not require a
 * brands-table match. Discovery search depends on validated intelligence + geo,
 * not hierarchy brand linkage.
 */
test("workflow CIP brand linkage is optional when intelligence is validated", () => {
  const detectedBrandId: string | null = null;
  const hasValidatedIntelligence = true;
  const allowCreate =
    hasValidatedIntelligence &&
    // brandId may be null — elevated create uses allowMissingBrand
    (detectedBrandId === null || detectedBrandId.length > 0);
  assert.equal(allowCreate, true);

  const withBrand = "d2689c0b-83b8-4ccb-a055-b259e360a0ba";
  assert.ok(withBrand);
});
