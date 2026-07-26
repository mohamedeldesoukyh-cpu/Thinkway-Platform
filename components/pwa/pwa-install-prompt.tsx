"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isPwaInstallDismissed,
  isPwaMarkedInstalled,
  isStandaloneDisplay,
  markPwaInstallDismissed,
  markPwaInstalled,
} from "@/lib/pwa/install-storage";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

export function PwaInstallPrompt() {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay() || isPwaMarkedInstalled()) {
      markPwaInstalled();
      return;
    }
    if (isPwaInstallDismissed()) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    };

    const onInstalled = () => {
      markPwaInstalled();
      setOpen(false);
      deferredRef.current = null;
      setCanNativeInstall(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // Defer so we never interrupt initial navigation / auth flows.
    const timer = window.setTimeout(() => {
      if (isStandaloneDisplay() || isPwaMarkedInstalled() || isPwaInstallDismissed()) {
        return;
      }
      setOpen(true);
      if (isIosDevice()) setIosHelp(true);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleLater = () => {
    markPwaInstallDismissed();
    setOpen(false);
  };

  const handleInstall = async () => {
    const deferred = deferredRef.current;
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") {
          markPwaInstalled();
          setOpen(false);
        } else {
          markPwaInstallDismissed();
          setOpen(false);
        }
      } catch {
        markPwaInstallDismissed();
        setOpen(false);
      } finally {
        deferredRef.current = null;
        setCanNativeInstall(false);
      }
      return;
    }

    // Safari / Firefox: keep modal open with platform instructions.
    if (isIosDevice()) {
      setIosHelp(true);
      return;
    }
    setIosHelp(true);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : handleLater())}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleLater();
        }}
      >
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="mb-2 flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-[#090B14]">
            <Image
              src="/icon-192x192.png"
              alt="Thinkway Platform"
              width={64}
              height={64}
              priority
              unoptimized
            />
          </div>
          <DialogTitle className="text-xl">Welcome to Thinkway Platform</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Install Thinkway Platform on your device for quicker access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm text-foreground">
          <p className="font-medium">Benefits:</p>
          <ul className="list-none space-y-2 text-muted-foreground">
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>Open directly from your Desktop or Start Menu</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>Faster launch</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>Native application experience</span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>•</span>
              <span>No need to remember the URL</span>
            </li>
          </ul>

          {iosHelp && !canNativeInstall ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground">
              {isIosDevice() ? (
                <>
                  On iPhone or iPad: tap <strong>Share</strong>, then{" "}
                  <strong>Add to Home Screen</strong>, and confirm{" "}
                  <strong>Add</strong>.
                </>
              ) : (
                <>
                  Use your browser menu and choose <strong>Install app</strong> or{" "}
                  <strong>Add to Home Screen</strong> to install Thinkway Platform.
                </>
              )}
            </p>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-center">
          <Button type="button" variant="outline" onClick={handleLater}>
            Maybe Later
          </Button>
          <Button type="button" onClick={() => void handleInstall()}>
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
