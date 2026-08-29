import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { creatorScriptStatusView } from "./assignment-policy";
import { loadCampaignScriptAssignment, loadCampaignScriptAssignmentById } from "./assignments";
import { loadCampaignScriptMaster, loadCampaignScriptRevisionById } from "./load-master";
import { loadCampaignScriptOverrideView } from "./save-override";
import type {
  CampaignScriptAssignmentRecord,
  CampaignScriptMasterView,
  CreatorScriptStatusView,
} from "./types";

type Supabase = SupabaseClient<Database>;

export type CreatorCampaignScriptBundle = {
  assignment: CampaignScriptAssignmentRecord | null;
  master: CampaignScriptMasterView | null;
  effective: CampaignScriptMasterView | null;
  status: CreatorScriptStatusView | null;
  readOnly: boolean;
};

async function forkedFromVersion(
  supabase: Supabase,
  assignment: CampaignScriptAssignmentRecord | null
): Promise<string | null> {
  if (!assignment?.forkedFromMasterRevisionId) return null;
  const revision = await loadCampaignScriptRevisionById(
    supabase,
    assignment.forkedFromMasterRevisionId
  );
  return revision?.business_version ?? null;
}

export async function loadCreatorCampaignScript(
  supabase: Supabase,
  input: { campaignHeaderId: string; influencerId: string }
): Promise<CreatorCampaignScriptBundle> {
  const master = await loadCampaignScriptMaster(supabase, input.campaignHeaderId);
  const assignment = master
    ? await loadCampaignScriptAssignment(supabase, {
        scriptId: master.scriptId,
        influencerId: input.influencerId,
      })
    : null;
  const effective =
    assignment?.mode === "customized"
      ? await loadCampaignScriptOverrideView(supabase, assignment)
      : master;
  const status = creatorScriptStatusView({
    influencerId: input.influencerId,
    assignment,
    masterVersion: master?.businessVersion ?? null,
    forkedFromVersion: await forkedFromVersion(supabase, assignment),
    masterRevisionId: master?.currentRevisionId ?? null,
  });
  return {
    assignment,
    master,
    effective,
    status,
    readOnly: assignment?.mode !== "customized",
  };
}

export async function loadCreatorCampaignScriptByAssignmentId(
  supabase: Supabase,
  assignmentId: string
): Promise<CreatorCampaignScriptBundle | null> {
  const assignment = await loadCampaignScriptAssignmentById(supabase, assignmentId);
  if (!assignment) return null;
  return loadCreatorCampaignScript(supabase, {
    campaignHeaderId: assignment.campaignHeaderId,
    influencerId: assignment.influencerId,
  });
}
