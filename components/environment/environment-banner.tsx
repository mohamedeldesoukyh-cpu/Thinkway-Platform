"use client";

import { usePathname, useSearchParams } from "next/navigation";

import type { DeploymentSurface } from "@/lib/deploy/deployment-environment";
import { cn } from "@/lib/utils";

export type EnvironmentBannerProps = {
  surface: DeploymentSurface;
  label: string;
  developmentAppUrl: string;
  productionAppUrl: string;
};

const SURFACE_CLASS: Record<DeploymentSurface, string> = {
  local:
    "border-slate-500/30 bg-slate-600 text-white dark:bg-slate-700",
  development:
    "border-amber-500/40 bg-amber-500 text-amber-950 dark:bg-amber-500 dark:text-amber-950",
  production:
    "border-emerald-700/40 bg-emerald-800 text-emerald-50 dark:bg-emerald-900 dark:text-emerald-50",
};

/**
 * Persistent environment chrome. The switch navigates to the other deployment
 * host — it does not change Supabase/Redis inside the current process.
 */
export function EnvironmentBanner({
  surface,
  label,
  developmentAppUrl,
  productionAppUrl,
}: EnvironmentBannerProps) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString();
  const pathAndSearch = search ? `${pathname}?${search}` : pathname;

  const developmentHref = `${developmentAppUrl.replace(/\/$/, "")}${pathAndSearch}`;
  const productionHref = `${productionAppUrl.replace(/\/$/, "")}${pathAndSearch}`;

  return (
    <div
      role="status"
      aria-label={`Thinkway ${label} environment`}
      className={cn(
        // Flow layout (not sticky): reserves height so dashboard h-full shells
        // sit below the bar instead of overlapping it.
        "relative z-[100] flex min-h-9 w-full shrink-0 items-center justify-between gap-3 border-b px-3 py-1.5 text-xs font-medium sm:px-4",
        SURFACE_CLASS[surface],
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="uppercase tracking-wide">{label}</span>
        <span className="hidden opacity-80 sm:inline">
          {surface === "local"
            ? "Local machine — not a hosted deployment"
            : surface === "development"
              ? "Development Supabase · Development Redis"
              : "Production Supabase · Production Redis"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="mr-1 hidden text-[11px] opacity-80 md:inline">
          Switch deployment
        </span>
        <EnvSwitchLink
          href={developmentHref}
          active={surface === "development"}
          label="Development"
        />
        <EnvSwitchLink
          href={productionHref}
          active={surface === "production"}
          label="Production"
        />
      </div>
    </div>
  );
}

function EnvSwitchLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  if (active) {
    return (
      <span
        className="rounded bg-black/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
        aria-current="true"
      >
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      className="rounded bg-black/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide underline-offset-2 hover:bg-black/20 hover:underline"
      title={`Open the same page on the ${label} deployment (separate app + database)`}
    >
      {label}
    </a>
  );
}
