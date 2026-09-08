"use client";

import { useEffect, useRef, useState } from "react";

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
  const waitingBuildRef = useRef<string>("waiting");
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

    const promptIfWaiting = (registration: ServiceWorkerRegistration) => {
      const waiting = registration.waiting;
      if (!waiting) return;
      const buildKey = waiting.scriptURL || "waiting";
      waitingBuildRef.current = buildKey;
      if (readDismissedBuild() === buildKey) return;
      if (!navigator.serviceWorker.controller) {
        // First install — activate quietly, no modal, no reload.
        waiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }
      registrationRef.current = registration;
      if (!cancelled) setOpen(true);
    };

    const watchInstalling = (registration: ServiceWorkerRegistration) => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed") {
          promptIfWaiting(registration);
        }
      });
    };

    void navigator.serviceWorker.ready.then((registration) => {
      if (cancelled) return;
      registrationRef.current = registration;
      promptIfWaiting(registration);
      registration.addEventListener("updatefound", () => {
        watchInstalling(registration);
      });
    });

    const checkUpdate = () => {
      void registrationRef.current?.update().catch(() => {});
    };
    const interval = window.setInterval(checkUpdate, 15 * 60 * 1000);
    window.addEventListener("focus", checkUpdate);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkUpdate();
    });

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkUpdate);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  const handleLater = () => {
    writeDismissedBuild(waitingBuildRef.current);
    setOpen(false);
  };

  const handleUpdateNow = () => {
    const waiting = registrationRef.current?.waiting;
    if (!waiting) {
      setOpen(false);
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
