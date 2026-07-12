import type { LlmProvider } from "@/features/ai/types/llm";

/** The list operation implied by an instruction. */
export type ListOperation = "replace" | "add" | "improve" | "remove";

/** Decide the operation from the user's words + whether an element is focused. */
export function resolveListOperation(instruction: string, hasIndex: boolean): ListOperation {
  const t = instruction.toLowerCase();
  if (/\b(remove|delete|drop|take out|get rid of)\b/.test(t)) return "remove";
  if (/\b(add|another|one more|include|extra)\b/.test(t)) return "add";
  if (
    hasIndex ||
    /\b(improve|stronger|better|sharpen|expand|refine|rewrite|polish|enhance|elevate)\b/.test(t)
  ) {
    return "improve";
  }
  if (/\b(replace|new|different|fresh|redo|regenerate|overhaul)\b/.test(t)) return "replace";
  // Default for a list edit with no clear verb: refresh the whole list.
  return "replace";
}

/** Parse "first/second/... " or "1st/2nd/..." → 0-based index. */
export function parseOrdinalIndex(instruction: string): number | undefined {
  const words: Record<string, number> = {
    first: 0, second: 1, third: 2, fourth: 3, fifth: 4, sixth: 5,
    "1st": 0, "2nd": 1, "3rd": 2, "4th": 3, "5th": 4, "6th": 5,
  };
  const m = instruction.toLowerCase().match(/\b(first|second|third|fourth|fifth|sixth|\dst|\dnd|\drd|\dth)\b/);
  if (m && m[1] in words) return words[m[1]];
  return undefined;
}

function extractJsonArray(text: string): unknown[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export type ListAuthorConfig<T> = {
  /** Label for prompts + summaries, e.g. "creative concept". */
  noun: string;
  /** JSON schema hint the model must follow for each item. */
  itemSchemaHint: string;
  /** Structural validator — reject items missing required fields. */
  validate: (item: unknown) => item is T;
  /** Fill defaults / coerce a raw item before validation. */
  coerce?: (raw: Record<string, unknown>) => Record<string, unknown>;
};

const GROUNDING_RULE =
  "Stay strictly grounded in the campaign context. Never invent creators, budget figures, dates, or metrics not in the context. Return ONLY JSON, no commentary.";

async function complete(provider: LlmProvider, system: string, user: string): Promise<string | null> {
  try {
    const response = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
    });
    return response.content ?? null;
  } catch {
    return null;
  }
}

export type ListAuthorResult<T> = {
  list: T[];
  /** Verb applied, for the change summary. */
  operation: ListOperation;
  /** Number of items affected. */
  affected: number;
};

/**
 * Author a typed list in a section: add one, replace all, improve one, or remove
 * one — the model writes the content, a deterministic validator gates the shape.
 */
export async function authorList<T>(
  provider: LlmProvider,
  config: ListAuthorConfig<T>,
  input: {
    digest: string;
    current: T[];
    instruction: string;
    tone?: string;
    operation: ListOperation;
    index?: number;
  }
): Promise<ListAuthorResult<T> | null> {
  const toneLine = input.tone ? `Desired tone: ${input.tone}.` : "";
  const system = `You are the Thinkway Campaign Strategist authoring ${config.noun}s for a campaign. ${GROUNDING_RULE}`;

  // "Add X" to an empty section means generate the initial set, not append one.
  const operation =
    input.operation === "add" && input.current.length === 0 ? "replace" : input.operation;

  // Remove needs no model call.
  if (operation === "remove") {
    const index = input.index;
    if (index == null || index < 0 || index >= input.current.length) return null;
    const list = input.current.filter((_, i) => i !== index);
    return { list, operation: "remove", affected: 1 };
  }

  if (operation === "improve") {
    const index = input.index ?? 0;
    const targetItem = input.current[index];
    if (!targetItem) return null;
    const raw = await complete(
      provider,
      system,
      `Campaign context:\n${input.digest}\n\n${toneLine}\nInstruction: ${input.instruction}\n\nImprove this single ${config.noun} (JSON):\n${JSON.stringify(targetItem, null, 2)}\n\nReturn ONE improved JSON object with the same schema: ${config.itemSchemaHint}`
    );
    if (!raw) return null;
    const obj = extractJsonObject(raw);
    if (!obj) return null;
    const coerced = config.coerce ? config.coerce(obj) : obj;
    if (!config.validate(coerced)) return null;
    const list = input.current.map((item, i) => (i === index ? coerced : item));
    return { list, operation: "improve", affected: 1 };
  }

  // add | replace → author fresh item(s).
  const wantCount = operation === "add" ? 1 : Math.max(input.current.length || 3, 3);
  const raw = await complete(
    provider,
    system,
    `Campaign context:\n${input.digest}\n\n${toneLine}\nInstruction: ${input.instruction}\n\n${
      operation === "add"
        ? `Existing ${config.noun}s (JSON): ${JSON.stringify(input.current)}\nWrite ONE new ${config.noun} that complements them.`
        : `Write ${wantCount} strong ${config.noun}s.`
    }\nReturn a JSON array where each item is: ${config.itemSchemaHint}`
  );
  if (!raw) return null;
  const arr = extractJsonArray(raw);
  if (!arr) return null;
  const items: T[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const coerced = config.coerce ? config.coerce(x as Record<string, unknown>) : (x as Record<string, unknown>);
    if (config.validate(coerced)) items.push(coerced);
  }
  if (items.length === 0) return null;

  if (operation === "add") {
    return { list: [...input.current, items[0]!], operation: "add", affected: 1 };
  }
  return { list: items, operation: "replace", affected: items.length };
}
