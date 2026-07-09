import { BaseAiAgent } from "../agents/base-agent";
import type { AiContext, AiRequest } from "../types";

export class GeneralAgent extends BaseAiAgent {
  readonly id = "general";
  readonly name = "General Assistant";
  readonly capabilities = ["general"] as const;
  readonly priority = 0;
  protected readonly promptTemplateId = "agent.general";
  protected readonly defaultToolNames = [] as const;

  /** Routing is handled centrally by AgentRouter — agents do not self-select. */
  canHandle(_request: AiRequest, _context: AiContext): boolean {
    return false;
  }
}

export const generalAgent = new GeneralAgent();
