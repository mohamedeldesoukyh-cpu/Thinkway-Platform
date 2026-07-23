"use client";

import dynamic from "next/dynamic";

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
import { SectionSkeleton } from "./shared/section-skeleton";

export { STUDIO_LAYOUT, getSectionLayout, isFullWidthSection, type StudioLayoutType };

const sectionLoading = () => <SectionSkeleton />;

/** Each studio section is its own chunk — only fetched when the section body mounts. */
const CampaignSummarySection = dynamic(
  () =>
    import("./campaign-summary-section").then((m) => m.CampaignSummarySection),
  { loading: sectionLoading, ssr: false }
);
const ExecutiveStrategySection = dynamic(
  () =>
    import("./executive-strategy-section").then((m) => m.ExecutiveStrategySection),
  { loading: sectionLoading, ssr: false }
);
const VendorDiscoverySection = dynamic(
  () =>
    import("./vendor-discovery-section").then((m) => m.VendorDiscoverySection),
  { loading: sectionLoading, ssr: false }
);
const VendorRecommendationsSection = dynamic(
  () =>
    import("./vendor-recommendations-section").then(
      (m) => m.VendorRecommendationsSection
    ),
  { loading: sectionLoading, ssr: false }
);
const BudgetPlannerSection = dynamic(
  () =>
    import("./budget-planner-section").then((m) => m.BudgetPlannerSection),
  { loading: sectionLoading, ssr: false }
);
const TimelineSection = dynamic(
  () => import("./timeline-section").then((m) => m.TimelineSection),
  { loading: sectionLoading, ssr: false }
);
const KpiForecastSection = dynamic(
  () => import("./kpi-forecast-section").then((m) => m.KpiForecastSection),
  { loading: sectionLoading, ssr: false }
);
const RiskAnalysisSection = dynamic(
  () => import("./risk-analysis-section").then((m) => m.RiskAnalysisSection),
  { loading: sectionLoading, ssr: false }
);
const CreativeConceptsSection = dynamic(
  () =>
    import("./creative-concepts-section").then((m) => m.CreativeConceptsSection),
  { loading: sectionLoading, ssr: false }
);
const ContentPlanSection = dynamic(
  () => import("./content-plan-section").then((m) => m.ContentPlanSection),
  { loading: sectionLoading, ssr: false }
);
const CreatorMixSection = dynamic(
  () => import("./creator-mix-section").then((m) => m.CreatorMixSection),
  { loading: sectionLoading, ssr: false }
);
const WhyAiSection = dynamic(
  () => import("./why-ai-section").then((m) => m.WhyAiSection),
  { loading: sectionLoading, ssr: false }
);
const IndustryBenchmarkSection = dynamic(
  () =>
    import("./industry-benchmark-section").then((m) => m.IndustryBenchmarkSection),
  { loading: sectionLoading, ssr: false }
);
const SuccessProbabilitySection = dynamic(
  () =>
    import("./success-probability-section").then((m) => m.SuccessProbabilitySection),
  { loading: sectionLoading, ssr: false }
);
const OpportunityFinderSection = dynamic(
  () =>
    import("./opportunity-finder-section").then((m) => m.OpportunityFinderSection),
  { loading: sectionLoading, ssr: false }
);
const ExecutiveSummarySection = dynamic(
  () =>
    import("./executive-summary-section").then((m) => m.ExecutiveSummarySection),
  { loading: sectionLoading, ssr: false }
);
const PresentationStatusSection = dynamic(
  () =>
    import("./presentation-status-section").then((m) => m.PresentationStatusSection),
  { loading: sectionLoading, ssr: false }
);

type SectionRendererProps = {
  section: CampaignStudioSection;
  campaignObject?: CampaignObject;
  decisionMode?: CampaignStudioDecisionMode;
  conversationId?: string;
  messageId?: string;
  onVendorDecisionsUpdated?: (
    decisions: Record<string, "approved" | "rejected" | "shortlisted">
  ) => void;
  onSlateUpdated?: (campaignObject: Record<string, unknown>) => void;
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
  onSlateUpdated,
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
      return (
        <CampaignSummarySection
          {...common}
          conversationId={conversationId}
          messageId={messageId}
          onBriefApplied={onSlateUpdated}
        />
      );
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
          onSlateUpdated={onSlateUpdated}
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
