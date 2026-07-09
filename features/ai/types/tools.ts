import type { z } from "zod";

import type { AiContext } from "./context";

export interface AiToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  execute: (input: TInput, context: AiContext) => Promise<TOutput>;
}

export type AiTool<TInput = unknown, TOutput = unknown> = AiToolDefinition<
  TInput,
  TOutput
>;

/** Erased tool type for heterogeneous registries. */
export type AnyAiToolDefinition = AiToolDefinition<any, any>;

export interface ToolExecutionRequest {
  toolName: string;
  input: unknown;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

export interface ToolRegistrySnapshot {
  tools: Array<{
    name: string;
    description: string;
  }>;
}
