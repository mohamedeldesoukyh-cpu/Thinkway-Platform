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

/**
 * Shows when a new service worker is waiting. Does not auto-reload.
 * "Later" dismisses until the next distinct waiting worker (next deploy).
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

    let cancelled = false;

    const onControllerChange = () => {
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
      // Distinguish deploys via script URL (includes cache-busting from dynamic SW).
      const buildKey = waiting.scriptURL || "waiting";
      waitingBuildRef.current = buildKey;
      if (readDismissedBuild() === buildKey) return;
      if (!navigator.serviceWorker.controller) {
        // First install — activate immediately without modal.
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

    // Periodic + focus checks for new deploys (SW script bytes change per build).
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
    waiting.postMessage({ type: "SKIP_WAITING" });
    // Reload is triggered once via controllerchange (guards infinite loops).
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
