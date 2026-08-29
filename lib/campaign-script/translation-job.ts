import type { ScriptLanguage } from "./types";

export const CAMPAIGN_SCRIPT_TRANSLATE_QUEUE = "campaign-script-translate";
export const CAMPAIGN_SCRIPT_TRANSLATE_JOB_NAME = "translate-campaign-script";

export type CampaignScriptTranslateJobData = {
  campaignHeaderId: string;
  scriptId: string;
  sourceRevisionId: string;
  targetLanguage: ScriptLanguage;
  forceRegenerate: boolean;
  assignmentId?: string | null;
};

export function campaignScriptTranslateJobId(
  scriptId: string,
  sourceRevisionId: string,
  targetLanguage: ScriptLanguage,
  assignmentId?: string | null
): string {
  const assignmentPart = assignmentId?.trim() ? `-${assignmentId.trim()}` : "";
  return `campaign-script-translate-${scriptId}${assignmentPart}-${sourceRevisionId}-${targetLanguage}`;
}
