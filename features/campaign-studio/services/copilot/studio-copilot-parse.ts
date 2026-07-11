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
