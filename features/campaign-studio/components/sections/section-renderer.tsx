"use client";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { StudioDraftState } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStudioDecisionMode } from "@/features/campaign-decision-workspace/types/studio-decision-mode";

import {
  getSectionLayout,
  isFullWidthSection,
  STUDIO_LAYOUT,
  type StudioLayoutType,
} from "../../constants/studio-layout";
import type { CampaignStudioSection } from "../../types/campaign-studio";
import { CampaignSummarySection } from "./campaign-summary-section";
import { ExecutiveStrategySection } from "./executive-strategy-section";
import { VendorDiscoverySection } from "./vendor-discovery-section";
import { VendorRecommendationsSection } from "./vendor-recommendations-section";
import { BudgetPlannerSection } from "./budget-planner-section";
import { TimelineSection } from "./timeline-section";
import { KpiForecastSection } from "./kpi-forecast-section";
import { RiskAnalysisSection } from "./risk-analysis-section";
import { CreativeConceptsSection } from "./creative-concepts-section";
import { ContentPlanSection } from "./content-plan-section";
import { CreatorMixSection } from "./creator-mix-section";
import { WhyAiSection } from "./why-ai-section";
import { IndustryBenchmarkSection } from "./industry-benchmark-section";
import { SuccessProbabilitySection } from "./success-probability-section";
import { OpportunityFinderSection } from "./opportunity-finder-section";
import { ExecutiveSummarySection } from "./executive-summary-section";
import { PresentationStatusSection } from "./presentation-status-section";

export { STUDIO_LAYOUT, getSectionLayout, isFullWidthSection, type StudioLayoutType };

type SectionRendererProps = {
  section: CampaignStudioSection;
  campaignObject?: CampaignObject;
  decisionMode?: CampaignStudioDecisionMode;
  conversationId?: string;
  messageId?: string;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  studioDraft?: StudioDraftState;
  onStudioDraftUpdated?: (draft: StudioDraftState) => void;
  appliedRemovedCreatorIds?: string[];
};

export function SectionRenderer({
  section,
  campaignObject,
  decisionMode,
  conversationId,
  messageId,
  onVendorDecisionsUpdated,
  studioDraft,
  onStudioDraftUpdated,
  appliedRemovedCreatorIds,
}: SectionRendererProps) {
  const common = {
    campaignObject,
    fallbackText: section.content,
    status: section.status,
  };

  switch (section.id) {
    case "campaign-summary":
      return <CampaignSummarySection {...common} />;
    case "executive-strategy":
      return <ExecutiveStrategySection {...common} />;
    case "creator-discovery":
      return <VendorDiscoverySection {...common} />;
    case "creator-recommendations":
      return (
        <VendorRecommendationsSection
          {...common}
          onCreatorClick={decisionMode?.onCreatorClick}
          conversationId={conversationId}
          messageId={messageId}
          onVendorDecisionsUpdated={onVendorDecisionsUpdated}
          studioDraft={studioDraft}
          onStudioDraftUpdated={onStudioDraftUpdated}
          appliedRemovedCreatorIds={appliedRemovedCreatorIds}
        />
      );
    case "budget-planner":
      return <BudgetPlannerSection {...common} />;
    case "timeline":
      return <TimelineSection {...common} />;
    case "kpi-forecast":
      return <KpiForecastSection {...common} />;
    case "risk-analysis":
      return <RiskAnalysisSection {...common} />;
    case "creative-concepts":
      return <CreativeConceptsSection {...common} />;
    case "content-plan":
      return <ContentPlanSection {...common} />;
    case "creator-mix":
      return <CreatorMixSection {...common} />;
    case "why-ai":
      return <WhyAiSection {...common} />;
    case "industry-benchmark":
      return <IndustryBenchmarkSection {...common} />;
    case "success-probability":
      return <SuccessProbabilitySection {...common} />;
    case "opportunity-finder":
      return <OpportunityFinderSection {...common} />;
    case "executive-summary":
      return <ExecutiveSummarySection {...common} />;
    case "presentation-status":
      return (
        <PresentationStatusSection
          {...common}
          campaignObjectId={campaignObject?.id}
          conversationId={conversationId}
        />
      );
    default:
      return null;
  }
}
