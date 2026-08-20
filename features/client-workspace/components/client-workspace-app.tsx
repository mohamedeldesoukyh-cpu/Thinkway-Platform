"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CLIENT_WORKSPACE_SECTIONS,
  type ClientWorkspaceSectionId,
} from "../constants";
import { buildClientReviewPath } from "../security/review-token";
import { clientWorkspacePathReviewId } from "../journey-state";
import type { ClientWorkspaceView } from "../types";
import { ClientWorkspaceSectionView } from "./client-workspace-section-view";
import { ClientWorkspaceShell } from "./client-workspace-shell";
import { ClientWorkspaceStateProvider } from "./client-workspace-state";

function isSection(value: string | undefined): value is ClientWorkspaceSectionId {
  return Boolean(value && CLIENT_WORKSPACE_SECTIONS.includes(value as ClientWorkspaceSectionId));
}

export function ClientWorkspaceApp({
  view,
  token,
  section,
}: {
  view: ClientWorkspaceView;
  token: string;
  section: ClientWorkspaceSectionId;
}) {
  const [active, setActive] = useState(section);
  const [seen, setSeen] = useState(() => new Set<ClientWorkspaceSectionId>([section]));
  const [prevSection, setPrevSection] = useState(section);
  if (section !== prevSection) {
    setPrevSection(section);
    setActive(section);
    setSeen((current) => {
      if (current.has(section)) return current;
      const copy = new Set(current);
      copy.add(section);
      return copy;
    });
  }

  const reveal = useCallback((next: ClientWorkspaceSectionId) => {
    setActive(next);
    setSeen((current) => {
      if (current.has(next)) return current;
      const copy = new Set(current);
      copy.add(next);
      return copy;
    });
  }, []);

  useEffect(() => {
    function onPop() {
      const part = window.location.pathname.split("/").filter(Boolean).at(-1);
      if (isSection(part) && view.visibleSections.includes(part)) reveal(part);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [reveal, view.visibleSections]);

  const pathReviewId = clientWorkspacePathReviewId({
    historical: Boolean(view.journey?.historical),
    viewedReviewId: view.review.id,
    canonicalReviewId: view.journey?.canonicalReviewId,
  });
  const go = useCallback(
    (next: ClientWorkspaceSectionId) => {
      if (next === active) return;
      reveal(next);
      window.history.pushState({ section: next }, "", buildClientReviewPath(pathReviewId, token, next));
    },
    [active, pathReviewId, reveal, token]
  );

  return (
    <ClientWorkspaceStateProvider view={view} token={token} onSectionChange={go}>
      <ClientWorkspaceShell view={view} token={token} section={active} onSectionChange={go}>
        {view.visibleSections
          .filter((item) => seen.has(item))
          .map((item) => (
            <div key={item} hidden={item !== active}>
              <ClientWorkspaceSectionView section={item} view={view} token={token} />
            </div>
          ))}
      </ClientWorkspaceShell>
    </ClientWorkspaceStateProvider>
  );
}
