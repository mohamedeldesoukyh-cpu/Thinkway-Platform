"use client";

import type { ClientWorkspaceSectionId } from "../constants";
import type { ClientWorkspaceView } from "../types";
import { ApprovalWorkspace } from "./approval-workspace";
import { CommercialWorkspace } from "./commercial-workspace";
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
  if (section === "shortlist" || section === "strategy" || section === "timeline" || section === "content") {
    return <CreatorsWorkspace view={view} token={token} intent="explore" />;
  }
  if (section === "overview") return <OverviewWorkspace view={view} token={token} />;
  if (section === "creators") return <CreatorsWorkspace view={view} token={token} intent="decide" />;
  if (section === "commercial" || section === "quotation") {
    return <CommercialWorkspace view={view} token={token} />;
  }
  if (section === "feedback") return <FeedbackWorkspace view={view} token={token} />;
  return <ApprovalWorkspace view={view} token={token} />;
}
