export { ToolRegistry, createToolRegistry } from "./registry";
export { DEFAULT_TOOLS } from "./definitions";
export {
  searchCreatorsTool,
  getCreatorTool,
  getCampaignTool,
  getClientTool,
  getShortlistTool,
  createShortlistTool,
  buildCampaignTool,
  generateBriefTool,
  generateReportTool,
} from "./definitions";
export * from "./schemas";

import { createToolRegistry } from "./registry";
import { DEFAULT_TOOLS } from "./definitions";

let defaultRegistry: ReturnType<typeof createToolRegistry> | undefined;

export function getDefaultToolRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = createToolRegistry(DEFAULT_TOOLS);
  }
  return defaultRegistry;
}

export function resetDefaultToolRegistry(): void {
  defaultRegistry = undefined;
}
