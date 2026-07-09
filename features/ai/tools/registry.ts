import type {
  AiContext,
  AiToolDefinition,
  AnyAiToolDefinition,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolRegistrySnapshot,
} from "../types";

export class ToolRegistry {
  private readonly tools = new Map<string, AnyAiToolDefinition>();

  register(tool: AnyAiToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: AnyAiToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): AnyAiToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): AnyAiToolDefinition[] {
    return Array.from(this.tools.values());
  }

  snapshot(): ToolRegistrySnapshot {
    return {
      tools: this.list().map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    };
  }

  async execute(
    request: ToolExecutionRequest,
    context: AiContext
  ): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const tool = this.tools.get(request.toolName);

    if (!tool) {
      return {
        toolName: request.toolName,
        success: false,
        error: `Tool not found: ${request.toolName}`,
        durationMs: Date.now() - startedAt,
      };
    }

    try {
      const parsedInput = tool.inputSchema.parse(request.input);
      const output = await tool.execute(parsedInput, context);
      const validatedOutput = tool.outputSchema.parse(output);

      return {
        toolName: request.toolName,
        success: true,
        output: validatedOutput,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown tool execution error";
      return {
        toolName: request.toolName,
        success: false,
        error: message,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  async executeMany(
    requests: ToolExecutionRequest[],
    context: AiContext
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    for (const request of requests) {
      results.push(await this.execute(request, context));
    }
    return results;
  }
}

export function createToolRegistry(tools: AnyAiToolDefinition[] = []): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerMany(tools);
  return registry;
}
