"use client";

import { useEffect, useRef, useState } from "react";

import { readWaitingWorkerBuild } from "@/lib/release/waiting-worker-build";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const UPDATE_DISMISS_KEY = "thinkway.pwa.updateDismissedBuild";
const USER_RELOAD_KEY = "thinkway.pwa.userRequestedReload";

function readDismissedBuild(): string | null {
  try {
    return window.sessionStorage.getItem(UPDATE_DISMISS_KEY);
  } catch {
    return null;
  }
}

function writeDismissedBuild(buildId: string): void {
  try {
    window.sessionStorage.setItem(UPDATE_DISMISS_KEY, buildId);
  } catch {
    // ignore
  }
}

function isClientReviewPath(pathname: string): boolean {
  return pathname === "/review" || pathname.startsWith("/review/");
}

/**
 * Shows when a new service worker is waiting.
 * Reloads ONLY after the user taps Update Now — never on ambient controllerchange
 * (that looped with unregister/register on every page load).
 */
export function PwaUpdatePrompt() {
  const [open, setOpen] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const waitingBuildRef = useRef<string | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // Share / Client Review links must not show update UI or reload.
    if (isClientReviewPath(window.location.pathname)) {
      return;
    }

    let cancelled = false;
    let removeUpdateListener = () => {};
    const watched = new WeakSet<ServiceWorker>();

    const onControllerChange = () => {
      let userRequested = false;
      try {
        userRequested = window.sessionStorage.getItem(USER_RELOAD_KEY) === "1";
        if (userRequested) window.sessionStorage.removeItem(USER_RELOAD_KEY);
      } catch {
        /* ignore */
      }
      // Ambient claim after first install must not reload the page.
      if (!userRequested) return;
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const promptIfWaiting = async (registration: ServiceWorkerRegistration) => {
      const waiting = registration.waiting;
      if (!waiting) return;

      if (!navigator.serviceWorker.controller) {
        // First install — activate quietly, no modal, no reload.
        waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }
      const buildKey = await readWaitingWorkerBuild(waiting);
      if (cancelled || registration.waiting !== waiting) return;
      waitingBuildRef.current = buildKey;
      if (buildKey && readDismissedBuild() === buildKey) return;
      registrationRef.current = registration;
      setOpen(true);
    };

    const watchInstalling = (registration: ServiceWorkerRegistration) => {
      const installing = registration.installing;
      if (!installing || watched.has(installing)) return;
      watched.add(installing);
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed") {
          void promptIfWaiting(registration);
        }
      });
    };

    void navigator.serviceWorker.ready.then((registration) => {
      if (cancelled) return;
      registrationRef.current = registration;
      void promptIfWaiting(registration);
      watchInstalling(registration);
      const onUpdateFound = () => watchInstalling(registration);
      registration.addEventListener("updatefound", onUpdateFound);
      removeUpdateListener = () => registration.removeEventListener("updatefound", onUpdateFound);
      void registration.update().catch(() => {});
    });

    const checkUpdate = () => {
      if (document.visibilityState !== "visible") return;
      const registration = registrationRef.current;
      if (!registration) return;
      void registration.update().then(() => promptIfWaiting(registration)).catch(() => {});
    };
    const interval = window.setInterval(checkUpdate, 60 * 1000);
    window.addEventListener("focus", checkUpdate);
    document.addEventListener("visibilitychange", checkUpdate);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkUpdate);
      document.removeEventListener("visibilitychange", checkUpdate);
      removeUpdateListener();
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  const handleLater = () => {
    if (waitingBuildRef.current) writeDismissedBuild(waitingBuildRef.current);
    setOpen(false);
  };

  const handleUpdateNow = () => {
    const waiting = registrationRef.current?.waiting;
    if (!waiting) {
      // Another tab may already have activated the release. This click still requests it.
      window.location.reload();
      return;
    }
    try {
      window.sessionStorage.setItem(USER_RELOAD_KEY, "1");
    } catch {
      /* ignore */
    }
    waiting.postMessage({ type: "SKIP_WAITING" });
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleLater();
        else setOpen(true);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleLater();
        }}
      >
        <DialogHeader>
          <DialogTitle>A new version of Thinkway Platform is available.</DialogTitle>
          <DialogDescription>
            Update now to use the latest features and fixes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" onClick={handleLater}>
            Later
          </Button>
          <Button type="button" onClick={handleUpdateNow}>
            Update Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
