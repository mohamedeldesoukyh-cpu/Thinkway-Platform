"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { useEnvironmentConfig } from "@/components/environment/environment-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type EnvironmentBadgeProps = {
  className?: string;
};

/**
 * Aurora-style environment indicator — subtle pill, never a full-width banner.
 * Deployment switch navigates between hosts (does not change Supabase in-process).
 */
export function EnvironmentBadge({ className }: EnvironmentBadgeProps) {
  const config = useEnvironmentConfig();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  if (!config) return null;

  const search = searchParams?.toString();
  const pathAndSearch = search ? `${pathname}?${search}` : pathname;
  const developmentHref = `${config.developmentAppUrl.replace(/\/$/, "")}${pathAndSearch}`;
  const productionHref = `${config.productionAppUrl.replace(/\/$/, "")}${pathAndSearch}`;

  const pillClass =
    config.surface === "production"
      ? "thinkway-env-pill thinkway-env-pill-prod"
      : config.surface === "development"
        ? "thinkway-env-pill thinkway-env-pill-dev"
        : "thinkway-env-pill thinkway-env-pill-local";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(pillClass, className)}
          aria-label={`${config.label} environment — switch deployment`}
        >
          <span className="thinkway-env-pill-dot" aria-hidden />
          {config.label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Deployment</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild disabled={config.surface === "development"}>
          <a href={developmentHref}>Open Development</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={config.surface === "production"}>
          <a href={productionHref}>Open Production</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
