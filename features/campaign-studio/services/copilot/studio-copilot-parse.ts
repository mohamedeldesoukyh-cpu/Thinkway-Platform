import type { LlmToolCall, LlmToolDefinition } from "@/features/ai/types/llm";

import type { StudioCopilotIntent } from "./studio-copilot-intents";

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
      "Remove creators from the campaign slate. Use `tier` to remove a whole follower tier (Celebrity, Macro, Mid-Tier, Micro, Nano). Use `names` for specific creators by display name or handle. Provide `reason` with the user's stated reason when given.",
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
        reason: { type: "string", description: "The user's stated reason, if any." },
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
    name: "undo_last_change",
    description: "Revert the campaign to the version before the most recent change.",
    parameters: { type: "object", properties: {} },
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

  if (REMOVE_RE.test(text)) {
    const tier = TIER_KEYWORDS.find((t) => t.re.test(text))?.tier;
    const names = extractNames(text);
    if (tier || names.length > 0) {
      return { kind: "remove_creators", tier, names, reason: text };
    }
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
        reason: typeof args.reason === "string" ? args.reason : undefined,
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
    case "undo_last_change":
      return { kind: "undo_last_change" };
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
