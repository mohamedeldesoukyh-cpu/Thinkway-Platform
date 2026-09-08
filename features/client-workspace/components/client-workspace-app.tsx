"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CLIENT_WORKSPACE_SECTIONS,
  type ClientWorkspaceSectionId,
} from "../constants";
import {
  captureClientWorkspaceDomProbe,
  cwDebugLiveState,
  cwDebugLog,
  cwDebugSafePath,
  installClientWorkspaceDebugLifecycle,
  isClientWorkspaceDebugEnabled,
} from "../debug/client-workspace-dom-probe";
import type { ClientWorkspaceView } from "../types";
import { ClientWorkspaceSectionView } from "./client-workspace-section-view";
import { ClientWorkspaceShell } from "./client-workspace-shell";
import { ClientWorkspaceStateProvider } from "./client-workspace-state";

function isSection(value: string | undefined): value is ClientWorkspaceSectionId {
  return Boolean(value && CLIENT_WORKSPACE_SECTIONS.includes(value as ClientWorkspaceSectionId));
}

let appMountSerial = 0;

export function ClientWorkspaceApp({
  view,
  token,
  section,
}: {
  view: ClientWorkspaceView;
  token: string;
  section: ClientWorkspaceSectionId;
}) {
  const mountIdRef = useRef(0);
  if (mountIdRef.current === 0) {
    mountIdRef.current = ++appMountSerial;
    if (typeof window !== "undefined" && isClientWorkspaceDebugEnabled()) {
      cwDebugLog("ClientWorkspaceApp.mount", {
        mountId: mountIdRef.current,
        section,
        creatorsLen: view.creators.length,
        path: cwDebugSafePath(),
      });
    }
  }

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
    if (typeof window !== "undefined" && isClientWorkspaceDebugEnabled()) {
      cwDebugLog("ClientWorkspaceApp.propSectionSync", {
        mountId: mountIdRef.current,
        from: prevSection,
        to: section,
        note: "server/prop section changed — may indicate route remount or soft navigation",
      });
    }
  }

  cwDebugLiveState.section = active;
  cwDebugLiveState.creatorsLen = view.creators.length;
  cwDebugLiveState.appMountId = mountIdRef.current;

  const reveal = useCallback((next: ClientWorkspaceSectionId) => {
    setActive(next);
    setSeen((current) => {
      if (current.has(next)) return current;
      const copy = new Set(current);
      copy.add(next);
      return copy;
    });
  }, []);

  const go = useCallback(
    (next: ClientWorkspaceSectionId) => {
      const before = active;
      const pathBefore =
        typeof window !== "undefined" ? cwDebugSafePath() : "";
      if (next === active) {
        cwDebugLog("tab.click.noop", { mountId: mountIdRef.current, section: next });
        return;
      }
      cwDebugLog("tab.click", {
        mountId: mountIdRef.current,
        from: before,
        to: next,
        pathBefore,
        willCallHistory: false,
        willRouterNavigate: false,
        portalMounted: cwDebugLiveState.portalMounted,
        sheetOpen: cwDebugLiveState.sheetOpen,
        detailCount:
          typeof document !== "undefined" ? document.querySelectorAll(".detail").length : undefined,
      });
      // Do not call history.pushState/replaceState with a new /review/.../[section] URL.
      // Next.js 16 patches the History API and re-fetches the section RSC payload
      // (full loadClientWorkspace + loading overlay), which freezes mobile tabs.
      reveal(next);
      if (typeof window !== "undefined" && isClientWorkspaceDebugEnabled()) {
        window.setTimeout(() => {
          const pathAfter = cwDebugSafePath();
          const loading = document.querySelectorAll(
            ".tw-review-loading-overlay, .thinkway-navigation-loading-overlay"
          ).length;
          const details = document.querySelectorAll(".detail").length;
          const shortlistHidden = document.querySelector('[data-cw-section="shortlist"]')?.hasAttribute(
            "hidden"
          );
          cwDebugLog("tab.after", {
            mountId: mountIdRef.current,
            from: before,
            to: next,
            pathAfter,
            pathChanged: pathAfter !== pathBefore,
            loadingOverlayCount: loading,
            detailNodeCount: details,
            portalMounted: cwDebugLiveState.portalMounted,
            sheetOpen: cwDebugLiveState.sheetOpen,
            shortlistWrapperHidden: shortlistHidden,
            bodyOverflow: document.body.style.overflow || "(empty)",
          });
          captureClientWorkspaceDomProbe({
            event: `after-tab ${before}->${next}`,
            section: next,
            sheetOpen: cwDebugLiveState.sheetOpen,
            creatorsLen: view.creators.length,
            filteredLen: cwDebugLiveState.filteredLen,
          });
        }, 0);
        window.setTimeout(() => {
          captureClientWorkspaceDomProbe({
            event: `after-tab+300ms ${before}->${next}`,
            section: next,
            sheetOpen: cwDebugLiveState.sheetOpen,
            creatorsLen: view.creators.length,
            filteredLen: cwDebugLiveState.filteredLen,
          });
        }, 300);
      }
    },
    [active, reveal, view.creators.length]
  );

  useEffect(() => {
    function onPop() {
      const part = window.location.pathname.split("/").filter(Boolean).at(-1);
      cwDebugLog("popstate", { part, mountId: mountIdRef.current });
      if (isSection(part)) reveal(part);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [reveal]);

  useEffect(() => {
    if (!isClientWorkspaceDebugEnabled()) return;
    return installClientWorkspaceDebugLifecycle();
  }, []);

  useEffect(() => {
    return () => {
      if (isClientWorkspaceDebugEnabled()) {
        cwDebugLog("ClientWorkspaceApp.unmount", {
          mountId: mountIdRef.current,
          active,
        });
      }
    };
  }, [active]);

  const renderSections = view.visibleSections.includes(active)
    ? view.visibleSections
    : [...view.visibleSections, active];

  return (
    <ClientWorkspaceStateProvider view={view} token={token} onSectionChange={go}>
      <ClientWorkspaceShell view={view} token={token} section={active} onSectionChange={go}>
        {renderSections
          .filter((item) => seen.has(item))
          .map((item) => (
            <div
              key={item}
              hidden={item !== active}
              data-cw-section={item}
              data-cw-section-active={item === active ? "1" : "0"}
            >
              <ClientWorkspaceSectionView section={item} view={view} token={token} />
            </div>
          ))}
      </ClientWorkspaceShell>
    </ClientWorkspaceStateProvider>
  );
}
