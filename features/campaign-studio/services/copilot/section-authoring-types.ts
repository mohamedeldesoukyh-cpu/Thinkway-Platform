/**
 * Section-content authoring targets. Each maps to exactly one storage location
 * on the Campaign Object — the single source of truth. Authoring edits ONLY the
 * target's field(s); every other section is preserved byte-for-byte.
 */
export type SectionAuthorTarget =
  | "strategy"
  | "executive_summary"
  // 7b structured lists (declared now so the vocabulary is stable):
  | "creative_concepts"
  | "kpis"
  | "risks"
  | "benchmarks"
  | "deliverables";

/** Deictic focus the UI (or conversation) provides so "this section" resolves. */
export type StudioFocus = {
  /** Studio card id, e.g. "executive-strategy", "kpi-forecast". */
  sectionId?: string;
  /** Index of the focused element within a list section (0-based). */
  elementIndex?: number;
  /** Kind of the focused element, e.g. "concept", "kpi", "creator". */
  elementKind?: string;
};

/** Studio card id → authoring target. Used to resolve focus + "this section". */
const STUDIO_SECTION_TO_TARGET: Record<string, SectionAuthorTarget> = {
  "executive-strategy": "strategy",
  "executive-summary": "executive_summary",
  "creative-concepts": "creative_concepts",
  "content-plan": "creative_concepts",
  "kpi-forecast": "kpis",
  "success-probability": "kpis",
  "risk-analysis": "risks",
  "industry-benchmark": "benchmarks",
};

export function targetForStudioSection(sectionId?: string): SectionAuthorTarget | undefined {
  if (!sectionId) return undefined;
  return STUDIO_SECTION_TO_TARGET[sectionId];
}

/** The studio card id an authoring target maps back to (for change-log focus). */
export function studioSectionForTarget(target: SectionAuthorTarget): string {
  const entry = Object.entries(STUDIO_SECTION_TO_TARGET).find(([, t]) => t === target);
  return entry?.[0] ?? target;
}

/** Grounded strategy field labels the Copilot can author (exact labels the resolver reads). */
export const STRATEGY_FIELD_LABELS = [
  "Business Challenge",
  "Campaign Objective",
  "Target Audience",
  "Consumer Insight",
  "Key Message",
  "Creator Strategy",
  "Platform Strategy",
  "Customer Journey",
  "Competitive Advantage",
] as const;

export type StrategyFieldLabel = (typeof STRATEGY_FIELD_LABELS)[number];

/** Which strategy fields an instruction most likely targets (business case, etc.). */
export function strategyLabelsForInstruction(instruction: string): StrategyFieldLabel[] {
  const text = instruction.toLowerCase();
  if (/business case|business challenge|roi|justif|value/.test(text)) {
    return ["Business Challenge", "Competitive Advantage"];
  }
  if (/competitive|competitor|differenti/.test(text)) return ["Competitive Advantage"];
  if (/audience|youth|gen ?z|demographic/.test(text)) return ["Target Audience", "Consumer Insight"];
  if (/message|messaging|positioning/.test(text)) return ["Key Message"];
  if (/creator strateg|influencer strateg/.test(text)) return ["Creator Strategy"];
  if (/platform/.test(text)) return ["Platform Strategy"];
  // A general "rewrite the strategy" re-authors the whole narrative.
  return [...STRATEGY_FIELD_LABELS];
}
