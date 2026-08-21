import type { ClientWorkspaceSectionId } from "./constants";
import { CLIENT_WORKSPACE_JOURNEY_SECTIONS } from "./constants";
import { canOpenCommercialWorkspace } from "./selection-flow";
import type { ClientWorkspaceView } from "./types";

type SectionSource = Pick<
  ClientWorkspaceView,
  "review" | "creators" | "content" | "timeline" | "commercial" | "quotation" | "strategyBody" | "journey"
>;

/**
 * Primary client navigation: Shortlist · Your Selection · Commercial · Campaign · Overview.
 * Overview is a supporting executive summary, not a fifth journey stage.
 * Commercial is hidden until Approve Selected Creators.
 */
export function visibleClientWorkspaceSections(view?: SectionSource): ClientWorkspaceSectionId[] {
  const sections: ClientWorkspaceSectionId[] = [...CLIENT_WORKSPACE_JOURNEY_SECTIONS];
  if (
    canOpenCommercialWorkspace({
      selectionConfirmed: view?.journey?.selectionConfirmed,
      historical: view?.journey?.historical,
      quotationStage: view?.journey?.quotationStage,
    })
  ) {
    return sections;
  }
  return sections.filter((section) => section !== "commercial");
}

export function resolveClientWorkspaceSection(
  section: ClientWorkspaceSectionId,
  access?: { canOpenCommercial?: boolean }
): ClientWorkspaceSectionId {
  let resolved: ClientWorkspaceSectionId = section;
  if (section === "strategy" || section === "timeline" || section === "content") resolved = "shortlist";
  if (section === "quotation") resolved = "commercial";
  if (resolved === "commercial" && access && access.canOpenCommercial === false) {
    return "creators";
  }
  return resolved;
}

export function isRenderableClientWorkspaceSection(
  section: ClientWorkspaceSectionId,
  visible: readonly ClientWorkspaceSectionId[]
): boolean {
  if (section === "feedback") return true;
  return visible.includes(section);
}

export function defaultClientWorkspaceSection(
  sections: readonly ClientWorkspaceSectionId[]
): ClientWorkspaceSectionId {
  if (sections.includes("shortlist")) return "shortlist";
  return sections[0] ?? "shortlist";
}
