"use client";

import { getReleaseInfo, type ReleaseInfo } from "@/lib/release/release-info";
import { cn } from "@/lib/utils";

export type AppVersionProps = {
  /** Compact block for dropdowns; panel for Settings → About */
  variant?: "menu" | "panel";
  className?: string;
  /** Optional override (tests / Storybook). Defaults to getReleaseInfo(). */
  info?: ReleaseInfo;
};

function VersionRows({
  info,
  dense,
}: {
  info: ReleaseInfo;
  dense?: boolean;
}) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Version", value: info.version },
    { label: "Build", value: info.build },
    { label: "Environment", value: info.environment },
  ];
  if (info.deploymentDateLabel) {
    rows.push({ label: "Deployment Date", value: info.deploymentDateLabel });
  }

  return (
    <dl
      className={cn(
        "grid gap-x-3",
        dense ? "gap-y-1 text-[11px] leading-snug" : "gap-y-2 text-sm"
      )}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            "grid grid-cols-[auto_1fr] items-baseline gap-x-2",
            dense ? "gap-y-0" : "gap-y-0.5"
          )}
        >
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              "min-w-0 truncate font-medium text-foreground",
              dense && "font-normal tabular-nums"
            )}
            title={row.value}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Reusable Thinkway Platform version / build / environment display.
 */
export function AppVersion({
  variant = "panel",
  className,
  info: infoProp,
}: AppVersionProps) {
  const info = infoProp ?? getReleaseInfo();

  if (variant === "menu") {
    return (
      <div
        className={cn(
          "px-2 py-1.5",
          className
        )}
        data-slot="app-version"
      >
        <p className="truncate text-xs font-semibold text-foreground">
          {info.appName}
        </p>
        <VersionRows info={info} dense />
      </div>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-5 text-card-foreground shadow-sm",
        className
      )}
      data-slot="app-version"
      aria-label={`${info.appName} version information`}
    >
      <h2 className="text-lg font-semibold tracking-tight">{info.appName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Release details for this deployment.
      </p>
      <div className="mt-4">
        <VersionRows info={info} />
      </div>
    </section>
  );
}
