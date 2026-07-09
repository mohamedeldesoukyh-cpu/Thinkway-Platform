export type SseEvent = {
  event: string;
  data: unknown;
};

export type ParsedSseEvent = {
  event: string;
  data: Record<string, unknown>;
};

export function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Safely parse SSE JSON payload; returns null for empty or incomplete data. */
export function safeParseSseData(dataLine: string): Record<string, unknown> | null {
  const trimmed = dataLine.trim();
  if (!trimmed) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Parse a single SSE event block (lines between blank-line delimiters). */
export function parseSseEventBlock(block: string): ParsedSseEvent | null {
  if (!block.trim()) return null;

  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;

  const data = safeParseSseData(dataLines.join("\n"));
  if (!data) return null;

  return { event, data };
}

/**
 * Split an SSE buffer into complete events and a trailing partial block.
 * Never parses incomplete JSON — partial blocks stay in the remainder.
 */
export function splitSseBuffer(buffer: string): {
  events: ParsedSseEvent[];
  remainder: string;
} {
  const events: ParsedSseEvent[] = [];
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    const parsed = parseSseEventBlock(part);
    if (parsed) events.push(parsed);
  }

  return { events, remainder };
}

export function createSseStream(
  handler: (send: (event: string, data: unknown) => void) => Promise<void>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event, data)));
      };

      try {
        await handler(send);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Stream failed";
        send("error", { message });
      } finally {
        controller.close();
      }
    },
  });
}

/** Split text into word chunks for progressive display when orchestrator returns full content. */
export function* chunkTextForStream(text: string, chunkSize = 24): Generator<string> {
  if (!text) return;
  let index = 0;
  while (index < text.length) {
    const slice = text.slice(index, index + chunkSize);
    yield slice;
    index += chunkSize;
  }
}
