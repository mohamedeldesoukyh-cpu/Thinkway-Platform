import type { CreatorChangeDelta } from "@/features/campaign-decision-engine";

import type { CreatorDrawerSelection } from "../components/creator-drawer";
import type { ClientCreatorAssessment } from "../types";

export type CampaignStudioDecisionMode = {
  budgetSlider: {
    value: number;
    onChange: (percentChange: number) => void;
  };
  onCreatorClick: (creator: CreatorDrawerSelection) => void;
  onCreatorAction: (action: CreatorChangeDelta) => void;
  creators: Array<{ id: string; displayName?: string; handle?: string }>;
  clientCreatorAssessments: ClientCreatorAssessment[];
  evaluateClientCreatorUrls: (urls: string[]) => ClientCreatorAssessment[];
};
