import assert from "node:assert/strict";
import test from "node:test";

import { resolveDatasetAcquisitionMaxCreators } from "@/lib/discovery/dataset-acquisition-config";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void
): void {
  const keys = Object.keys(patch);
  const prior: Record<string, string | undefined> = {};
  for (const key of keys) {
    prior[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      const value = prior[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("defaults to 70 when broadenCreatorDiscovery is true", () => {
  assert.equal(
    resolveDatasetAcquisitionMaxCreators({
      acquisitionHints: { broadenCreatorDiscovery: true },
    } as never),
    70
  );
});

test("defaults to 50 when broadenCreatorDiscovery is false", () => {
  assert.equal(
    resolveDatasetAcquisitionMaxCreators({
      acquisitionHints: { broadenCreatorDiscovery: false },
    } as never),
    50
  );
});

test("uses DATASET_ACQUISITION_MAX_CREATORS when set", () => {
  withEnv({ DATASET_ACQUISITION_MAX_CREATORS: "40" }, () => {
    assert.equal(resolveDatasetAcquisitionMaxCreators(), 40);
  });
});
