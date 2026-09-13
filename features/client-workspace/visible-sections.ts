import type { ClientWorkspaceSectionId } from "./constants";
import { CLIENT_WORKSPACE_JOURNEY_SECTIONS } from "./constants";
import type { ClientWorkspaceView } from "./types";

type SectionSource = Pick<
  ClientWorkspaceView,
  "review" | "creators" | "content" | "timeline" | "commercial" | "quotation" | "strategyBody" | "journey"
>;

/**
 * Primary client navigation: Shortlist · Your Selection · Commercial · Campaign · Overview.
 * Overview is a supporting executive summary, not a fifth journey stage.
 * Commercial stays visible; download/send still require Approve Selected Creators.
 */
export function visibleClientWorkspaceSections(view?: SectionSource): ClientWorkspaceSectionId[] {
  if (view?.review.source === "studio") {
    return CLIENT_WORKSPACE_JOURNEY_SECTIONS.filter((section) => section !== "commercial");
  }
  return [...CLIENT_WORKSPACE_JOURNEY_SECTIONS];
}

/**
 * Keep the selection confirmation inside the source's visible journey.
 * Studio reviews are strategic-only; shortlist and quotation reviews retain
 * their established Commercial destination.
 */
export function postCreatorApprovalSection(
  view: Pick<ClientWorkspaceView, "review" | "visibleSections">
): ClientWorkspaceSectionId {
  const preferred = view.review.source === "studio" ? "creators" : "commercial";
  return view.visibleSections.includes(preferred)
    ? preferred
    : defaultClientWorkspaceSection(view.visibleSections);
}

export function resolveClientWorkspaceSection(section: ClientWorkspaceSectionId): ClientWorkspaceSectionId {
  if (section === "strategy" || section === "timeline" || section === "content") return "shortlist";
  if (section === "quotation") return "commercial";
  return section;
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
