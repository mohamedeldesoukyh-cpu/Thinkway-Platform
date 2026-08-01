"use client";

import { Suspense } from "react";

import { EnvironmentBadge } from "@/components/environment/environment-badge";
import { useEnvironmentConfig } from "@/components/environment/environment-config";
import { cn } from "@/lib/utils";

function EnvironmentBadgeFallback() {
  const config = useEnvironmentConfig();
  if (!config) return null;
  const pillClass =
    config.surface === "production"
      ? "thinkway-env-pill thinkway-env-pill-prod"
      : config.surface === "development"
        ? "thinkway-env-pill thinkway-env-pill-dev"
        : "thinkway-env-pill thinkway-env-pill-local";
  return (
    <span className={cn(pillClass)} aria-hidden>
      <span className="thinkway-env-pill-dot" />
      {config.label}
    </span>
  );
}

/** Suspense-safe shell mount for the Aurora environment pill. */
export function EnvironmentBadgeSlot({ className }: { className?: string }) {
  return (
    <Suspense fallback={<EnvironmentBadgeFallback />}>
      <EnvironmentBadge className={className} />
    </Suspense>
  );
}
