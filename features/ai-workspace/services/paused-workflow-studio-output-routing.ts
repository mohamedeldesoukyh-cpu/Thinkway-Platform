import { parseStudioIntentFallback } from "@/features/campaign-studio/services/copilot/studio-copilot-parse";

/**
 * A paused create-campaign workflow normally owns the next reply. The explicit
 * Proposal commands emitted by the Outputs Center are an exception: they have
 * an existing Campaign Object and a deterministic Studio executor.
 *
 * Keep this intentionally narrow. Other Studio edits and free-form prompts
 * must continue through the paused workflow until it has the missing facts.
 */
export function shouldRoutePausedWorkflowToStudioOutput(input: {
  hasCampaignObject: boolean;
  message: string;
}): boolean {
  if (!input.hasCampaignObject) return false;

  const intent = parseStudioIntentFallback(input.message);
  return (
    (intent.kind === "generate_output" || intent.kind === "regenerate_output") &&
    intent.output === "executive_proposal"
  );
}
