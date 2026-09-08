"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CLIENT_WORKSPACE_SECTIONS,
  type ClientWorkspaceSectionId,
} from "../constants";
import type { ClientWorkspaceView } from "../types";
import { ClientWorkspaceSectionView } from "./client-workspace-section-view";
import { ClientWorkspaceShell } from "./client-workspace-shell";
import { ClientWorkspaceStateProvider } from "./client-workspace-state";

/** History-state key for in-shell section back/forward (URL path stays put). */
export const CLIENT_WORKSPACE_HISTORY_SECTION = "twClientWorkspaceSection";

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
    function onPop(event: PopStateEvent) {
      const fromState = (event.state as Record<string, unknown> | null)?.[CLIENT_WORKSPACE_HISTORY_SECTION];
      if (typeof fromState === "string" && isSection(fromState)) {
        reveal(fromState);
        return;
      }
      const part = window.location.pathname.split("/").filter(Boolean).at(-1);
      if (isSection(part)) reveal(part);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [reveal]);

  const go = useCallback(
    (next: ClientWorkspaceSectionId) => {
      if (next === active) return;
      reveal(next);
      // Next.js 16 patches history.pushState: a URL change to another
      // /review/[id]/[section] path dispatches ACTION_RESTORE + spawnDynamicRequests,
      // which re-runs loadClientWorkspace and mounts the full-screen section loading
      // overlay — tabs look dead and every click feels like a cold reload.
      // Push history state only (no URL) so the shell stays mounted and instant.
      const prior =
        window.history.state && typeof window.history.state === "object"
          ? (window.history.state as Record<string, unknown>)
          : {};
      window.history.pushState({ ...prior, [CLIENT_WORKSPACE_HISTORY_SECTION]: next }, "");
    },
    [active, reveal]
  );

  const renderSections = view.visibleSections.includes(active)
    ? view.visibleSections
    : [...view.visibleSections, active];

  return (
    <ClientWorkspaceStateProvider view={view} token={token} onSectionChange={go}>
      <ClientWorkspaceShell view={view} token={token} section={active} onSectionChange={go}>
        {renderSections
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
