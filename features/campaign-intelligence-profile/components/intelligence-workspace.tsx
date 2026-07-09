"use client";

import { CampaignIntelligencePanel } from "./campaign-intelligence-panel";
import type { CampaignIntelligenceWorkspaceState } from "../actions/profile-actions";

type Props = {
  initialState?: CampaignIntelligenceWorkspaceState | null;
};

/** @deprecated Use CampaignIntelligenceSidebar inside Discovery search. */
export function CampaignIntelligenceWorkspace({ initialState }: Props) {
  return <CampaignIntelligencePanel initialState={initialState} />;
}
