import type { CampaignPlanningInput, AudienceStrategy } from "./types";

function parseAudienceHints(audience?: string | null): {
  gender?: string;
  ageRange?: string;
  interests: string[];
} {
  const text = (audience ?? "").toLowerCase();
  const gender = text.includes("women") || text.includes("female") ? "female" : text.includes("men") || text.includes("male") ? "male" : undefined;
  const ageMatch = text.match(/(\d{2})\s*[-–]\s*(\d{2})/);
  const ageRange = ageMatch ? `${ageMatch[1]}-${ageMatch[2]}` : text.includes("gen z") ? "18-24" : text.includes("millennial") ? "25-40" : undefined;
  const interests = ["beauty", "fitness", "food", "tech", "parenting", "fashion"]
    .filter((tag) => text.includes(tag))
    .slice(0, 3);
  return { gender, ageRange, interests };
}

export function buildAudienceStrategy(input: CampaignPlanningInput): AudienceStrategy {
  const geography = input.brief.geography ?? [];
  const hints = parseAudienceHints(input.brief.audience);
  const gaps: string[] = [];

  if (!geography.length) gaps.push("No target geography specified — Discovery will use broad country filters.");
  if (!hints.ageRange) gaps.push("Age range not specified in brief audience text.");
  if (!hints.interests.length) gaps.push("Interest categories not explicit — category filters may be broad.");

  const segments = [
    {
      label: "Primary audience",
      geography: geography.length ? geography : undefined,
      language: geography.some((g) => /egypt|mena|saudi|uae/i.test(g)) ? ["ar", "en"] : ["en"],
      gender: hints.gender ?? null,
      ageRange: hints.ageRange ?? "18-34",
      interests: hints.interests.length ? hints.interests : ["lifestyle"],
      percent: 70,
      reasoning: [
        input.brief.audience ? `Derived from brief audience: ${input.brief.audience}` : "Default primary segment for general campaigns.",
        geography.length ? `Geography: ${geography.join(", ")}` : "Geography open — refine before Discovery.",
      ],
    },
    {
      label: "Secondary reach segment",
      geography: geography.length ? geography : undefined,
      language: ["en"],
      gender: null,
      ageRange: "25-44",
      interests: hints.interests,
      percent: 30,
      reasoning: ["Secondary segment expands reach without diluting core targeting."],
    },
  ];

  return {
    segments,
    gaps,
    recommendations: segments.map((segment) => ({
      label: segment.label,
      value: `${segment.percent}% audience weight`,
      reasoning: segment.reasoning,
      influencedBy: [input.brief.audience ?? "general audience", ...(input.brief.geography ?? [])],
      constraintsApplied: input.brief.constraints ?? [],
      principlesUsed: ["Decision audience quality scoring", "Optimization audience alignment"],
    })),
  };
}
