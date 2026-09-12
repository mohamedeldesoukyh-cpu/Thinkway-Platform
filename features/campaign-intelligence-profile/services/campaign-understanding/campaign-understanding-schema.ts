import { z } from "zod";

import { CAMPAIGN_UNDERSTANDING_SCHEMA_VERSION, type CampaignUnderstanding, type JsonValue } from "../../types/campaign-understanding";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

const stageSchema = z.enum(["strategy", "discovery", "creator_planning", "content", "commercial", "package"]);
const originSchema = z.enum([
  "SOURCE_STATED",
  "OPERATOR_STATED",
  "INFERRED",
  "DERIVED",
  "HEURISTIC_DEFAULT",
  "AI_RECOMMENDED",
  "LEGACY_UNVERIFIED",
]);
const scopeSchema = z
  .object({
    selectors: z
      .array(
        z
          .object({
            dimension: z.enum(["market", "product", "audience_segment", "platform", "creator", "phase", "wave", "deliverable"]),
            operator: z.enum(["is", "in", "not_in"]),
            values: z.array(z.string().min(1)).min(1),
          })
          .strict()
      )
      .min(1),
  })
  .strict()
  .superRefine((scope, context) => {
    const dimensions = new Set<string>();
    for (const [index, selector] of scope.selectors.entries()) {
      if (dimensions.has(selector.dimension)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selectors", index, "dimension"],
          message: "A scope may contain each dimension only once; use a single explicit membership selector.",
        });
      }
      dimensions.add(selector.dimension);
    }
  });
const evidenceSchema = z
  .object({
    sourceDocumentId: z.string().min(1),
    sourceBlockId: z.string().min(1),
    excerpt: z.string(),
    location: z
      .object({
        page: z.number().int().positive().optional(),
        section: z.string().optional(),
        table: z.string().optional(),
        row: z.number().int().positive().optional(),
        column: z.string().optional(),
        appendix: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const conditionSchema = z
  .object({
    operator: z.enum(["all", "any"]),
    clauses: z
      .array(
        z
          .object({
            factConcept: z.string().min(1),
            operator: z.enum(["is", "includes", "selected"]),
            value: jsonValueSchema.optional(),
            scope: scopeSchema.optional(),
          })
          .strict()
      )
      .min(1),
  })
  .strict();

export const campaignUnderstandingSchema = z
  .object({
    schemaVersion: z.literal(CAMPAIGN_UNDERSTANDING_SCHEMA_VERSION),
    campaignId: z.string().min(1).optional(),
    sourceDocuments: z
      .array(
        z
          .object({
            id: z.string().min(1),
            kind: z.enum(["brief", "appendix", "legal", "commercial_attachment", "annex", "other"]),
            title: z.string().min(1).optional(),
            blocks: z.array(
              z
                .object({
                  id: z.string().min(1),
                  kind: z.enum(["paragraph", "heading", "list", "table", "appendix", "operator_note", "other"]),
                  text: z.string(),
                  material: z.boolean(),
                })
                .strict()
            ),
          })
          .strict()
      )
      .min(1),
    facts: z.array(
      z
        .object({
          id: z.string().min(1),
          concept: z.string().min(1),
          label: z.string().min(1),
          value: jsonValueSchema,
          origin: originSchema,
          status: z.enum(["confirmed", "proposed", "open", "conflicted", "needs_classification", "unsupported"]),
          materiality: z.enum(["context", "important", "decision_critical", "blocking"]),
          scope: scopeSchema.optional(),
          condition: conditionSchema.optional(),
          evidence: z.array(evidenceSchema),
          derivation: z
            .object({
              derivedFromFactIds: z.array(z.string().min(1)).min(1),
              method: z.enum(["normalization", "calculation", "aggregation", "other"]).optional(),
              reason: z.string().min(1).optional(),
            })
            .strict()
            .optional(),
          appliesToStages: z.array(stageSchema).min(1).optional(),
          confidence: z.number().min(0).max(1).optional(),
          disclosure: z.string().min(1).optional(),
        })
        .strict()
    ),
    constraints: z.array(
      z
        .object({
          id: z.string().min(1),
          kind: z.enum(["legal", "commercial_rights", "creator", "brand_safety", "operational", "other"]),
          statement: z.string().min(1),
          severity: z.enum(["warning", "blocking"]),
          origin: originSchema,
          status: z.enum(["active", "resolved", "needs_classification"]),
          scope: scopeSchema.optional(),
          condition: conditionSchema.optional(),
          evidence: z.array(evidenceSchema),
          appliesToStages: z.array(stageSchema).min(1).optional(),
        })
        .strict()
    ),
    questions: z.array(
      z
        .object({
          id: z.string().min(1),
          prompt: z.string().min(1),
          severity: z.enum(["warning", "blocking"]),
          status: z.enum(["open", "answered", "not_applicable"]),
          appliesToStages: z.array(stageSchema).min(1),
          relatedFactIds: z.array(z.string().min(1)).optional(),
        })
        .strict()
    ),
    conflicts: z.array(
      z
        .object({
          id: z.string().min(1),
          summary: z.string().min(1),
          severity: z.enum(["warning", "blocking"]),
          status: z.enum(["open", "resolved"]),
          factIds: z.array(z.string().min(1)).min(2),
          appliesToStages: z.array(stageSchema).min(1).optional(),
        })
        .strict()
    ),
    confirmation: z
      .object({
        status: z.enum(["unconfirmed", "partially_confirmed", "confirmed"]),
        confirmedFactIds: z.array(z.string().min(1)),
        confirmedAt: z.string().datetime().optional(),
        confirmedBy: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export function parseCampaignUnderstanding(input: unknown): CampaignUnderstanding {
  return campaignUnderstandingSchema.parse(input) as CampaignUnderstanding;
}

export function safeParseCampaignUnderstanding(input: unknown) {
  return campaignUnderstandingSchema.safeParse(input);
}
