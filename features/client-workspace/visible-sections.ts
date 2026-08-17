import type { ClientWorkspaceSectionId } from "./constants";
import type { ClientWorkspaceView } from "./types";

type SectionSource = Pick<
  ClientWorkspaceView,
  "review" | "creators" | "content" | "timeline" | "commercial" | "quotation" | "strategyBody"
>;

/**
 * Client nav is one proposal: Overview · Creators · Content Plan · Commercial · Feedback · Approval.
 * Strategy, quotation, and timeline fold into those pages rather than competing as separate products.
 */
export function visibleClientWorkspaceSections(view: SectionSource): ClientWorkspaceSectionId[] {
  const sections: ClientWorkspaceSectionId[] = ["overview"];
  if (view.creators.length > 0) sections.push("creators");
  sections.push("content", "commercial", "feedback", "approval");
  return sections;
}

export function defaultClientWorkspaceSection(
  sections: readonly ClientWorkspaceSectionId[]
): ClientWorkspaceSectionId {
  if (sections.includes("overview")) return "overview";
  return sections[0] ?? "overview";
}
