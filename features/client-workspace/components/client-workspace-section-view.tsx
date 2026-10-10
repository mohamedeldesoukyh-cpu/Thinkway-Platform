"use client";

import dynamic from "next/dynamic";

import type { ClientWorkspaceSectionId } from "../constants";
import { isClientWorkspaceSectionOpen, navSectionForWorkspaceSection } from "../entitlement";
import type { ClientWorkspaceView } from "../types";
import { CreatorsWorkspace } from "./creators-workspace";
import { ClientWorkspaceEntitlementPanel } from "./entitlement-panel";

// Keep unvisited tab code out of the initial Shortlist hydration.
const ApprovalWorkspace = dynamic(() => import("./approval-workspace").then(module => module.ApprovalWorkspace), { loading: () => <p role="status">Loading section…</p> });
const CommercialWorkspace = dynamic(() => import("./commercial-workspace").then(module => module.CommercialWorkspace), { loading: () => <p role="status">Loading section…</p> });
const FeedbackWorkspace = dynamic(() => import("./feedback-workspace").then(module => module.FeedbackWorkspace), { loading: () => <p role="status">Loading section…</p> });
const OverviewWorkspace = dynamic(() => import("./overview-workspace").then(module => module.OverviewWorkspace), { loading: () => <p role="status">Loading section…</p> });

export function ClientWorkspaceSectionView({
  section,
  view,
  token,
}: {
  section: ClientWorkspaceSectionId;
  view: ClientWorkspaceView;
  token: string;
}) {
  if (section !== "feedback" && !isClientWorkspaceSectionOpen(view.entitlement, section)) {
    return (
      <ClientWorkspaceEntitlementPanel
        token={token}
        section={navSectionForWorkspaceSection(section)}
      />
    );
  }
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
