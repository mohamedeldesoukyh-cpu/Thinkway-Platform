import { describe, expect, it } from "vitest";

import { studioSectionProgressivePhase } from "./progressive-load";
import { estimateViewportHydrationSeedCount } from "../../features/campaign-studio/hooks/use-viewport-creator-ids";

describe("progressive-load phases", () => {
  it("classifies Studio sections into load phases", () => {
    expect(studioSectionProgressivePhase("campaign-summary")).toBe(1);
    expect(studioSectionProgressivePhase("creator-recommendations")).toBe(1);
    expect(studioSectionProgressivePhase("executive-strategy")).toBe(2);
    expect(studioSectionProgressivePhase("kpi-forecast")).toBe(3);
  });
});

describe("viewport hydration seed", () => {
  it("derives an adaptive seed from viewport height (no fixed product batch)", () => {
    const seed = estimateViewportHydrationSeedCount();
    expect(seed).toBeGreaterThanOrEqual(3);
    expect(seed).toBeLessThanOrEqual(12);
  });
});
