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
import {
  compareOutputVersions,
  describeStaleReason,
  generateCampaignOutput,
  getCampaignOutput,
} from "../output-registry";
import { renderOutputMarkdown } from "../output-markdown";

export type OutputCopilotResult = {
  campaignObject: CampaignObject;
  reply: string;
  changed: boolean;
  record?: CampaignOutputRecord;
  /** Rendered markdown, present for export/preview. */
  markdown?: string;
  /** UI directive: focus/open this output in the Outputs Center. */
  navigate?: CampaignOutputKind;
  /** UI directive: open this output's preview panel. */
  preview?: CampaignOutputKind;
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
    const existingLabel = existing.versionLabel ?? `v${existing.version}`;
    return {
      campaignObject,
      changed: false,
      reply: `The ${label} is already generated and current (${existingLabel}). Say "regenerate the ${label}" if you want a new strategic version.`,
      record: existing,
      preview: input.kind,
    };
  }

  const operation =
    input.kind === "media_plan"
      ? !existing || existing.version <= 0
        ? "initial"
        : "regenerate"
      : undefined;
  const { campaignObject: next, record } = generateCampaignOutput(campaignObject, input.kind, {
    now: input.now,
    operation,
    changeSummary:
      input.kind === "media_plan" && operation === "regenerate"
        ? "Regenerated Media Plan — new strategic version (creators/waves/schedule may change)."
        : undefined,
  });
  const versionLabel = record.versionLabel ?? `v${record.version}`;
  const verb =
    record.operation === "regenerate"
      ? "regenerated"
      : record.operation === "revise"
        ? "revised"
        : existing
          ? "regenerated"
          : "generated";
  const mediaPlanNote =
    input.kind === "media_plan" && input.regenerate
      ? record.operation === "regenerate" &&
        (record.versionMajor ?? 1) > 1
        ? " This opened a **new major business version** — creators, waves, and schedule may change. Prefer timeline/slot edits to revise operationally."
        : " Updated the working Media Plan on the **same business version** (pre-approval edits do not bump the client-facing version; audit trail recorded)."
      : "";
  const reply = `I ${verb} the **${label}** (${versionLabel}) directly from the Campaign Object — derived from ${sourceLabel(input.kind)}. Only this output changed; every other output is untouched.${mediaPlanNote}`;
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

/** Open an output in the Outputs Center (a navigation directive for the UI). */
export function runOpenOutput(
  campaignObject: CampaignObject,
  input: { kind: CampaignOutputKind }
): OutputCopilotResult {
  const label = getOutputDefinition(input.kind)?.label ?? input.kind;
  const record = getCampaignOutput(campaignObject, input.kind);
  if (!record) {
    return {
      campaignObject,
      changed: false,
      reply: `The ${label} hasn't been generated yet. Say "generate the ${label}" and I'll create it, then open it in the Outputs Center.`,
      navigate: input.kind,
    };
  }
  return {
    campaignObject,
    changed: false,
    reply: `Opening the **${label}** (v${record.version}) in the Outputs Center.`,
    navigate: input.kind,
    record,
  };
}

/** Preview an output — renders exactly what an export would contain. */
export function runPreviewOutput(
  campaignObject: CampaignObject,
  input: { kind: CampaignOutputKind; now?: string }
): OutputCopilotResult {
  const definition = getOutputDefinition(input.kind);
  const label = definition?.label ?? input.kind;
  if (!definition?.generate) {
    return {
      campaignObject,
      changed: false,
      reply: `The ${label} can't be previewed yet — its generator is coming soon. ${NOT_WIRED_HINT}`,
      preview: input.kind,
    };
  }

  let obj = campaignObject;
  let changed = false;
  let record = getCampaignOutput(obj, input.kind);
  if (!record?.content) {
    const generated = generateCampaignOutput(obj, input.kind, { now: input.now });
    obj = generated.campaignObject;
    record = generated.record;
    changed = true;
  }
  const markdown = renderOutputMarkdown(record.content!);
  return {
    campaignObject: obj,
    changed,
    reply: `Preview of the **${label}** (v${record.version})${changed ? " — generated just now" : ""}:\n\n${markdown}`,
    markdown,
    preview: input.kind,
    record,
  };
}

/** Explain precisely why an output needs updating — never a generic message. */
export function runExplainStaleness(
  campaignObject: CampaignObject,
  input: { kind: CampaignOutputKind }
): OutputCopilotResult {
  const label = getOutputDefinition(input.kind)?.label ?? input.kind;
  const record = getCampaignOutput(campaignObject, input.kind);
  if (!record) {
    return {
      campaignObject,
      changed: false,
      reply: `The ${label} hasn't been generated yet, so there's nothing to update.`,
    };
  }
  if (record.status !== "needs_update") {
    return {
      campaignObject,
      changed: false,
      reply: `The ${label} is up to date (v${record.version}) — no regeneration needed.`,
      record,
    };
  }
  const stale = describeStaleReason(campaignObject, input.kind);
  return {
    campaignObject,
    changed: false,
    reply: `The **${label}** needs updating.\n\nReason: ${stale?.reason ?? "its source data changed."} Say "regenerate the ${label}" and I'll rebuild it from the current Campaign Object.`,
    record,
  };
}

/** Compare two versions of an output (defaults to the last two). */
export function runCompareVersions(
  campaignObject: CampaignObject,
  input: { kind: CampaignOutputKind; from?: number; to?: number }
): OutputCopilotResult {
  const label = getOutputDefinition(input.kind)?.label ?? input.kind;
  const diff = compareOutputVersions(campaignObject, input.kind, {
    from: input.from,
    to: input.to,
  });
  if (!diff) {
    return {
      campaignObject,
      changed: false,
      reply: `The ${label} has only one version so far — there's nothing to compare yet.`,
    };
  }

  const fromLabel = diff.fromVersionLabel ?? `v${diff.fromVersion}`;
  const toLabel = diff.toVersionLabel ?? `v${diff.toVersion}`;
  const lines: string[] = [
    `Comparing the **${label}** — ${fromLabel} → ${toLabel}${diff.reason ? ` (${diff.reason})` : ""}:`,
  ];
  if (diff.changeSummary) lines.push(`- Summary: ${diff.changeSummary}`);
  if (diff.changedSections.length) lines.push(`- Changed: ${diff.changedSections.join(", ")}`);
  if (diff.addedSections.length) lines.push(`- Added: ${diff.addedSections.join(", ")}`);
  if (diff.removedSections.length) lines.push(`- Removed: ${diff.removedSections.join(", ")}`);
  if (diff.changedSections.length + diff.addedSections.length + diff.removedSections.length === 0) {
    lines.push("- No section-level differences — the rendered content is identical.");
  }
  if (input.kind === "media_plan") {
    lines.push(
      "- Restore a prior version with: restore media plan version N (uses the revision sequence)."
    );
  }
  return { campaignObject, changed: false, reply: lines.join("\n"), navigate: input.kind };
}
