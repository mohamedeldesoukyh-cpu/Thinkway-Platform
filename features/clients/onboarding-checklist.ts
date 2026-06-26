import { ONBOARDING_CHECKLIST_SECTIONS } from "@/lib/clients/onboarding-status";

export { ONBOARDING_CHECKLIST_SECTIONS };

/** Exported for tests — validates all checklist section keys are present. */
export function onboardingChecklistSectionsForTests() {
  return ONBOARDING_CHECKLIST_SECTIONS;
}
