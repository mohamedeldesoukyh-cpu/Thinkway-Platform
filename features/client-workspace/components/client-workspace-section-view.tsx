"use client";

import type { ClientWorkspaceSectionId } from "../constants";
import type { ClientWorkspaceView } from "../types";
import { ApprovalWorkspace } from "./approval-workspace";
import { CommercialWorkspace } from "./commercial-workspace";
import { ContentPlanWorkspace } from "./content-plan-workspace";
import { CreatorsWorkspace } from "./creators-workspace";
import { FeedbackWorkspace } from "./feedback-workspace";
import { OverviewWorkspace } from "./overview-workspace";

export function ClientWorkspaceSectionView({
  section,
  view,
  token,
}: {
  section: ClientWorkspaceSectionId;
  view: ClientWorkspaceView;
  token: string;
}) {
  if (section === "creators") return <CreatorsWorkspace view={view} token={token} />;
  if (section === "overview" || section === "strategy" || section === "timeline") {
    return <OverviewWorkspace view={view} />;
  }
  if (section === "content") return <ContentPlanWorkspace view={view} />;
  if (section === "commercial" || section === "quotation") return <CommercialWorkspace view={view} />;
  if (section === "feedback") return <FeedbackWorkspace view={view} token={token} />;
  return <ApprovalWorkspace view={view} token={token} />;
}
