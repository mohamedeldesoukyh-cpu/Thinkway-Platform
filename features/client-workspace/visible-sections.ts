import type { ClientReviewSource, ClientWorkspaceSectionId } from "./constants";
import type { ClientWorkspaceView } from "./types";

type SectionSource = Pick<
  ClientWorkspaceView,
  "review" | "creators" | "content" | "timeline" | "commercial" | "quotation" | "strategyBody"
>;

function sourceOf(view: SectionSource): ClientReviewSource {
  return view.review.source ?? "studio";
}

function hasCommercial(view: SectionSource): boolean {
  return view.commercial.lines.length > 0 || view.commercial.totalInvestment > 0;
}

/** Client nav shows only sections that have something to review for this source. */
export function visibleClientWorkspaceSections(view: SectionSource): ClientWorkspaceSectionId[] {
  const source = sourceOf(view);
  const sections: ClientWorkspaceSectionId[] = ["overview"];

  if (source === "studio") sections.push("strategy");
  if (view.creators.length > 0) sections.push("creators");
  if (view.content.length > 0) sections.push("content");
  if (source === "quotation" || source === "studio" || hasCommercial(view)) {
    sections.push("commercial");
  }
  if (source === "quotation" && view.quotation) sections.push("quotation");
  if (source === "studio" && (view.timeline.phases.length > 0 || Boolean(view.timeline.durationWeeks))) {
    sections.push("timeline");
  }

  sections.push("feedback", "approval");
  return sections;
}

export function defaultClientWorkspaceSection(
  sections: readonly ClientWorkspaceSectionId[]
): ClientWorkspaceSectionId {
  if (sections.includes("creators")) return "creators";
  if (sections.includes("commercial")) return "commercial";
  if (sections.includes("quotation")) return "quotation";
  return "overview";
}
