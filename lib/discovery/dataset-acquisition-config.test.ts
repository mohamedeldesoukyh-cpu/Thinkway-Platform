import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveDatasetAcquisitionMaxCreators } from "@/lib/discovery/dataset-acquisition-config";

describe("resolveDatasetAcquisitionMaxCreators", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to 70 when broadenCreatorDiscovery is true", () => {
    expect(
      resolveDatasetAcquisitionMaxCreators({
        acquisitionHints: { broadenCreatorDiscovery: true },
      } as never)
    ).toBe(70);
  });

  it("defaults to 50 when broadenCreatorDiscovery is false", () => {
    expect(
      resolveDatasetAcquisitionMaxCreators({
        acquisitionHints: { broadenCreatorDiscovery: false },
      } as never)
    ).toBe(50);
  });

  it("uses DATASET_ACQUISITION_MAX_CREATORS when set", () => {
    vi.stubEnv("DATASET_ACQUISITION_MAX_CREATORS", "40");
    expect(resolveDatasetAcquisitionMaxCreators()).toBe(40);
  });
});
