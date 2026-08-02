/**
 * Enterprise Creator Intelligence — platform capability (Release 2.3 Phase 1).
 *
 * Powers Planning · Client · Campaign · Reporting · AI Copilot · Mobile.
 * Extends IPL / influencer metrics / Thinkway commercial data — not Discovery.
 *
 * Sprint 1: Historical Creator Intelligence (protected baseline).
 * Sprint 2: Commercial Intelligence (protected baseline).
 * Sprint 3: Category & Brand Intelligence (protected baseline).
 * Sprint 4: Performance Intelligence (protected baseline).
 * Sprint 5: Audience Intelligence (protected baseline).
 * Sprint 6: Creator Investment Intelligence (protected baseline).
 * Platform SSOT entry: loadCreatorIntelligenceBundle (consumer.ts).
 * Spec: docs/architecture/ENTERPRISE_CREATOR_INTELLIGENCE.md
 */

export * from "@/lib/enterprise-creator-intelligence/historical";
export * from "@/lib/enterprise-creator-intelligence/commercial";
export * from "@/lib/enterprise-creator-intelligence/category-brand";
export * from "@/lib/enterprise-creator-intelligence/performance";
export * from "@/lib/enterprise-creator-intelligence/audience";
export * from "@/lib/enterprise-creator-intelligence/investment";
export * from "@/lib/enterprise-creator-intelligence/shared";
export {
  assertSameCreatorIntelligenceObject,
  loadCreatorIntelligenceBundle,
  loadCreatorIntelligenceBundles,
  type CreatorIntelligenceBundle,
} from "@/lib/enterprise-creator-intelligence/consumer";
export {
  ECI_CANONICAL_ENTRY,
  ECI_PLATFORM_CONSUMERS,
  FORBIDDEN_ENTERPRISE_INTELLIGENCE_SSOT,
  isForbiddenEnterpriseIntelligencePath,
} from "@/lib/enterprise-creator-intelligence/ssot-policy";
