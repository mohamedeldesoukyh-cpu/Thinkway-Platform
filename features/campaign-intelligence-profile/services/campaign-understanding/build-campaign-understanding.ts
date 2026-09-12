import { parseCampaignUnderstanding } from "./campaign-understanding-schema";
import type {
  CampaignUnderstanding,
  FactScope,
  JsonValue,
  RequirementCondition,
  SourceDocument,
  SourceMaterialBlock,
} from "../../types/campaign-understanding";
import type { CampaignIntelligenceProfile } from "../../types/profile";
import type { StructuredBriefBlock, StructuredBriefDocument } from "../structured-brief-parser/types";

export type CampaignUnderstandingSourceInput = {
  id: string;
  kind: SourceDocument["kind"];
  document?: StructuredBriefDocument;
  rawText?: string;
  /** Already parsed source blocks, used by deterministic regression adapters only. */
  sourceDocument?: SourceDocument;
};

function textForBlock(block: StructuredBriefBlock): string {
  if (block.type === "list") return block.items.join("\n");
  if (block.type === "table") return block.rows.map((row) => row.join(" | ")).join("\n");
  return block.text;
}

function materialBlock(id: string, text: string, kind: SourceMaterialBlock["kind"], material = true): SourceMaterialBlock {
  return { id, text, kind, material };
}

function toSourceDocument(input: CampaignUnderstandingSourceInput): SourceDocument {
  if (input.sourceDocument) return input.sourceDocument;
  const blocks: SourceMaterialBlock[] = [];
  for (const [sectionIndex, section] of (input.document?.sections ?? []).entries()) {
    if (section.title) blocks.push(materialBlock(`section-${sectionIndex}`, section.title, "heading", false));
    for (const [blockIndex, block] of section.blocks.entries()) {
      const kind: SourceMaterialBlock["kind"] = block.type === "heading" ? "heading" : block.type;
      blocks.push(materialBlock(`section-${sectionIndex}-block-${blockIndex}`, textForBlock(block), kind, kind !== "heading"));
    }
  }
  if (blocks.length === 0 && input.rawText?.trim()) {
    blocks.push(materialBlock("raw-0", input.rawText.trim(), "paragraph"));
  }
  return { id: input.id, kind: input.kind, blocks };
}

function scopeFromText(text: string): FactScope | undefined {
  const selectors: FactScope["selectors"] = [];
  const lower = text.toLowerCase();
  const markets = [
    /\begypt\b/.test(lower) ? "Egypt" : null,
    /\bksa\b|\bsaudi arabia\b/.test(lower) ? "Saudi Arabia" : null,
  ].filter((value): value is string => Boolean(value));
  if (markets.length) selectors.push({ dimension: "market", operator: markets.length === 1 ? "is" : "in", values: markets });
  const platforms = [
    /\binstagram\b/.test(lower) ? "Instagram" : null,
    /\btiktok\b/.test(lower) ? "TikTok" : null,
  ].filter((value): value is string => Boolean(value));
  if (platforms.length) selectors.push({ dimension: "platform", operator: platforms.length === 1 ? "is" : "in", values: platforms });
  const wave = lower.match(/\bwave\s*(\d+)\b/);
  if (wave) selectors.push({ dimension: "wave", operator: "is", values: [wave[1]] });
  const phase = lower.match(/\b(pre[- ]event|live|post[- ]event)\b/);
  if (phase) selectors.push({ dimension: "phase", operator: "is", values: [phase[1].replace(/[- ]event/, "")] });
  return selectors.length ? { selectors } : undefined;
}

function conditionFromText(text: string): RequirementCondition | undefined {
  const lower = text.toLowerCase();
  if (!/\bif\b/.test(lower)) return undefined;
  if (/boost|paid amplification/.test(lower)) return { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] };
  if (/ksa|saudi arabia/.test(lower)) return { operator: "all", clauses: [{ factConcept: "creator_market", operator: "is", value: "Saudi Arabia" }] };
  if (/event|attend/.test(lower)) return { operator: "all", clauses: [{ factConcept: "event_attendance", operator: "selected" }] };
  return undefined;
}

function firstEvidence(documents: SourceDocument[], value: string): { sourceDocumentId: string; sourceBlockId: string; excerpt: string; scope?: FactScope; condition?: RequirementCondition } | null {
  const needle = value.toLowerCase();
  for (const document of documents) {
    for (const block of document.blocks) {
      if (block.text.toLowerCase().includes(needle)) {
        return { sourceDocumentId: document.id, sourceBlockId: block.id, excerpt: block.text.slice(0, 240), scope: scopeFromText(block.text), condition: conditionFromText(block.text) };
      }
    }
  }
  return null;
}

type ProfileField = { concept: string; label: string; value: JsonValue | undefined };

function profileFields(profile: CampaignIntelligenceProfile): ProfileField[] {
  return [
    { concept: "brand", label: "Brand", value: profile.brandName },
    { concept: "client", label: "Client", value: profile.clientName },
    { concept: "campaign_name", label: "Campaign name", value: profile.campaignName },
    { concept: "market", label: "Market", value: profile.market ?? profile.geography },
    { concept: "campaign_objective", label: "Objective", value: profile.objective ?? profile.objectives },
    { concept: "platforms", label: "Platforms", value: profile.platforms },
    { concept: "deliverables", label: "Deliverables", value: profile.deliverables },
    { concept: "performance_kpi", label: "KPI", value: profile.kpis },
    { concept: "budget", label: "Budget", value: profile.budget },
    { concept: "creator_strategy", label: "Creator tiers", value: profile.creatorTiers as JsonValue | undefined },
  ];
}

/**
 * The real pipeline's compatibility extraction supplies known core facts;
 * retained source blocks supply evidence and an explicit unknown-safe fallback.
 */
export function buildCampaignUnderstanding(input: {
  profile: CampaignIntelligenceProfile;
  sourceDocuments: CampaignUnderstandingSourceInput[];
  campaignId?: string;
  /** Recorded semantic output may be injected by tests; production leaves this undefined. */
  semanticExtraction?: Pick<CampaignUnderstanding, "facts" | "constraints" | "questions" | "conflicts">;
}): CampaignUnderstanding {
  const sourceDocuments = input.sourceDocuments.map(toSourceDocument).filter((document) => document.blocks.length > 0);
  const represented = new Set<string>();
  const facts: CampaignUnderstanding["facts"] = input.semanticExtraction ? [...input.semanticExtraction.facts] : [];
  if (!input.semanticExtraction) {
    for (const field of profileFields(input.profile)) {
      if (field.value == null || (Array.isArray(field.value) && field.value.length === 0)) continue;
      const valueText = typeof field.value === "string" ? field.value : Array.isArray(field.value) ? field.value.join(" ") : JSON.stringify(field.value);
      const evidence =
        firstEvidence(sourceDocuments, valueText) ??
        (Array.isArray(field.value)
          ? field.value
              .filter((item): item is string => typeof item === "string")
              .map((item) => firstEvidence(sourceDocuments, item))
              .find(Boolean) ?? null
          : null);
      if (evidence) represented.add(`${evidence.sourceDocumentId}:${evidence.sourceBlockId}`);
      facts.push({
        id: `core-${field.concept}`,
        concept: field.concept,
        label: field.label,
        value: field.value,
        origin: evidence ? "SOURCE_STATED" : "LEGACY_UNVERIFIED",
        status: evidence ? "proposed" : "needs_classification",
        materiality: "important",
        scope: evidence?.scope,
        condition: evidence?.condition,
        evidence: evidence ? [{ sourceDocumentId: evidence.sourceDocumentId, sourceBlockId: evidence.sourceBlockId, excerpt: evidence.excerpt }] : [],
        confidence: evidence ? 0.9 : 0.5,
      });
    }
    for (const document of sourceDocuments) {
      for (const block of document.blocks) {
        const key = `${document.id}:${block.id}`;
        if (!block.material || represented.has(key)) continue;
        facts.push({
          id: `unclassified-${document.id}-${block.id}`,
          concept: `unclassified:source_block:${document.id}:${block.id}`,
          label: "Unclassified source requirement",
          value: block.text,
          origin: "SOURCE_STATED",
          status: "needs_classification",
          materiality: "important",
          scope: scopeFromText(block.text),
          condition: conditionFromText(block.text),
          evidence: [{ sourceDocumentId: document.id, sourceBlockId: block.id, excerpt: block.text.slice(0, 240) }],
          confidence: 0.5,
        });
      }
    }
  }
  return parseCampaignUnderstanding({
    schemaVersion: 1,
    campaignId: input.campaignId,
    sourceDocuments,
    facts,
    constraints: input.semanticExtraction?.constraints ?? [],
    questions: input.semanticExtraction?.questions ?? (
      input.profile.budget?.amount == null
        ? [
            {
              id: "missing-budget",
              prompt: "What budget is approved?",
              severity: "blocking",
              status: "open",
              appliesToStages: ["commercial", "package"],
            },
          ]
        : []),
    conflicts: input.semanticExtraction?.conflicts ?? [],
    confirmation: { status: "unconfirmed", confirmedFactIds: [] },
  });
}
