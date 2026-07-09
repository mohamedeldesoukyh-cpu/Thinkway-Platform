import { BaseAiAgent } from "../agents/base-agent";
import type { AiContext, AiRequest } from "../types";

export class AnalystAgent extends BaseAiAgent {
  readonly id = "analyst";
  readonly name = "Performance Analyst";
  readonly capabilities = ["analysis"] as const;
  readonly priority = 70;
  protected readonly promptTemplateId = "agent.analyst";
  protected readonly defaultToolNames = [
    "getCampaign",
    "generateReport",
  ] as const;

  /** @deprecated Routing handled by AgentRouter. */
  canHandle(_request: AiRequest, _context: AiContext): boolean {
    return false;
  }
}

export const analystAgent = new AnalystAgent();
