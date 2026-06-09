"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { AssignmentAudienceView } from "@/lib/campaigns/assignment-audience-view";

const AssignmentAudienceViewContext = createContext<AssignmentAudienceView>("internal");

export function AssignmentAudienceViewProvider({
  value,
  children,
}: {
  value: AssignmentAudienceView;
  children: ReactNode;
}) {
  return (
    <AssignmentAudienceViewContext.Provider value={value}>
      {children}
    </AssignmentAudienceViewContext.Provider>
  );
}

export function useAssignmentAudienceView(): AssignmentAudienceView {
  return useContext(AssignmentAudienceViewContext);
}
