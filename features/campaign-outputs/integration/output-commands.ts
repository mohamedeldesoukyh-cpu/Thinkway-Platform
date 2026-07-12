/**
 * Integration seam — map an Outputs Center UI action to the EXACT Campaign
 * Copilot command that performs it.
 *
 * This is the whole point of the integration: buttons and chat share ONE
 * execution path. A card action does not call a generator or a server action of
 * its own — it dispatches the same natural-language command the Copilot already
 * understands, so there is no duplicate execution path and no duplicated logic.
 */

import type { CampaignOutputKind } from "../output-types";
import { getOutputDefinition } from "../output-catalog";

export type OutputAction =
  | "generate"
  | "regenerate"
  | "export"
  | "preview"
  | "open"
  | "compare"
  | "explain_staleness";

function labelFor(kind: CampaignOutputKind): string {
  return getOutputDefinition(kind)?.label ?? kind;
}

/** The Copilot command that applies an Outputs Center action to an output. */
export function outputActionCommand(action: OutputAction, kind: CampaignOutputKind): string {
  const label = labelFor(kind);
  switch (action) {
    case "generate":
      return `Generate the ${label}`;
    case "regenerate":
      return `Regenerate the ${label}`;
    case "export":
      return `Export the ${label}`;
    case "preview":
      return `Preview the ${label}`;
    case "open":
      return `Open the ${label}`;
    case "compare":
      return `Compare the last two versions of the ${label}`;
    case "explain_staleness":
      return `Why does the ${label} need updating?`;
  }
}
