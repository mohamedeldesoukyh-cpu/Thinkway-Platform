import assert from "node:assert/strict";

import { buildTimelineSectionData } from "@/features/campaign-intelligence/services/structured-section-builders";
import { buildTimelineSectionExtras } from "@/features/campaign-intelligence/services/studio-section-data-builders";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import { resolveTimelineData } from "@/features/campaign-studio/services/section-data-resolver";
import {
  buildTimelineWeeksForCampaign,
  mergeMilestonesIntoWeeks,
} from "@/features/campaign-studio/services/presentation-intelligence";
import {
  clampCampaignDurationWeeks,
  countGoLivePhases,
  MAX_CAMPAIGN_DURATION_WEEKS,
  MIN_CAMPAIGN_DURATION_WEEKS,
  parseOptionalDurationWeeks,
  resolveCampaignDurationWeeks,
  resolveGoLiveWeek,
} from "@/features/campaign-studio/services/timeline-duration";
import type { CampaignObject } from "@/features/campaign-intelligence/types/campaign-object";

const TEN_WEEK_TIMELINE = [
  "Week 1: Brief approval",
  "Week 2: Vendor outreach",
  "Week 3: Creator selection",
  "Week 4: Content planning",
  "Week 5: Production kickoff",
  "Week 6: Content production",
  "Week 7: Content review",
  "Week 8: Pre-launch QA",
  "Week 9: Go-live",
  "Week 10: Final report",
].join("\n");

const TEST_DURATIONS = [1, 3, 5, 7, 10, 13, 26, 52] as const;

function summaryForDuration(weeks: number): string {
  return `Brand: BabyJoy\nDuration: ${weeks} weeks\nObjective: Awareness`;
}

function strategyForDuration(weeks: number): string {
  return `Campaign duration ${weeks} weeks with phased creator activation.`;
}

function buildCampaignObject(durationWeeks: number): CampaignObject {
  const summaryText = summaryForDuration(durationWeeks);
  const strategyText = strategyForDuration(durationWeeks);
  const timelineContent = buildTimelineSectionData(TEN_WEEK_TIMELINE);
  const timelineExtras = buildTimelineSectionExtras(timelineContent, strategyText, summaryText);
  const object = createEmptyCampaignObject({
    id: "test-campaign",
    conversationId: "test-conversation",
    workflowId: "create-campaign",
  });

  object.meta.status = "complete";
  object.sections.summary = {
    content: summaryText,
    status: "complete",
    data: {
      summaryCards: {
        brand: "BabyJoy",
        duration: `${durationWeeks} weeks`,
        objective: "Awareness",
      },
    },
  };
  object.sections.strategy = { content: strategyText, status: "complete" };
  object.sections.timeline = {
    content: {
      ...timelineContent,
      durationWeeks,
      goLiveWeek: resolveGoLiveWeek(durationWeeks),
    },
    data: timelineExtras,
    status: "complete",
  };

  return object;
}

function testDurationClamping(): void {
  assert.equal(clampCampaignDurationWeeks(0), MIN_CAMPAIGN_DURATION_WEEKS, "clamp 0 to min");
  assert.equal(clampCampaignDurationWeeks(-5), MIN_CAMPAIGN_DURATION_WEEKS, "clamp negative to min");
  assert.equal(clampCampaignDurationWeeks(100), MAX_CAMPAIGN_DURATION_WEEKS, "clamp 100 to max");
  assert.equal(clampCampaignDurationWeeks(7.6), 8, "round and clamp fractional weeks");
}

function testDurationResolution(): void {
  for (const weeks of TEST_DURATIONS) {
    const resolved = resolveCampaignDurationWeeks(summaryForDuration(weeks), strategyForDuration(weeks));
    assert.equal(resolved, weeks, `resolveCampaignDurationWeeks(${weeks})`);
    assert.equal(clampCampaignDurationWeeks(weeks), weeks, `clampCampaignDurationWeeks(${weeks})`);
  }

  const fromTenWeekTimeline = resolveCampaignDurationWeeks(
    summaryForDuration(4),
    strategyForDuration(4),
    TEN_WEEK_TIMELINE
  );
  assert.equal(fromTenWeekTimeline, 4, "summary duration wins over 10-week timeline text");
}

function testTimelineGeneration(durationWeeks: number): void {
  const summaryText = summaryForDuration(durationWeeks);
  const strategyText = strategyForDuration(durationWeeks);
  const timelineContent = buildTimelineSectionData(TEN_WEEK_TIMELINE);
  const { weeks, goLiveWeek } = buildTimelineWeeksForCampaign(
    durationWeeks,
    "baby",
    timelineContent.milestones
  );

  assert.equal(weeks.length, durationWeeks, `${durationWeeks}-week campaign week count`);
  assert.equal(countGoLivePhases(weeks), 1, `${durationWeeks}-week campaign single go-live`);
  assert.equal(goLiveWeek, resolveGoLiveWeek(durationWeeks), `${durationWeeks}-week go-live week`);
  if (durationWeeks > 1) {
    assert.match(
      weeks[weeks.length - 1]?.phase ?? "",
      /report|campaign end/i,
      `${durationWeeks}-week final reporting on last week`
    );
  }

  const extras = buildTimelineSectionExtras(timelineContent, strategyText, summaryText);
  assert.equal(extras.weekDetails?.length, durationWeeks, `${durationWeeks}-week extras weekDetails`);

  const resolved = resolveTimelineData(buildCampaignObject(durationWeeks));
  assert.ok(resolved, `${durationWeeks}-week resolveTimelineData`);
  assert.equal(resolved!.durationWeeks, durationWeeks, `${durationWeeks}-week resolved duration`);
  assert.equal(resolved!.weeks.length, durationWeeks, `${durationWeeks}-week resolved weeks`);
  assert.equal(countGoLivePhases(resolved!.weeks), 1, `${durationWeeks}-week resolved go-live count`);
}

function testOneWeekCampaign(): void {
  const { weeks, goLiveWeek } = buildTimelineWeeksForCampaign(1, "baby");
  assert.equal(weeks.length, 1);
  assert.equal(goLiveWeek, 1);
  assert.equal(countGoLivePhases(weeks), 1);
  assert.match(weeks[0]?.phase ?? "", /publishing|go[- ]?live|report/i);
}

function testMilestoneTrimming(): void {
  const durationWeeks = 4;
  const derived = buildTimelineWeeksForCampaign(durationWeeks, "baby").weeks;
  const merged = mergeMilestonesIntoWeeks(
    derived,
    buildTimelineSectionData(TEN_WEEK_TIMELINE).milestones,
    durationWeeks,
    resolveGoLiveWeek(durationWeeks)
  );
  assert.equal(merged.length, 4);
  assert.equal(countGoLivePhases(merged), 1);
}

function testOptionalDurationParsing(): void {
  assert.equal(parseOptionalDurationWeeks("Duration: 1 month"), 4);
  assert.equal(parseOptionalDurationWeeks("6 weeks"), 6);
  assert.equal(parseOptionalDurationWeeks("no duration here"), undefined);
}

function testFactsWinOverStaleActivation(): void {
  const object = buildCampaignObject(4);
  object.meta.campaignFacts = {
    brandName: "BabyJoy",
    durationWeeks: 6,
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
  object.sections.timeline.data = {
    ...(object.sections.timeline.data as object),
    creatorActivationTimeline: {
      durationWeeks: 4,
      activationWeeks: [1, 2, 3, 4].map((week) => ({
        week,
        tier: "Macro",
        objective: `Week ${week}`,
        reason: "stale",
        evidence: "stored",
        tradeoff: "none",
        confidence: 0.5,
      })),
      reportingPhase: { label: "Reporting", reason: "end", evidence: "stored" },
    },
  };

  const resolved = resolveTimelineData(object);
  assert.ok(resolved);
  assert.equal(resolved!.durationWeeks, 6, "facts duration wins over stored 4-week activation");
  assert.equal(resolved!.weeks.length, 6, "week count follows facts duration");
}

function run(): void {
  testDurationClamping();
  testDurationResolution();
  testOptionalDurationParsing();
  testOneWeekCampaign();
  for (const weeks of TEST_DURATIONS) {
    testTimelineGeneration(weeks);
  }
  testMilestoneTrimming();
  testFactsWinOverStaleActivation();
  console.log(`timeline-duration.test.ts: PASS (${TEST_DURATIONS.join("/")} weeks validated)`);
}

run();
