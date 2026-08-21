import type { ClientWorkspaceSectionId } from "./constants";
import { CLIENT_WORKSPACE_JOURNEY_SECTIONS } from "./constants";
import type { ClientWorkspaceView } from "./types";

type SectionSource = Pick<
  ClientWorkspaceView,
  "review" | "creators" | "content" | "timeline" | "commercial" | "quotation" | "strategyBody"
>;

/**
 * Primary client journey: Shortlist · Your Selection · Commercial · Campaign.
 * Feedback remains reachable from Request changes. Content/strategy/timeline fold into Shortlist.
 */
export function visibleClientWorkspaceSections(view?: SectionSource): ClientWorkspaceSectionId[] {
  void view;
  return [...CLIENT_WORKSPACE_JOURNEY_SECTIONS];
}

export function resolveClientWorkspaceSection(section: ClientWorkspaceSectionId): ClientWorkspaceSectionId {
  if (section === "strategy" || section === "timeline" || section === "content") return "overview";
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
  if (sections.includes("overview")) return "overview";
  return sections[0] ?? "overview";
}
