import assert from "node:assert/strict";
import test from "node:test";

import type { ContentContext } from "./content-context";
import {
  buildCreatorContentContext,
  deriveCreatorTreatment,
  validateCreatorTreatmentAiOutput,
} from "./creator-content-context";
import type { CreatorContentEvidence } from "./creator-content-evidence";
import { projectCreatorContentEvidence } from "./creator-content-evidence";
import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { wrapValue } from "@/features/creator-dna/services/field-envelope";

const creator = {
  creatorId: "inf:creator-a",
  creatorName: "Creator A",
  creatorRole: "Macro",
  platform: "Instagram",
  whySelected: "Matches the campaign audience.",
  status: "proposed" as const,
};

function contentContext(): ContentContext {
  return {
    strategy: { basisStatus: "CURRENT", creativeConcepts: [], creatorMix: [] },
    readiness: { status: "READY", blockers: [], warnings: [] },
    objective: "Build consideration",
    audience: "Egyptian adults",
    keyMessages: ["Show the product benefit"],
    cta: "Apply today",
    kpis: ["Reach"],
    legacyCompatibility: false,
    platforms: [{ platform: "Instagram", priority: "primary" }],
    deliverables: ["Instagram Reel"],
    creators: [creator],
    constraints: [],
    requirements: [
      {
        id: "disclaimer",
        concept: "mandatory_disclaimer",
        label: "Disclaimer",
        value: "Terms apply",
        origin: "SOURCE_STATED",
        status: "confirmed",
        evidence: [],
      },
      {
        id: "claim",
        concept: "prohibited_claim",
        label: "Prohibited claim",
        value: "Guaranteed results",
        origin: "SOURCE_STATED",
        status: "confirmed",
        evidence: [],
      },
    ],
  };
}

function evidence(
  category: string | undefined,
  publications: string[] = [],
  options: { interests?: string[]; duplicateFirstPublication?: boolean } = {}
): CreatorContentEvidence {
  const recentPublications = publications.map((caption, index) => ({
    id: `dna:publication:${index + 1}`,
    caption,
    provenance: "OBSERVED" as const,
  }));
  if (options.duplicateFirstPublication && recentPublications[0]) {
    recentPublications.push({ ...recentPublications[0] });
  }
  return {
    creatorId: "creator-a",
    platform: "Instagram",
    categories: category ? [category] : [],
    interests: options.interests ?? [],
    languages: ["Arabic"],
    recentPublications,
    evidenceRefs: [
      { id: "dna:categories", label: "Creator category signals", provenance: "OBSERVED", freshness: "2026-09-01" },
      { id: "dna:recent-publications", label: "Recent publication evidence", provenance: "OBSERVED", freshness: "2026-09-01" },
    ],
    freshness: "2026-09-01",
  };
}

test("evidence strength uses independent, treatment-relevant Creator DNA signals", () => {
  const cases: Array<{
    name: string;
    creatorEvidence?: CreatorContentEvidence;
    baseConcept?: string;
    expected: "none" | "weak" | "medium" | "strong";
  }> = [
    { name: "A: no creator evidence", expected: "none" },
    { name: "B: category only", creatorEvidence: evidence("beauty"), expected: "weak" },
    { name: "C: one relevant observed publication", creatorEvidence: evidence(undefined, ["fitness tutorial"]), baseConcept: "fitness tutorial", expected: "weak" },
    { name: "D: category plus one relevant publication", creatorEvidence: evidence("beauty", ["beauty tutorial"]), expected: "medium" },
    { name: "E: derived interest only", creatorEvidence: evidence(undefined, [], { interests: ["beauty"] }), expected: "weak" },
    { name: "F: category plus two distinct relevant publications", creatorEvidence: evidence("beauty", ["beauty tutorial", "beauty routine"]), expected: "strong" },
    { name: "G: three distinct relevant publications", creatorEvidence: evidence(undefined, ["fitness tutorial", "fitness routine", "fitness guide"]), baseConcept: "fitness", expected: "strong" },
    { name: "H: unrelated publications do not strengthen a category", creatorEvidence: evidence("beauty", ["travel diary", "travel packing"]), expected: "weak" },
    { name: "I: duplicate publication references count once", creatorEvidence: evidence("beauty", ["beauty tutorial"], { duplicateFirstPublication: true }), expected: "medium" },
    { name: "J: profile metadata and reference count do not inflate strength", creatorEvidence: evidence(undefined), expected: "none" },
    { name: "K: sparse fallback remains explicit", creatorEvidence: evidence(undefined, ["travel diary"]), baseConcept: "fitness", expected: "none" },
  ];

  for (const item of cases) {
    const treatment = deriveCreatorTreatment(
      buildCreatorContentContext({ content: contentContext(), creator, evidence: item.creatorEvidence }),
      { baseFormat: "Instagram Reel", baseHook: "See it work", baseConcept: item.baseConcept ?? "Demonstrate the benefit" }
    );
    assert.equal(treatment.evidenceStrength, item.expected, item.name);
    assert.doesNotMatch(JSON.stringify(treatment), /performance|reach|engagement/i, item.name);
  }
});

test("creator treatment remains bounded and materially changes only with grounded evidence", () => {
  const sparse = deriveCreatorTreatment(buildCreatorContentContext({ content: contentContext(), creator }), {
    baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit",
  });
  const beauty = deriveCreatorTreatment(buildCreatorContentContext({ content: contentContext(), creator, evidence: evidence("beauty") }), {
    baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit",
  });
  assert.equal(sparse.evidenceStrength, "none");
  assert.match(sparse.creatorAdaptation ?? "", /limited/i);
  assert.equal(beauty.evidenceStrength, "weak");
  assert.notEqual(beauty.contentAngle, sparse.contentAngle);
  assert.match(beauty.contentAngle ?? "", /beauty/i);
  assert.deepEqual(beauty.mandatoryInclusions, ["Terms apply"]);
  assert.deepEqual(beauty.prohibitedPoints, ["Guaranteed results"]);
  assert.ok(beauty.evidenceRefs?.every((ref) => ref.provenance));
  assert.equal(JSON.stringify(beauty).includes("recentPublications"), false);
});

test("broad category mentions need an observable content pattern before a publication qualifies", () => {
  const incidental = deriveCreatorTreatment(
    buildCreatorContentContext({ content: contentContext(), creator, evidence: evidence("beauty", ["Traveling with my beauty bag"]) }),
    { baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit" }
  );
  const tutorial = deriveCreatorTreatment(
    buildCreatorContentContext({ content: contentContext(), creator, evidence: evidence("beauty", ["Beauty tutorial: three makeup steps"]) }),
    { baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit" }
  );

  assert.equal(incidental.evidenceStrength, "weak");
  assert.equal(incidental.evidenceRefs?.some((ref) => ref.id === "dna:publication:1"), false);
  assert.equal(tutorial.evidenceStrength, "medium");
  assert.equal(tutorial.evidenceRefs?.some((ref) => ref.id === "dna:publication:1"), true);
});

test("repeated observed content patterns materially tailor creator treatment without performance claims", () => {
  const tutorial = deriveCreatorTreatment(
    buildCreatorContentContext({ content: contentContext(), creator, evidence: evidence("beauty", ["Beauty tutorial: makeup steps", "Beauty demonstration: daily makeup steps"]) }),
    { baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit" }
  );
  const narrative = deriveCreatorTreatment(
    buildCreatorContentContext({ content: contentContext(), creator, evidence: evidence("lifestyle", ["Lifestyle story: a busy morning moment", "Lifestyle storytelling: a real daily situation"]) }),
    { baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit" }
  );
  const routine = deriveCreatorTreatment(
    buildCreatorContentContext({ content: contentContext(), creator, evidence: evidence("family", ["Family routine: our everyday breakfast", "Family daily routine: a relatable moment"]) }),
    { baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit" }
  );

  assert.equal(tutorial.evidenceStrength, "strong");
  assert.match(tutorial.format ?? "", /demonstration/i);
  assert.match(tutorial.hookDirection ?? "", /product in use/i);
  assert.match(tutorial.creatorAdaptation ?? "", /step-by-step/i);
  assert.match(tutorial.rationale ?? "", /^Observed:.*Recommendation:/);

  assert.equal(narrative.evidenceStrength, "strong");
  assert.match(narrative.format ?? "", /narrative/i);
  assert.match(narrative.hookDirection ?? "", /relatable situation/i);
  assert.match(narrative.creatorAdaptation ?? "", /situation-led/i);

  assert.equal(routine.evidenceStrength, "strong");
  assert.match(routine.format ?? "", /routine/i);
  assert.match(routine.hookDirection ?? "", /familiar routine/i);
  assert.match(routine.creatorAdaptation ?? "", /routine-context/i);

  for (const treatment of [tutorial, narrative, routine]) {
    assert.doesNotMatch(JSON.stringify(treatment), /performs best|audience prefers|converts better|performance|reach|engagement/i);
  }
});

test("same campaign produces evidence-led treatments without forcing difference for identical evidence", () => {
  const campaign = contentContext();
  const treatment = (creatorEvidence: CreatorContentEvidence) => deriveCreatorTreatment(
    buildCreatorContentContext({ content: campaign, creator, evidence: creatorEvidence }),
    { baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit" }
  );
  const beauty = treatment(evidence("beauty", ["Beauty tutorial: makeup steps", "Beauty demonstration: daily makeup steps"]));
  const lifestyle = treatment(evidence("lifestyle", ["Lifestyle story: busy morning moment", "Lifestyle storytelling: a daily situation"]));
  const family = treatment(evidence("family", ["Family routine: everyday breakfast", "Family daily routine: relatable moment"]));
  const sparse = treatment(evidence("food", ["Traveling with my food bag"]));
  const identical = treatment(evidence("beauty", ["Beauty tutorial: makeup steps", "Beauty demonstration: daily makeup steps"]));

  assert.notEqual(beauty.contentAngle, lifestyle.contentAngle);
  assert.notEqual(lifestyle.hookDirection, family.hookDirection);
  assert.notEqual(beauty.creatorAdaptation, family.creatorAdaptation);
  assert.equal(sparse.evidenceStrength, "weak");
  assert.match(sparse.creatorAdaptation ?? "", /recorded food signal/i);
  assert.doesNotMatch(sparse.creatorAdaptation ?? "", /recent|post|history/i);
  assert.deepEqual(identical, beauty);
  assert.deepEqual(beauty.mandatoryInclusions, ["Terms apply"]);
  assert.deepEqual(family.prohibitedPoints, ["Guaranteed results"]);
});

test("structured AI output is never accepted as observed history and cannot override CTA or evidence refs", () => {
  const context = buildCreatorContentContext({ content: contentContext(), creator, evidence: evidence("fitness") });
  const valid = validateCreatorTreatmentAiOutput({
    creatorId: creator.creatorId,
    contentAngle: "A recommendation",
    cta: "Apply today",
    evidenceRefs: ["dna:categories"],
    provenance: "AI_RECOMMENDED",
    confidence: 0.7,
  }, context);
  assert.equal(valid?.provenance, "AI_RECOMMENDED");
  assert.equal(validateCreatorTreatmentAiOutput({ ...valid, cta: "Invented CTA" }, context), null);
  assert.equal(validateCreatorTreatmentAiOutput({ ...valid, evidenceRefs: ["invented" ] }, context), null);
  assert.equal(validateCreatorTreatmentAiOutput({ ...valid, provenance: "OBSERVED" }, context), null);
  assert.equal(validateCreatorTreatmentAiOutput({ ...valid, unstructuredNote: "not allowed" }, context), null);
});

test("blocked Content remains blocked before creator treatment", () => {
  const content = contentContext();
  content.readiness = { status: "BLOCKED", blockers: ["Legal review required."], warnings: [] };
  const treatment = deriveCreatorTreatment(
    buildCreatorContentContext({ content, creator, evidence: evidence("fitness") }),
    { baseFormat: "Instagram Reel", baseConcept: "Demonstrate the benefit" }
  );
  assert.deepEqual(treatment, {});
});

test("canonical creator service types expand to rows without a parallel deliverable model", () => {
  const content = contentContext();
  content.creators = [{ ...creator, serviceTypes: ["Instagram Reel", "Instagram Story"] }];
  const rows = deriveInfluencerContentPlan(content, {
    "creator-a": evidence("fitness", ["Fitness tutorial: product steps", "Fitness demonstration: daily product steps"]),
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.contentType), ["Instagram Reel", "Instagram Story"]);
  assert.ok(rows.every((row) => row.creatorId === creator.creatorId));
  assert.ok(rows.every((row) => /demonstration/i.test(row.format ?? "")));
});

test("Creator DNA is reduced to bounded observed/derived evidence with freshness", () => {
  const document = createEmptyCreatorDNADocument();
  document.platforms.primaryPlatform = wrapValue("Instagram", "ipl", 0.9, { updatedAt: "2026-09-01" });
  document.audience.categories = wrapValue(["fitness"], "manual", 1, { updatedAt: "2026-09-01" });
  document.audience.interests = wrapValue(["wellness"], "ai_infer", 0.4, { updatedAt: "2026-09-01" });
  document.content.recentPublications = wrapValue([
    { url: "https://example.test/post", thumbnail: null, likes: null, comments: null, views: null, posted_at: "2026-08-30", caption: "A recent routine" },
  ], "ipl", 0.8, { updatedAt: "2026-09-01" });
  document.meta.lastIntelligenceUpdate = "2026-09-01";
  const projected = projectCreatorContentEvidence({
    influencerId: "creator-a",
    document,
    version: 1,
    lastSnapshotId: null,
    lastEnrichmentRunId: null,
    platformAccountIds: [],
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
  });
  assert.deepEqual(projected.categories, ["fitness"]);
  assert.equal(projected.evidenceRefs.find((ref) => ref.id === "dna:interests")?.provenance, "DERIVED");
  assert.equal(projected.recentPublications.length, 1);
  assert.equal(JSON.stringify(projected).includes("document"), false);
});
