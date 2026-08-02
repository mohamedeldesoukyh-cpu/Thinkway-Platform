import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enrichHistoricalSeries } from "@/lib/enterprise-creator-intelligence/historical/explainability";
import { computeCreatorInvestmentIntelligence } from "@/lib/enterprise-creator-intelligence/investment/compute";
import {
  clampConfidenceToEvidence,
  historicalEvidenceCoverage,
  investmentEvidenceCoverage,
} from "@/lib/enterprise-creator-intelligence/shared/evidence-coverage";
import {
  createEciFactsCache,
  type EciFactsCacheStats,
} from "@/lib/enterprise-creator-intelligence/shared/facts-cache";
import {
  ECI_CANONICAL_ENTRY,
  ECI_PLATFORM_CONSUMERS,
  FORBIDDEN_ENTERPRISE_INTELLIGENCE_SSOT,
  isForbiddenEnterpriseIntelligencePath,
} from "@/lib/enterprise-creator-intelligence/ssot-policy";

describe("Enterprise Creator Intelligence — Freeze Closure (G1–G3 + Evidence)", () => {
  it("G1: declares platform SSOT entry and forbids Discovery/legacy investment paths", () => {
    assert.equal(ECI_CANONICAL_ENTRY, "loadCreatorIntelligenceBundle");
    assert.ok(ECI_PLATFORM_CONSUMERS.includes("Planning Workspace"));
    assert.ok(ECI_PLATFORM_CONSUMERS.includes("Client Workspace"));
    assert.ok(ECI_PLATFORM_CONSUMERS.includes("Campaign Workspace"));
    assert.ok(ECI_PLATFORM_CONSUMERS.includes("Reporting Hub"));
    assert.ok(ECI_PLATFORM_CONSUMERS.includes("Enterprise Analytics"));
    assert.ok(ECI_PLATFORM_CONSUMERS.includes("AI Copilot"));
    assert.ok(ECI_PLATFORM_CONSUMERS.includes("Mobile"));
    assert.ok(ECI_PLATFORM_CONSUMERS.includes("Discovery Investment Display"));
    assert.ok(
      isForbiddenEnterpriseIntelligencePath("lib/creators/thinkway-score.ts")
    );
    assert.ok(
      FORBIDDEN_ENTERPRISE_INTELLIGENCE_SSOT.some(
        (e) => e.id === "discovery_thinkway_score"
      )
    );
    assert.ok(
      FORBIDDEN_ENTERPRISE_INTELLIGENCE_SSOT.some(
        (e) => e.id === "campaign_decision_simulator_score"
      )
    );
  });

  it("G2: Historical remains series foundation with lightweight explainability wrapper", () => {
    const series = enrichHistoricalSeries({
      influencerId: "inf-h",
      platform: "instagram",
      months: [],
    });
    assert.ok(series.evidenceCoverage);
    assert.ok(series.explainability.businessContext.includes("foundation"));
    assert.equal(Array.isArray(series.months), true);
    assert.ok(series.explainability.missingInputs.includes("monthly_metrics"));
  });

  it("Evidence Coverage is distinct from Confidence and caps confidence", () => {
    const coverage = historicalEvidenceCoverage({
      monthCount: 1,
      sampleCaptureCount: 1,
    });
    assert.ok(coverage.percent != null);
    assert.ok((coverage.percent as number) < 100);

    assert.equal(clampConfidenceToEvidence(94, 82), 82);
    assert.equal(clampConfidenceToEvidence(50, 82), 50);
    assert.equal(clampConfidenceToEvidence(90, null), null);

    const investment = computeCreatorInvestmentIntelligence({
      influencerId: "inf-ev",
      platform: "instagram",
      computedAt: "2026-08-02T00:00:00.000Z",
      historicalMonthly: [],
      commercial: null,
      categoryBrand: null,
      performance: null,
      audience: null,
    });
    assert.ok(investment.evidenceCoverage);
    assert.ok(investment.recommendation.confidence);
    const conf = investment.recommendation.confidence.percent;
    const ev = investment.evidenceCoverage.percent;
    if (conf != null && ev != null) {
      assert.ok(
        conf <= ev,
        `Confidence ${conf} must not exceed Evidence Coverage ${ev}`
      );
    }

    const low = investmentEvidenceCoverage({
      layerFlags: {
        historical: false,
        commercial: false,
        categoryBrand: false,
        performance: false,
        audience: false,
      },
      scoredDimensionCount: 0,
      totalDimensions: 13,
    });
    assert.ok(low.percent != null);
    assert.ok((low.percent as number) < 40);
  });

  it("G3: shared cache computes once and reuses across consumers", async () => {
    const cache = createEciFactsCache();
    let computes = 0;
    const factory = async () => {
      computes += 1;
      return { value: 42 };
    };

    const planning = await cache.getOrCompute(
      "intelligence_bundle",
      "c1",
      "instagram",
      factory
    );
    const client = await cache.getOrCompute(
      "intelligence_bundle",
      "c1",
      "instagram",
      factory
    );
    const reporting = await cache.getOrCompute(
      "intelligence_bundle",
      "c1",
      "instagram",
      factory
    );
    assert.equal(planning.value, 42);
    assert.equal(client.value, 42);
    assert.equal(reporting.value, 42);
    assert.equal(computes, 1);
    assert.deepEqual(planning, client);
    assert.deepEqual(client, reporting);
    const stats = cache.stats();
    assert.equal(stats.computes, 1);
    assert.equal(stats.hits, 2);
    assert.equal(stats.misses, 1);
  });

  it("Performance benchmark: cache scales for 100 / 500 / 1000 creators without duplicate compute", async () => {
    async function bench(n: number): Promise<EciFactsCacheStats> {
      const cache = createEciFactsCache();
      let factoryCalls = 0;
      const ids = Array.from({ length: n }, (_, i) => `creator-${i}`);

      for (const id of ids) {
        await cache.getOrCompute("intelligence_bundle", id, null, async () => {
          factoryCalls += 1;
          return { id, score: factoryCalls };
        });
      }
      for (const _consumer of ["Planning", "Client", "Reporting"] as const) {
        for (const id of ids) {
          await cache.getOrCompute(
            "intelligence_bundle",
            id,
            null,
            async () => {
              factoryCalls += 1;
              return { id, score: -1 };
            }
          );
        }
      }

      assert.equal(
        factoryCalls,
        n,
        `expected ${n} computes, got ${factoryCalls}`
      );
      const stats = cache.stats();
      assert.equal(stats.computes, n);
      assert.equal(stats.hits, n * 3);
      return stats;
    }

    const s100 = await bench(100);
    const s500 = await bench(500);
    const s1000 = await bench(1000);
    assert.equal(s100.computes, 100);
    assert.equal(s500.computes, 500);
    assert.equal(s1000.computes, 1000);
  });
});
