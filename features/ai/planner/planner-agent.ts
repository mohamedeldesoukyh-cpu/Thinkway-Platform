import { BaseAiAgent } from "../agents/base-agent";
import type { AiContext, AiRequest } from "../types";

export class PlannerAgent extends BaseAiAgent {
  readonly id = "planner";
  readonly name = "Campaign Planner";
  readonly capabilities = ["planning"] as const;
  readonly priority = 70;
  protected readonly promptTemplateId = "agent.planner";
  protected readonly defaultToolNames = [
    "getCampaign",
    "getClient",
    "buildCampaign",
    "generateBrief",
  ] as const;

  /** @deprecated Routing handled by AgentRouter. */
  canHandle(_request: AiRequest, _context: AiContext): boolean {
    return false;
  }
}

export const plannerAgent = new PlannerAgent();
