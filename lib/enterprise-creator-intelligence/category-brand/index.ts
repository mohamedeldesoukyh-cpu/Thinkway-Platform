export type {
  AnalysisWindowKey,
  BrandAffinityKind,
  BrandAffinitySummary,
  BrandCollaboration,
  BrandCollaborationKind,
  CategoryBrandBusinessReadiness,
  CategoryBrandConfidence,
  CategoryBrandExplainability,
  CategoryBrandHistoryCapture,
  CategoryBrandSource,
  CategoryShare,
  CategoryTrendLabel,
  ContentConsistencyInsight,
  ContentConsistencyLevel,
  ContentMixShare,
  ContentMixType,
  CreatorCategoryBrandAiHints,
  CreatorCategoryBrandIntelligence,
  IndustryShare,
  SpecialisationInsight,
  SpecialisationLevel,
  WindowCategoryBundle,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";

export {
  ANALYSIS_WINDOWS,
  CATEGORY_BRAND_CONSUMERS,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";

export {
  classifyContentMixTypes,
  classifyPostCategories,
  classifySponsored,
  industryFromCategory,
  toPostFact,
  type CategoryBrandPostFact,
} from "@/lib/enterprise-creator-intelligence/category-brand/classify";

export {
  assertPercentTotal100,
  buildCategoryShares,
  normalizeToHundred,
} from "@/lib/enterprise-creator-intelligence/category-brand/distribution";

export {
  computeCreatorCategoryBrandIntelligence,
  type CreatorCategoryBrandFacts,
} from "@/lib/enterprise-creator-intelligence/category-brand/compute";

export { loadCreatorCategoryBrandFacts } from "@/lib/enterprise-creator-intelligence/category-brand/load-facts";

export { appendCategoryBrandIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/category-brand/persist";

export {
  buildCategoryBrandAiHints,
  loadCreatorCategoryBrandIntelligence,
} from "@/lib/enterprise-creator-intelligence/category-brand/load";
