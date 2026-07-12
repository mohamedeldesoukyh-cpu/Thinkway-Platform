/**
 * Campaign Outputs ↔ Copilot integration — deterministic, persistence-free core.
 *
 * The Copilot interprets a request and calls these pure executors; the Studio
 * Copilot orchestrator wraps them with change-log + version persistence. Keeping
 * the logic here (not in the Copilot) preserves the platform boundary: the
 * Outputs Engine owns generation; the Copilot only routes to it. Only the
 * requested output is (re)generated — never anything else.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";

import type { CampaignOutputKind, CampaignOutputRecord } from "../output-types";
import { INPUT_KEY_LABELS, getOutputDefinition } from "../output-catalog";
import { generateCampaignOutput, getCampaignOutput } from "../output-registry";
import { renderOutputMarkdown } from "../output-markdown";

export type OutputCopilotResult = {
  campaignObject: CampaignObject;
  reply: string;
  changed: boolean;
  record?: CampaignOutputRecord;
  /** Rendered markdown, present for export. */
  markdown?: string;
};

/**
 * Phrase → output kind. Ordered most-specific-first so "full campaign strategy"
 * and "executive summary" win over the generic "strategy" / "summary".
 */
const OUTPUT_KIND_MATCHERS: Array<{ re: RegExp; kind: CampaignOutputKind }> = [
  { re: /\bmedia\s*plan\b/i, kind: "media_plan" },
  { re: /\bexecutive\s+summary\b|\bexec\s+summary\b/i, kind: "executive_summary" },
  { re: /\bexecutive\s+proposal\b|\bproposal\b/i, kind: "executive_proposal" },
  { re: /\b(full\s+)?(campaign\s+)?strategy\b/i, kind: "full_strategy" },
  { re: /\bkpi\s*(forecast)?\b|\bforecast\b/i, kind: "kpi_forecast" },
  { re: /\bbudget\s+allocation\b|\bbudget\s+plan\b/i, kind: "budget_allocation" },
  { re: /\brisk\s*(assessment|plan|&?\s*mitigation)?\b|\brisks?\b/i, kind: "risk_plan" },
  { re: /\bamplification\b|\bpaid\s+plan\b/i, kind: "amplification_plan" },
  { re: /\bcreative\s+concepts?\b|\bconcepts?\b/i, kind: "creative_concepts" },
  { re: /\bcontent\s+calendar\b/i, kind: "content_calendar" },
  { re: /\bposting\s+timeline\b|\btimeline\b/i, kind: "posting_timeline" },
  { re: /\bcreator\s+activation\b|\bactivation\s+plan\b/i, kind: "creator_activation" },
  { re: /\b(campaign\s+)?playbook\b/i, kind: "campaign_playbook" },
  { re: /\bclient\s+presentation\b|\bpresentation\b|\bdeck\b/i, kind: "client_presentation" },
  { re: /\bstatement\s+of\s+work\b|\bsow\b/i, kind: "statement_of_work" },
  { re: /\b(campaign\s+)?brief\b/i, kind: "campaign_brief" },
  { re: /\binternal\s+operations?\b|\bops\s+plan\b/i, kind: "internal_operations" },
];

/** Resolve which Campaign Output a free-text request refers to, if any. */
export function resolveOutputKind(text: string): CampaignOutputKind | undefined {
  for (const matcher of OUTPUT_KIND_MATCHERS) {
    if (matcher.re.test(text)) return matcher.kind;
  }
  return undefined;
}

function sourceLabel(kind: CampaignOutputKind): string {
  const definition = getOutputDefinition(kind);
  if (!definition) return "the campaign object";
  return definition.inputKeys.map((key) => INPUT_KEY_LABELS[key]).join(", ");
}

const NOT_WIRED_HINT =
  "I can currently generate the Media Plan and the Full Campaign Strategy; the other outputs are coming soon.";

/**
 * Generate or regenerate a single output. Honors "no unnecessary regeneration":
 * a plain "generate" on an already-current output is a no-op with a note, while
 * "regenerate"/an out-of-date output rebuilds it. Only the requested output changes.
 */
export function runGenerateOutput(
  campaignObject: CampaignObject,
  input: { kind: CampaignOutputKind; regenerate?: boolean; now?: string }
): OutputCopilotResult {
  const definition = getOutputDefinition(input.kind);
  const label = definition?.label ?? input.kind;

  if (!definition?.generate) {
    return {
      campaignObject,
      changed: false,
      reply: `Generating the ${label} isn't wired up yet. ${NOT_WIRED_HINT}`,
    };
  }

  const existing = getCampaignOutput(campaignObject, input.kind);
  if (!input.regenerate && existing?.status === "generated") {
    return {
      campaignObject,
      changed: false,
      reply: `The ${label} is already generated and current (v${existing.version}). Say "regenerate the ${label}" if you want me to rebuild it.`,
      record: existing,
    };
  }

  const { campaignObject: next, record } = generateCampaignOutput(campaignObject, input.kind, {
    now: input.now,
  });
  const verb = existing ? "regenerated" : "generated";
  const reply = `I ${verb} the **${label}** (v${record.version}) directly from the Campaign Object — derived from ${sourceLabel(input.kind)}. Only this output changed; every other output is untouched.`;
  return { campaignObject: next, changed: true, reply, record };
}

/**
 * Export a single output. Generates it first if needed (so export works
 * standalone), then returns its rendered markdown. File export (PDF/PPT) lands
 * with the Outputs Center; this gives an immediate, honest text export in chat.
 */
export function runExportOutput(
  campaignObject: CampaignObject,
  input: { kind: CampaignOutputKind; now?: string }
): OutputCopilotResult {
  const definition = getOutputDefinition(input.kind);
  const label = definition?.label ?? input.kind;

  if (!definition?.generate) {
    return {
      campaignObject,
      changed: false,
      reply: `The ${label} needs a generator before it can be exported. ${NOT_WIRED_HINT}`,
    };
  }

  let obj = campaignObject;
  let changed = false;
  let record = getCampaignOutput(obj, input.kind);
  if (!record?.content || record.status === "needs_update") {
    const generated = generateCampaignOutput(obj, input.kind, { now: input.now });
    obj = generated.campaignObject;
    record = generated.record;
    changed = true;
  }

  const markdown = renderOutputMarkdown(record.content!);
  const reply = `Here is the **${label}**, ready to export${changed ? " (I generated the latest version first)" : ""}:\n\n${markdown}`;
  return { campaignObject: obj, changed, reply, record, markdown };
}
