import { DEFAULT_DURATION_WEEKS } from "./config";
import { objectiveKey } from "./creator-mix";
import type { CampaignPlanningInput, CreatorMixStrategy, TimelineStrategy } from "./types";

export function buildTimelineStrategy(
  input: CampaignPlanningInput,
  creatorMix: CreatorMixStrategy
): TimelineStrategy {
  const durationWeeks = input.brief.durationWeeks ?? DEFAULT_DURATION_WEEKS;
  const objective = objectiveKey(input.brief.objective);
  const mode: TimelineStrategy["mode"] =
    durationWeeks <= 4 ? "burst" : durationWeeks >= 10 ? "always_on" : "hybrid";

  const waveCount = mode === "burst" ? 2 : mode === "always_on" ? 3 : 3;
  const weeksPerWave = Math.max(1, Math.floor(durationWeeks / waveCount));

  const anchorTiers = creatorMix.tiers
    .filter((t) => ["Macro", "Mega", "Celebrity"].includes(t.tier))
    .map((t) => t.tier);
  const engagementTiers = creatorMix.tiers
    .filter((t) => ["Micro", "Nano", "Mid"].includes(t.tier))
    .map((t) => t.tier);

  const waves = Array.from({ length: waveCount }, (_, index) => {
    const weekStart = index * weeksPerWave + 1;
    const weekEnd = index === waveCount - 1 ? durationWeeks : (index + 1) * weeksPerWave;
    const isLaunch = index === 0;
    return {
      wave: index + 1,
      weekStart,
      weekEnd,
      focus: isLaunch ? "Launch burst — hero creators" : index === waveCount - 1 ? "Sustain & retarget" : "Momentum build",
      cadence: isLaunch ? "3–4 posts/week" : "2–3 posts/week",
      creatorTiers: isLaunch ? anchorTiers.length ? anchorTiers : ["Macro", "Mid"] : engagementTiers.length ? engagementTiers : ["Micro", "Nano"],
      reasoning: [
        isLaunch
          ? "Wave 1 concentrates anchor creators for awareness spike."
          : "Later waves maintain engagement efficiency.",
        `Duration ${durationWeeks} weeks supports ${mode} activation model.`,
      ],
    };
  });

  return {
    durationWeeks,
    mode,
    waves,
    postingCadence: mode === "burst" ? "Intensive first 2 weeks, taper thereafter" : "Steady weekly cadence across waves",
    peakWindows: ["Tuesday–Thursday evenings", "Weekend morning short-form peaks"],
    recommendations: [
      {
        label: "Activation model",
        value: mode,
        reasoning: [`${objective} objective with ${durationWeeks}-week duration.`],
        influencedBy: [input.brief.objective ?? "awareness", `${durationWeeks} weeks`],
        constraintsApplied: input.brief.constraints ?? [],
        principlesUsed: ["Decision timeline feasibility", "Optimization posting cadence assumptions"],
      },
    ],
  };
}
