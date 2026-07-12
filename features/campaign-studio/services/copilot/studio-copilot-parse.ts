import type { LlmToolCall, LlmToolDefinition } from "@/features/ai/types/llm";
import type { CampaignOutputKind } from "@/features/campaign-outputs/output-types";
import { resolveOutputKind } from "@/features/campaign-outputs/copilot/output-copilot";

import type { StudioCopilotIntent } from "./studio-copilot-intents";
import type { SectionAuthorTarget } from "./section-authoring-types";

/** The Campaign Output kinds the Copilot can generate/regenerate/export. */
const OUTPUT_KINDS: CampaignOutputKind[] = [
  "full_strategy",
  "executive_proposal",
  "media_plan",
  "content_calendar",
  "posting_timeline",
  "creator_activation",
  "campaign_playbook",
  "kpi_forecast",
  "risk_plan",
  "budget_allocation",
  "amplification_plan",
  "executive_summary",
  "creative_concepts",
  "client_presentation",
  "statement_of_work",
  "campaign_brief",
  "internal_operations",
];

function coerceOutputKind(value: unknown): CampaignOutputKind | undefined {
  return typeof value === "string" && (OUTPUT_KINDS as string[]).includes(value)
    ? (value as CampaignOutputKind)
    : undefined;
}

const AUTHOR_TARGETS: SectionAuthorTarget[] = [
  "strategy",
  "executive_summary",
  "creative_concepts",
  "kpis",
  "risks",
];

/**
 * Tool schema the Campaign Copilot exposes to the model. The model only chooses
 * a tool + arguments — it never writes campaign data. Executors (deterministic)
 * run the actual mutation. Intents beyond this increment's executors are still
 * declared so the model's vocabulary stays stable across releases.
 */
export const STUDIO_COPILOT_TOOLS: LlmToolDefinition[] = [
  {
    name: "remove_creators",
    description:
      "Remove creators from the campaign slate. Use `tier` for a whole follower tier (Celebrity, Macro, Mid-Tier, Micro, Nano), `names` for specific creators, `city`/`country` to remove by creator location, or `belowEngagement` to remove creators under an engagement rate.",
    parameters: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["Celebrity", "Macro", "Mid-Tier", "Micro", "Nano"],
          description: "Follower tier to remove entirely.",
        },
        names: {
          type: "array",
          items: { type: "string" },
          description: "Specific creator display names or handles to remove.",
        },
        city: { type: "string", description: "Remove creators located in this city." },
        country: { type: "string", description: "Remove creators located in this country." },
        belowEngagement: {
          type: "number",
          description: "Remove creators with engagement rate below this percentage.",
        },
        reason: { type: "string", description: "The user's stated reason, if any." },
      },
    },
  },
  {
    name: "add_creators",
    description:
      "Find and add creators to the slate from Discovery. Use `category` for a niche (e.g. 'parenting'), `tier` for a follower tier, `city`/`country` for location. Defaults to the campaign's platform and market.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Content niche/category to search for." },
        tier: {
          type: "string",
          enum: ["Celebrity", "Macro", "Mid-Tier", "Micro", "Nano"],
          description: "Follower tier to target.",
        },
        city: { type: "string" },
        country: { type: "string" },
        count: { type: "number", description: "How many creators to add (default 3)." },
      },
    },
  },
  {
    name: "replace_creators",
    description:
      "Swap creators out and bring comparable ones in. Use `fromTier`/`fromNames` for who to remove and `toTier`/`toCategory` for what to add. Set `higherEngagement` when the user wants higher-engagement replacements.",
    parameters: {
      type: "object",
      properties: {
        fromTier: { type: "string", description: "Tier to replace out (Celebrity, Macro, ...)." },
        fromNames: {
          type: "array",
          items: { type: "string" },
          description: "Specific creators to replace.",
        },
        toTier: { type: "string", description: "Tier to bring in." },
        toCategory: { type: "string", description: "Category to search for replacements." },
        higherEngagement: {
          type: "boolean",
          description: "Prefer higher-engagement replacements.",
        },
      },
    },
  },
  {
    name: "update_budget",
    description:
      "Set the campaign's total budget. Interpret shorthand (e.g. 'EGP 2M' = 2000000). Include currency only if the user changes it.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Total budget amount as a plain number." },
        currency: { type: "string", description: "ISO/short currency code, e.g. EGP, USD, AED." },
      },
      required: ["amount"],
    },
  },
  {
    name: "update_timeline",
    description: "Set the campaign duration in weeks (e.g. 'four weeks' = 4).",
    parameters: {
      type: "object",
      properties: {
        durationWeeks: { type: "number", description: "Campaign duration in weeks (1-52)." },
      },
      required: ["durationWeeks"],
    },
  },
  {
    name: "update_platforms",
    description:
      "Set which platforms the campaign focuses on, in priority order (first = primary). 'Focus more on TikTok than Instagram' => ['TikTok','Instagram'].",
    parameters: {
      type: "object",
      properties: {
        platforms: {
          type: "array",
          items: { type: "string" },
          description: "Platforms in priority order, e.g. ['TikTok','Instagram'].",
        },
      },
      required: ["platforms"],
    },
  },
  {
    name: "update_objectives",
    description: "Rewrite or update the campaign objective.",
    parameters: {
      type: "object",
      properties: { objective: { type: "string", description: "The new objective statement." } },
      required: ["objective"],
    },
  },
  {
    name: "update_audience",
    description:
      "Update the target audience description (e.g. 'increase the female audience' => a revised audience statement).",
    parameters: {
      type: "object",
      properties: { audience: { type: "string", description: "The new audience description." } },
      required: ["audience"],
    },
  },
  {
    name: "update_market",
    description: "Change the campaign's market / geography (countries or cities).",
    parameters: {
      type: "object",
      properties: {
        geography: {
          type: "array",
          items: { type: "string" },
          description: "Markets, e.g. ['Egypt'] or ['UAE','Saudi Arabia'].",
        },
      },
      required: ["geography"],
    },
  },
  {
    name: "author_section",
    description:
      "Rewrite or refine the WRITTEN CONTENT of one campaign section (not its data/creators). Use for: rewrite the strategy, make it more premium/youth/executive/data-driven, strengthen the business case, expand or shorten a section, rewrite the executive summary, make it CMO-ready. Omit `target` to edit the section the user is currently looking at ('this section').",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: ["strategy", "executive_summary", "creative_concepts", "kpis", "risks"],
          description:
            "Which section's content to author (strategy, executive_summary, creative_concepts, kpis, risks). Omit to use the focused section.",
        },
        instruction: {
          type: "string",
          description:
            "What to do, e.g. 'make it more premium', 'replace the creative concepts', 'add KPI recommendations', 'add risks and mitigations', 'make the second concept stronger', 'remove this KPI'.",
        },
        tone: {
          type: "string",
          description: "Optional tone/style, e.g. premium, executive, youth-focused, data-driven.",
        },
      },
      required: ["instruction"],
    },
  },
  {
    name: "retone_proposal",
    description:
      "Apply a tone across the WHOLE proposal — re-authors the strategy and executive summary together. Use for 'make the whole proposal more executive/premium/data-driven', 'make the presentation CMO-ready'.",
    parameters: {
      type: "object",
      properties: {
        tone: {
          type: "string",
          description: "The tone to apply, e.g. executive, premium, data-driven, youth-focused.",
        },
      },
      required: ["tone"],
    },
  },
  {
    name: "generate_output",
    description:
      "Generate a Campaign Output (a whole-campaign artifact — NOT a creator asset) from the Campaign Object: Full Campaign Strategy, Executive Proposal, Media Plan, Timeline, KPI Forecast, Budget Allocation, Risk Assessment, Amplification Plan, Creative Concepts, Executive Summary, Presentation, etc. Use for 'generate a media plan', 'create a full strategy', 'generate only the timeline'. Only the requested output is generated.",
    parameters: {
      type: "object",
      properties: {
        output: {
          type: "string",
          enum: OUTPUT_KINDS,
          description: "Which Campaign Output to generate.",
        },
      },
      required: ["output"],
    },
  },
  {
    name: "regenerate_output",
    description:
      "Rebuild an existing Campaign Output after inputs changed. Use for 'regenerate the media plan', 'rebuild the KPI forecast', 'update the timeline', 'refresh the proposal'. Only the requested output is rebuilt.",
    parameters: {
      type: "object",
      properties: {
        output: { type: "string", enum: OUTPUT_KINDS, description: "Which Campaign Output to rebuild." },
      },
      required: ["output"],
    },
  },
  {
    name: "export_output",
    description:
      "Export a Campaign Output (generating the latest version first if needed). Use for 'export the strategy', 'export the proposal', 'download the media plan'.",
    parameters: {
      type: "object",
      properties: {
        output: { type: "string", enum: OUTPUT_KINDS, description: "Which Campaign Output to export." },
      },
      required: ["output"],
    },
  },
  {
    name: "open_output",
    description:
      "Open/navigate to a Campaign Output in the Outputs Center. Use for 'open the media plan', 'show me the proposal'.",
    parameters: {
      type: "object",
      properties: {
        output: { type: "string", enum: OUTPUT_KINDS, description: "Which Campaign Output to open." },
      },
      required: ["output"],
    },
  },
  {
    name: "preview_output",
    description:
      "Preview a Campaign Output exactly as it would be exported. Use for 'preview the proposal', 'preview the media plan'.",
    parameters: {
      type: "object",
      properties: {
        output: { type: "string", enum: OUTPUT_KINDS, description: "Which Campaign Output to preview." },
      },
      required: ["output"],
    },
  },
  {
    name: "explain_output_staleness",
    description:
      "Explain precisely why a Campaign Output needs updating. Use for 'why does the proposal need updating?', 'why is the media plan out of date?'.",
    parameters: {
      type: "object",
      properties: {
        output: { type: "string", enum: OUTPUT_KINDS, description: "Which Campaign Output to explain." },
      },
      required: ["output"],
    },
  },
  {
    name: "compare_output_versions",
    description:
      "Compare two versions of a Campaign Output (defaults to the last two). Use for 'compare the last two versions of the strategy', 'compare version 1 and 3 of the media plan'.",
    parameters: {
      type: "object",
      properties: {
        output: { type: "string", enum: OUTPUT_KINDS, description: "Which Campaign Output to compare." },
        from: { type: "number", description: "Earlier version number (optional)." },
        to: { type: "number", description: "Later version number (optional)." },
      },
      required: ["output"],
    },
  },
  {
    name: "undo_last_change",
    description: "Revert the campaign to the version before the most recent change.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "restore_version",
    description: "Restore the campaign to a specific earlier version by its version number.",
    parameters: {
      type: "object",
      properties: {
        version: { type: "number", description: "The version number to restore." },
      },
      required: ["version"],
    },
  },
  {
    name: "answer_question",
    description:
      "Answer a question about the current campaign (why creators were chosen, budget split, strategy, alternatives) grounded strictly in the campaign context. Does not modify the campaign.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The user's question, restated." },
      },
      required: ["question"],
    },
  },
  {
    name: "clarify",
    description:
      "Ask ONE specific clarifying question that references the current campaign's actual contents. Use only when the request is genuinely ambiguous — never ask which campaign.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The contextual clarifying question." },
      },
      required: ["question"],
    },
  },
];

const TIER_KEYWORDS: Array<{ re: RegExp; tier: string }> = [
  { re: /\bcelebrit(?:y|ies)\b|\bmega\b/i, tier: "Celebrity" },
  { re: /\bmacros?\b/i, tier: "Macro" },
  { re: /\bmid[-\s]?tiers?\b|\bmids?\b/i, tier: "Mid-Tier" },
  { re: /\bmicros?\b/i, tier: "Micro" },
  { re: /\bnanos?\b/i, tier: "Nano" },
];

const REMOVE_RE = /\b(remove|drop|exclude|delete|take out|get rid of|cut)\b/i;
const UNDO_RE = /\b(undo|revert|roll ?back|go back)\b/i;
const QUESTION_RE = /\b(why|what|which|how|show me|explain|who|when)\b|\?\s*$/i;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
};

const MAGNITUDES: Record<string, number> = {
  k: 1_000, thousand: 1_000, m: 1_000_000, mn: 1_000_000, million: 1_000_000,
  bn: 1_000_000_000, billion: 1_000_000_000,
};

const CURRENCY_RE = /\b(EGP|USD|AED|SAR|EUR|GBP|QAR|KWD|BHD|OMR)\b/i;

function parseWeeks(text: string): number | null {
  const digit = text.match(/(\d+)\s*weeks?/i);
  if (digit) return Number(digit[1]);
  const word = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b\s*weeks?/i
  );
  if (word) return NUMBER_WORDS[word[1]!.toLowerCase()] ?? null;
  return null;
}

function parseBudgetAmount(text: string): { amount: number; currency?: string } | null {
  // e.g. "EGP 2M", "2,000,000", "budget to 2m"
  const m = text.match(/([\d][\d,.]*)\s*(k|m|mn|bn|thousand|million|billion)?/i);
  if (!m) return null;
  const base = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(base) || base <= 0) return null;
  const magnitude = m[2] ? (MAGNITUDES[m[2].toLowerCase()] ?? 1) : 1;
  const currency = text.match(CURRENCY_RE)?.[1]?.toUpperCase();
  return { amount: base * magnitude, currency };
}

/** Extract quoted names or @handles for name-based removal. */
function extractNames(message: string): string[] {
  const names: string[] = [];
  for (const m of message.matchAll(/"([^"]+)"|'([^']+)'|@([\w.]+)/g)) {
    const name = (m[1] ?? m[2] ?? m[3])?.trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * Deterministic fallback used when the model is unavailable (no API key, tests)
 * or returns no tool call. Covers the highest-frequency edits so the Copilot is
 * never dead. The model, when present, handles the long tail.
 */
export function parseStudioIntentFallback(message: string): StudioCopilotIntent {
  const text = message.trim();

  const restoreMatch = text.match(/\b(?:restore|revert|go back)\b[^\d]*version\s+(\d+)/i);
  if (restoreMatch) {
    return { kind: "restore_version", version: Number(restoreMatch[1]) };
  }

  if (UNDO_RE.test(text) && !REMOVE_RE.test(text)) {
    return { kind: "undo_last_change" };
  }

  if (/\bbudget\b/i.test(text)) {
    const budget = parseBudgetAmount(text);
    if (budget) {
      return { kind: "update_budget", amount: budget.amount, currency: budget.currency };
    }
  }

  if (/\b(duration|weeks?|timeline|length)\b/i.test(text)) {
    const weeks = parseWeeks(text);
    if (weeks) return { kind: "update_timeline", durationWeeks: weeks };
  }

  // "replace macro creators with micro creators" — split on "with", read each side.
  if (/\breplace\b/i.test(text) && /\bwith\b/i.test(text)) {
    const [fromPart, toPart] = text.split(/\bwith\b/i);
    const fromTier = TIER_KEYWORDS.find((t) => t.re.test(fromPart ?? ""))?.tier;
    const toTier = TIER_KEYWORDS.find((t) => t.re.test(toPart ?? ""))?.tier;
    if (fromTier || toTier) {
      return {
        kind: "replace_creators",
        fromTier,
        toTier,
        higherEngagement: /higher[-\s]?engagement/i.test(text),
      };
    }
  }

  if (REMOVE_RE.test(text)) {
    // "remove creators from/in Cairo" — location-based removal.
    const location = text.match(
      /creators?\s+(?:from|in|based in|located in)\s+([A-Za-z][A-Za-z\s'-]{1,40})/i
    );
    if (location?.[1]) {
      return { kind: "remove_creators", city: location[1].trim() };
    }
    const tier = TIER_KEYWORDS.find((t) => t.re.test(text))?.tier;
    const names = extractNames(text);
    if (tier || names.length > 0) {
      return { kind: "remove_creators", tier, names, reason: text };
    }
  }

  // "add parenting creators" / "add more micro creators"
  const addMatch = text.match(
    /\badd\b\s+(?:some\s+|more\s+|a\s+few\s+)?([\w\s&]+?)\s+(?:creators?|influencers?)\b/i
  );
  if (/\badd\b/i.test(text) && addMatch?.[1]) {
    const descriptor = addMatch[1].trim();
    const tier = TIER_KEYWORDS.find((t) => t.re.test(descriptor))?.tier;
    // The non-tier remainder is the content category (e.g. "parenting").
    const category = tier
      ? descriptor.replace(TIER_KEYWORDS.find((t) => t.re.test(descriptor))!.re, "").trim()
      : descriptor;
    return {
      kind: "add_creators",
      tier,
      category: category && !/^(more|some|new)$/i.test(category) ? category : undefined,
    };
  }

  // Campaign Outputs Engine — generate / regenerate / export a whole-campaign
  // output. Requires an explicit output verb so content-editing phrasings
  // ("rewrite the strategy", "make it premium") still fall through to authoring.
  const outputKind = resolveOutputKind(text);
  if (outputKind) {
    // Inspection / navigation ops first (distinct verbs from generate/export).
    if (/\bwhy\b/i.test(text) && /\b(need|needs|update|updating|out of date|stale|regenerat)/i.test(text)) {
      return { kind: "explain_output_staleness", output: outputKind };
    }
    if (/\bcompare\b/i.test(text)) {
      const nums = [...text.matchAll(/\bv(?:ersion)?\s*(\d+)\b/gi)].map((m) => Number(m[1]));
      return {
        kind: "compare_output_versions",
        output: outputKind,
        from: nums[0],
        to: nums[1],
      };
    }
    if (/\bpreview\b/i.test(text)) return { kind: "preview_output", output: outputKind };
    if (/\bopen\b/i.test(text)) return { kind: "open_output", output: outputKind };
    if (/\b(export|download)\b/i.test(text)) {
      return { kind: "export_output", output: outputKind };
    }
    if (/\b(regenerate|rebuild|re-?generate|re-?run|refresh)\b/i.test(text)) {
      return { kind: "regenerate_output", output: outputKind };
    }
    if (/\b(generate|create|build|produce|assemble)\b/i.test(text)) {
      return { kind: "generate_output", output: outputKind };
    }
  }
  // "compare the last two versions" with no explicit output named.
  if (/\bcompare\b/i.test(text) && /\bversions?\b/i.test(text)) {
    return { kind: "compare_output_versions" };
  }

  // Whole-proposal tone pass — re-author the narrative sections together.
  const TONE_RE =
    /\b(premium|executive|youth[-\s]?focused|data[-\s]?driven|creative|cmo[-\s]?ready|concise|bold|aggressive|professional|punchy|luxurious|sophisticated)\b/i;
  const WHOLE_PROPOSAL_RE = /\b(whole|entire|full|overall|the)\s+(proposal|presentation|deck|document|campaign)\b/i;
  if ((WHOLE_PROPOSAL_RE.test(text) || /\bpresentation\b/i.test(text)) && /\bmore\b|\bmake\b/i.test(text)) {
    const toneMatch = text.match(TONE_RE) ?? text.match(/\bmore\s+([a-z]+(?:-[a-z]+)?)\b/i);
    const tone = (toneMatch?.[1] ?? toneMatch?.[0])?.toLowerCase().replace(/\s+/g, "-");
    if (tone) return { kind: "retone_proposal", tone };
  }

  // Content authoring: rewrite / tone / expand / shorten / strengthen / list edits.
  const LIST_NOUN_RE = /\b(concepts?|kpis?|kpi recommendations?|risks?|mitigations?)\b/i;
  const AUTHOR_RE =
    /\b(rewrite|reword|rephrase|improve|polish|refine|expand|shorten|lengthen|strengthen|elevate|sharpen|tighten|make it|make the|make this|more|replace|add|remove)\b/i;
  if (AUTHOR_RE.test(text) && (LIST_NOUN_RE.test(text) || !/\bcreator|influencer|budget|platform|version\b/i.test(text))) {
    const target: SectionAuthorTarget | undefined = /\bexecutive summary|exec summary\b/i.test(text)
      ? "executive_summary"
      : /\bconcepts?\b/i.test(text)
        ? "creative_concepts"
        : /\bkpi/i.test(text)
          ? "kpis"
          : /\brisks?|mitigations?\b/i.test(text)
            ? "risks"
            : /\bstrateg|business case\b/i.test(text)
              ? "strategy"
              : undefined;
    const toneMatch = text.match(
      /\bmore\s+([a-z]+(?:-[a-z]+)?)\b|\b(premium|executive|youth[-\s]?focused|data[-\s]?driven|creative|cmo[-\s]?ready|concise|bold|aggressive|professional|punchy)\b/i
    );
    const tone = (toneMatch?.[1] ?? toneMatch?.[2])?.toLowerCase().replace(/\s+/g, "-");
    return { kind: "author_section", target, instruction: text, tone };
  }

  if (QUESTION_RE.test(text)) {
    return { kind: "answer_question", question: text };
  }

  return {
    kind: "clarify",
    question:
      "Could you tell me exactly which part of the campaign you'd like to change — the creators, budget, timeline, audience, or strategy?",
  };
}

/** Parse a model tool call into a typed intent; null if the call is unusable. */
export function parseToolCallIntent(call: LlmToolCall): StudioCopilotIntent | null {
  let args: Record<string, unknown> = {};
  try {
    args = call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {};
  } catch {
    args = {};
  }

  switch (call.name) {
    case "remove_creators":
      return {
        kind: "remove_creators",
        tier: typeof args.tier === "string" ? args.tier : undefined,
        names: Array.isArray(args.names)
          ? args.names.filter((n): n is string => typeof n === "string")
          : undefined,
        city: typeof args.city === "string" ? args.city : undefined,
        country: typeof args.country === "string" ? args.country : undefined,
        belowEngagement:
          typeof args.belowEngagement === "number" ? args.belowEngagement : undefined,
        reason: typeof args.reason === "string" ? args.reason : undefined,
      };
    case "add_creators":
      return {
        kind: "add_creators",
        category: typeof args.category === "string" ? args.category : undefined,
        tier: typeof args.tier === "string" ? args.tier : undefined,
        city: typeof args.city === "string" ? args.city : undefined,
        country: typeof args.country === "string" ? args.country : undefined,
        count: typeof args.count === "number" ? args.count : undefined,
      };
    case "replace_creators":
      return {
        kind: "replace_creators",
        fromTier: typeof args.fromTier === "string" ? args.fromTier : undefined,
        fromNames: Array.isArray(args.fromNames)
          ? args.fromNames.filter((n): n is string => typeof n === "string")
          : undefined,
        toTier: typeof args.toTier === "string" ? args.toTier : undefined,
        toCategory: typeof args.toCategory === "string" ? args.toCategory : undefined,
        higherEngagement:
          typeof args.higherEngagement === "boolean" ? args.higherEngagement : undefined,
      };
    case "update_budget":
      return {
        kind: "update_budget",
        amount: typeof args.amount === "number" ? args.amount : Number(args.amount) || 0,
        currency: typeof args.currency === "string" ? args.currency : undefined,
      };
    case "update_timeline":
      return {
        kind: "update_timeline",
        durationWeeks:
          typeof args.durationWeeks === "number"
            ? args.durationWeeks
            : Number(args.durationWeeks) || 0,
      };
    case "update_platforms":
      return {
        kind: "update_platforms",
        platforms: Array.isArray(args.platforms)
          ? args.platforms.filter((p): p is string => typeof p === "string")
          : [],
      };
    case "update_objectives":
      return {
        kind: "update_objectives",
        objective: typeof args.objective === "string" ? args.objective : "",
      };
    case "update_audience":
      return {
        kind: "update_audience",
        audience: typeof args.audience === "string" ? args.audience : "",
      };
    case "update_market":
      return {
        kind: "update_market",
        geography: Array.isArray(args.geography)
          ? args.geography.filter((g): g is string => typeof g === "string")
          : [],
      };
    case "author_section":
      return {
        kind: "author_section",
        target: AUTHOR_TARGETS.includes(args.target as SectionAuthorTarget)
          ? (args.target as SectionAuthorTarget)
          : undefined,
        instruction: typeof args.instruction === "string" ? args.instruction : "",
        tone: typeof args.tone === "string" ? args.tone : undefined,
      };
    case "retone_proposal":
      return { kind: "retone_proposal", tone: typeof args.tone === "string" ? args.tone : "" };
    case "generate_output":
      return { kind: "generate_output", output: coerceOutputKind(args.output) };
    case "regenerate_output":
      return { kind: "regenerate_output", output: coerceOutputKind(args.output) };
    case "export_output":
      return { kind: "export_output", output: coerceOutputKind(args.output) };
    case "open_output":
      return { kind: "open_output", output: coerceOutputKind(args.output) };
    case "preview_output":
      return { kind: "preview_output", output: coerceOutputKind(args.output) };
    case "explain_output_staleness":
      return { kind: "explain_output_staleness", output: coerceOutputKind(args.output) };
    case "compare_output_versions":
      return {
        kind: "compare_output_versions",
        output: coerceOutputKind(args.output),
        from: typeof args.from === "number" ? args.from : undefined,
        to: typeof args.to === "number" ? args.to : undefined,
      };
    case "undo_last_change":
      return { kind: "undo_last_change" };
    case "restore_version":
      return {
        kind: "restore_version",
        version: typeof args.version === "number" ? args.version : Number(args.version) || 0,
      };
    case "answer_question":
      return {
        kind: "answer_question",
        question: typeof args.question === "string" ? args.question : "",
      };
    case "clarify":
      return {
        kind: "clarify",
        question: typeof args.question === "string" ? args.question : "",
      };
    default:
      // A known-but-not-yet-executable intent name still resolves to its kind.
      return { kind: call.name, ...args } as StudioCopilotIntent;
  }
}
