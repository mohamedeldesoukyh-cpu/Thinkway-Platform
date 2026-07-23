# BATCH 1 — PlatformV6 pages (redesign handoff)

Generated for Thinkway redesign handoff. **Full sources** for 8 PlatformV6 routes.

> Scope: BATCH 1 only. Batches 2–10 are out of scope for this package.

## Index

| Route | `page.tsx` | Notes |
|-------|-------------|-------|
| `/` | `app/(dashboard)/page.tsx` | Home / ops dashboard (`HomePage`). This is the app route group index — NOT a redirect to `/dashboard`. `/dashboard` is a separate Executive dashboard. |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Executive (CFO) dashboard. Distinct from `/` home dashboard. |
| `/campaigns` | `app/(dashboard)/campaigns/page.tsx` | Campaigns list with PlatformV6 page chrome + KPI strip. |
| `/clients` | `app/(dashboard)/clients/page.tsx` | Legal entities (clients) list. |
| `/vendors` | `app/(dashboard)/vendors/page.tsx` | Vendors / influencers list. |
| `/studio` | `app/(dashboard)/studio/page.tsx` | Campaign Studio picker (conversations + campaigns). |
| `/clients/[id]` | `app/(dashboard)/clients/[id]/page.tsx` | Client operational workspace / profile. |
| `/vendors/[id]` | `app/(dashboard)/vendors/[id]/page.tsx` | Vendor / creator operational workspace. |

### Important routing note

- **`/`** → `app/(dashboard)/page.tsx` renders the **Home** ops dashboard (`HomePage`). It does **not** redirect to `/dashboard`.
- **`/dashboard`** → `app/(dashboard)/dashboard/page.tsx` renders the **Executive** finance dashboard (`ExecutiveDashboardView`).

---

## Page-family shared (PlatformV6 chrome)

These wrappers are the shared PlatformV6 list/workspace chrome used across these routes. Included once here; each route section references them.


#### `components/platform/platform-v6-layout.tsx`

```tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const PLATFORM_V6_SCOPE_CLASS = "thinkway-platform-v6";

export const PLATFORM_V6_ICON_GREEN = "platform-v6-wide-form-head-icon-green";
export const PLATFORM_V6_ICON_AMBER = "platform-v6-wide-form-head-icon-amber";

export function PlatformV6Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(PLATFORM_V6_SCOPE_CLASS, "platform-v6-page", className)}>
      {children}
    </div>
  );
}

export function PlatformV6PageHeader({
  title,
  description,
  actions,
  inline,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Title + primary action on one row (campaigns / clients list). */
  inline?: boolean;
}) {
  const header = (
    <div className="platform-v6-page-header">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );

  if (inline && actions) {
    return (
      <div className="platform-v6-page-header-row">
        {header}
        {actions}
      </div>
    );
  }

  return header;
}

export function PlatformV6SectionMeta({
  title,
  meta,
}: {
  title: string;
  meta: string;
}) {
  return (
    <div className="platform-v6-section-meta">
      <div>
        <strong>{title}</strong>
        <div>{meta}</div>
      </div>
    </div>
  );
}

export function PlatformV6SectionWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("platform-v6-section-wrap", className)}>{children}</div>
  );
}

export function PlatformV6Toolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("platform-v6-toolbar", className)}>{children}</div>;
}

export function PlatformV6WideFormBlock({
  icon: Icon,
  iconClassName,
  title,
  description,
  toolbar,
  bodyClassName,
  footer,
  children,
  className,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  toolbar?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("platform-v6-wide-form-block", className)}>
      <div className="platform-v6-wide-form-head">
        <div className={cn("platform-v6-wide-form-head-icon", iconClassName)}>
          <Icon aria-hidden />
        </div>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {toolbar ? <div className="platform-v6-wide-form-toolbar">{toolbar}</div> : null}
      <div className={cn("platform-v6-wide-form-body", bodyClassName)}>{children}</div>
      {footer ? <div className="platform-v6-wide-form-footer">{footer}</div> : null}
    </section>
  );
}

export function PlatformV6PageSectionHeader({
  title,
  description,
  className,
  compact,
}: {
  title: string;
  description?: string;
  className?: string;
  /** Executive dashboard inline section title (13px / 11px). */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className={cn("platform-v6-dash-section-header", className)}>
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="platform-v6-page-section-title">{title}</div>
      {description ? (
        <div className="platform-v6-page-section-sub">{description}</div>
      ) : null}
    </div>
  );
}

export function PlatformV6SectionHead({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="platform-v6-section-head">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="platform-v6-section-actions">{actions}</div> : null}
    </div>
  );
}

export type PlatformV6Breadcrumb = {
  label: string;
  href?: string;
};

export function PlatformV6EntityBreadcrumb({
  crumbs,
  actions,
}: {
  crumbs: PlatformV6Breadcrumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="platform-v6-entity-breadcrumb">
      <div>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`}>
              {index > 0 ? " / " : null}
              {crumb.href && !isLast ? (
                <Link href={crumb.href}>{crumb.label}</Link>
              ) : (
                <span className={isLast ? "current" : undefined}>{crumb.label}</span>
              )}
            </span>
          );
        })}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function platformV6BadgeClass(
  variant:
    | "green"
    | "amber"
    | "red"
    | "blue"
    | "gray"
    | "purple"
    | "outline-green"
    | "outline-amber"
): string {
  return cn("platform-v6-badge", `platform-v6-badge-${variant}`);
}

/** HTML reference toggle switch (`.toggle` / `.platform-v6-toggle`). */
export function PlatformV6Toggle({
  checked,
  onCheckedChange,
  disabled,
  id,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn("platform-v6-toggle", checked && "on")}
      onClick={() => onCheckedChange(!checked)}
    />
  );
}

export function PlatformV6ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="platform-v6-toggle-row">
      <div className="min-w-0 flex-1">
        <div className="platform-v6-toggle-row-title">{title}</div>
        <div className="platform-v6-toggle-row-desc">{description}</div>
      </div>
      <PlatformV6Toggle
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
      />
    </div>
  );
}

```

#### `components/platform/platform-v6-kpi-strip.tsx`

```tsx
"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type PlatformV6KpiCellProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  iconStroke?: string;
  iconBg?: string;
  valueClassName?: string;
};

function PlatformV6KpiCell({
  label,
  value,
  icon: Icon,
  iconStroke = "#2563eb",
  iconBg = "#eff6ff",
  valueClassName,
}: PlatformV6KpiCellProps) {
  return (
    <div className="platform-v6-kpi-cell">
      <div className="platform-v6-kpi-lbl">
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-[4px] p-[2px]"
          style={{ background: iconBg, color: iconStroke }}
        >
          <Icon aria-hidden className="size-[13px]" strokeWidth={2} style={{ color: iconStroke }} />
        </span>
        {label}
      </div>
      <div className={cn("platform-v6-kpi-val", valueClassName)}>{value}</div>
    </div>
  );
}

export type PlatformV6KpiItem = PlatformV6KpiCellProps & { id: string };

export function PlatformV6KpiStrip({
  items,
  className,
  columns = 4,
  layout = "grid",
}: {
  items: PlatformV6KpiItem[];
  className?: string;
  columns?: number;
  layout?: "grid" | "flex";
}) {
  return (
    <div
      className={cn("platform-v6-kpi-strip", className)}
      style={
        layout === "grid"
          ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          : undefined
      }
    >
      {items.map((item) => (
        <PlatformV6KpiCell key={item.id} {...item} />
      ))}
    </div>
  );
}

```

#### `components/platform/error-boundary.tsx`

```tsx
"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { AsyncErrorState } from "@/components/platform/async-error-state";
import { errorLog } from "@/lib/platform/logger";

export type PlatformSurface =
  | "dashboard"
  | "billing"
  | "campaigns"
  | "ios"
  | "planning"
  | "invoices"
  | "finance"
  | "analytics"
  | "executive"
  | "collections"
  | "treasury"
  | "generic";

const SURFACE_COPY: Record<
  PlatformSurface,
  { title: string; description: string }
> = {
  dashboard: {
    title: "Dashboard temporarily unavailable",
    description:
      "Home and navigation still work. Retry or continue via Billing and Campaigns.",
  },
  billing: {
    title: "Billing view encountered an error",
    description:
      "Invoicing, queue actions, and operational billing run on isolated queries. Refresh to retry this panel.",
  },
  campaigns: {
    title: "Campaign workspace encountered an error",
    description:
      "Campaign data may still save. Retry or open another tab (Overview, Lines, Billing).",
  },
  ios: {
    title: "IO workspace encountered an error",
    description:
      "Campaign execution is unaffected. Retry this IO panel or continue in campaign workspace.",
  },
  planning: {
    title: "Planning view temporarily unavailable",
    description: "Budget and forecast modules are optional — ERP operations are unaffected.",
  },
  invoices: {
    title: "Invoice view encountered an error",
    description:
      "Invoice creation and collections use dedicated queries. Refresh to reload this invoice.",
  },
  finance: {
    title: "Finance module encountered an error",
    description:
      "Credit notes, debit notes, and posting use isolated queries. Refresh to retry this panel.",
  },
  analytics: {
    title: "Analytics temporarily unavailable",
    description:
      "KPI and chart enrichment is optional. Billing, campaigns, and invoices continue normally.",
  },
  executive: {
    title: "Executive dashboard temporarily unavailable",
    description:
      "Finance monitoring charts are optional enrichment. Use Billing for operational control.",
  },
  collections: {
    title: "Collections view temporarily unavailable",
    description:
      "Billing, invoicing, and campaigns are unaffected. Retry or record payments from Billing.",
  },
  treasury: {
    title: "Treasury view temporarily unavailable",
    description:
      "Cashflow panels are optional enrichment. Collections and billing continue normally.",
  },
  generic: {
    title: "Something went wrong",
    description: "Operational ERP workflows are isolated from this panel failure.",
  },
};

type PlatformErrorBoundaryProps = {
  children: ReactNode;
  surface?: PlatformSurface;
  title?: string;
  description?: string;
};

type State = {
  error: Error | null;
};

export class PlatformErrorBoundary extends Component<
  PlatformErrorBoundaryProps,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const surface = this.props.surface ?? "generic";
    errorLog("platform-health", `boundary:${surface}`, {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const surface = this.props.surface ?? "generic";
      const copy = SURFACE_COPY[surface];
      const isDev = process.env.NODE_ENV === "development";

      return (
        <AsyncErrorState
          title={this.props.title ?? copy.title}
          message={this.props.description ?? copy.description}
          scope={isDev ? this.state.error.message : undefined}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/** @deprecated Use PlatformErrorBoundary — analytics-specific alias. */
export function AnalyticsResilienceBoundary({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <PlatformErrorBoundary surface="analytics" title={title}>
      {children}
    </PlatformErrorBoundary>
  );
}

```

#### `components/platform/async-error-state.tsx`

```tsx
"use client";

import { PageFallback } from "@/components/platform/page-fallback";

type AsyncErrorStateProps = {
  title?: string;
  message?: string | null;
  scope?: string;
  onRetry?: () => void;
};

export function AsyncErrorState({
  title = "This section is temporarily unavailable",
  message,
  scope,
  onRetry,
}: AsyncErrorStateProps) {
  const description =
    message ??
    "Core ERP operations remain available. Optional analytics or enrichment may be offline.";

  return (
    <PageFallback
      title={title}
      description={description}
      hint={
        scope
          ? `${scope} failed to load. Operational billing, campaigns, and invoices are isolated.`
          : undefined
      }
      onRetry={
        onRetry ??
        (() => {
          window.location.reload();
        })
      }
      variant="warning"
    />
  );
}

```

#### `components/platform/page-fallback.tsx`

```tsx
import type { ReactNode } from "react";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageFallbackProps = {
  title: string;
  description?: string;
  hint?: string;
  onRetry?: () => void;
  children?: ReactNode;
  variant?: "warning" | "error";
};

export function PageFallback({
  title,
  description,
  hint,
  onRetry,
  children,
  variant = "warning",
}: PageFallbackProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-3xl border px-6 py-12 text-center",
        variant === "error"
          ? "border-destructive/30 bg-destructive/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
      role="alert"
    >
      <AlertTriangleIcon
        className={cn(
          "size-10",
          variant === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"
        )}
        aria-hidden
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
        ) : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon className="size-3.5" data-icon="inline-start" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

```

---

## Route `/`

Home / ops dashboard (`HomePage`). This is the app route group index — NOT a redirect to `/dashboard`. `/dashboard` is a separate Executive dashboard.

**Page file:** `app/(dashboard)/page.tsx`

**Page-family shared used:** _none (or only DashboardShell)_

### Mock / sample / fallback data

_No dedicated mock/fixture modules for this route._ UI renders with **live Supabase data** (see data loaders below). Empty arrays are used only on error fallbacks in `page.tsx`.

**Data loaders (live; not expanded as UI):**

- `features/home/queries.ts`

### `page.tsx`

#### `app/(dashboard)/page.tsx`

```tsx
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { HomePage } from "@/features/home/components/home-page";
import { getHomeDashboardSnapshot } from "@/features/home/queries";

export default async function DashboardPage() {
  let snapshot = null;
  let bannerError: string | null = null;

  try {
    snapshot = await getHomeDashboardSnapshot();
  } catch (error) {
    bannerError =
      error instanceof Error ? error.message : "Failed to load your dashboard summary.";
  }

  return (
    <DashboardShell
      title="Dashboard"
      description="Influencer marketing operations at a glance."
      platformV6
      hidePageHeader
      immersiveLayout
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 md:p-0"
    >
      {snapshot ? (
        <HomePage snapshot={snapshot} />
      ) : bannerError ? (
        <div className="m-5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {bannerError}
        </div>
      ) : null}
    </DashboardShell>
  );
}

```
### Page-specific components

#### `features/home/components/home-canvas.tsx`

```tsx
"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
};

const DARK_COLORS = [
  "rgba(129,140,248,.6)",
  "rgba(196,132,252,.5)",
  "rgba(52,211,153,.4)",
  "rgba(251,191,36,.4)",
  "rgba(244,114,182,.5)",
];

const LIGHT_COLORS = [
  "rgba(99,102,241,.35)",
  "rgba(124,58,237,.3)",
  "rgba(16,185,129,.25)",
  "rgba(245,158,11,.25)",
  "rgba(236,72,153,.3)",
];

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function HomeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let mouseX = 0;
    let mouseY = 0;

    const particles: Particle[] = Array.from({ length: 55 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      r: 1 + Math.random() * 1.8,
      c: DARK_COLORS[Math.floor(Math.random() * DARK_COLORS.length)]!,
    }));

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      mouseX = width / 2;
      mouseY = height / 2;
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
    };

    const draw = () => {
      const dark = isDarkTheme();
      const palette = dark ? DARK_COLORS : LIGHT_COLORS;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i]!;
        const ax = particle.x * width;
        const ay = particle.y * height;

        for (let j = i + 1; j < particles.length; j += 1) {
          const other = particles[j]!;
          const bx = other.x * width;
          const by = other.y * height;
          const distance = Math.hypot(ax - bx, ay - by);

          if (distance < 120) {
            ctx.strokeStyle = dark
              ? `rgba(255,255,255,${0.04 * (1 - distance / 120)})`
              : `rgba(99,102,241,${0.08 * (1 - distance / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }

        const mdx = mouseX - ax;
        const mdy = mouseY - ay;
        const md = Math.hypot(mdx, mdy);
        if (md < 150) {
          particle.vx += (mdx / md) * 0.00008;
          particle.vy += (mdy / md) * 0.00008;
        }

        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < 0 || particle.x > 1) particle.vx *= -1;
        if (particle.y < 0 || particle.y > 1) particle.vy *= -1;

        ctx.beginPath();
        ctx.arc(ax, ay, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = particle.c || palette[i % palette.length]!;
        ctx.fill();
      }

      animationFrame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="platform-v6-hs-canvas"
      aria-hidden
    />
  );
}

```

#### `features/home/components/home-kpi-counter.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

import { formatMoneyCompact } from "@/lib/campaigns/utils";

type HomeKpiCounterProps = {
  value: number;
  currency: string;
  className?: string;
  delayMs?: number;
  durationMs?: number;
};

export function HomeKpiCounter({
  value,
  currency,
  className,
  delayMs = 600,
  durationMs = 1800,
}: HomeKpiCounterProps) {
  const [display, setDisplay] = useState(formatMoneyCompact(0, currency));

  useEffect(() => {
    let frame = 0;
    const startAt = Date.now() + delayMs;

    const tick = () => {
      const elapsed = Date.now() - startAt;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(formatMoneyCompact(Math.floor(eased * value), currency));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(formatMoneyCompact(value, currency));
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, currency, delayMs, durationMs]);

  return <span className={className}>{display}</span>;
}

```

#### `features/home/components/home-page.tsx`

```tsx
import Link from "next/link";
import {
  ActivityIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  Building2Icon,
  DollarSignIcon,
  LayoutGridIcon,
  LineChartIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { formatMoneyCompact, formatPercent } from "@/lib/campaigns/utils";
import { HomeCanvas } from "@/features/home/components/home-canvas";
import { HomeKpiCounter } from "@/features/home/components/home-kpi-counter";
import { HomePoRing } from "@/features/home/components/home-po-ring";
import { HomeWorkspaceNavTabs } from "@/features/home/components/home-workspace-nav-tabs";
import type { HomeDashboardSnapshot } from "@/features/home/queries";

type HomePageProps = {
  snapshot: HomeDashboardSnapshot;
};

function resolveGreetingWord(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

function formatPeriodLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const MODULES = [
  {
    id: "finance",
    href: "/dashboard",
    title: "Finance",
    description: "KPIs, trends, billing alerts",
    borderColor: "rgba(99,102,241,.15)",
    iconBg: "rgba(99,102,241,.15)",
    iconColor: "#818cf8",
    icon: TrendingUpIcon,
  },
  {
    id: "campaigns",
    href: "/campaigns",
    title: "Campaigns",
    description: "Plans, IO, performance",
    borderColor: "rgba(16,185,129,.15)",
    iconBg: "rgba(16,185,129,.15)",
    iconColor: "#34d399",
    icon: ActivityIcon,
  },
  {
    id: "clients",
    href: "/clients",
    title: "Clients",
    description: "Accounts, legal, brands",
    borderColor: "rgba(139,92,246,.15)",
    iconBg: "rgba(139,92,246,.15)",
    iconColor: "#a78bfa",
    icon: Building2Icon,
  },
  {
    id: "vendors",
    href: "/vendors",
    title: "Vendors",
    description: "Creators, payouts, stats",
    borderColor: "rgba(245,158,11,.15)",
    iconBg: "rgba(245,158,11,.15)",
    iconColor: "#fbbf24",
    icon: UsersIcon,
  },
] as const;

export function HomePage({ snapshot }: HomePageProps) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const greetingWord = resolveGreetingWord(now);
  const currency = snapshot.currency_code;

  const formatMoney = (value: number) => formatMoneyCompact(value, currency);

  const tickerItems = [
    {
      label: "REVENUE",
      value: formatMoney(snapshot.total_revenue),
      badge: snapshot.margin_percent > 0 ? `↑ ${formatPercent(snapshot.margin_percent)}` : null,
      badgeClass: "platform-v6-hs-badge-up",
    },
    {
      label: "GROSS PROFIT",
      value: formatMoney(snapshot.gross_profit),
    },
    {
      label: "ACTIVE CAMPAIGNS",
      value: String(snapshot.active_campaigns),
    },
    {
      label: "VENDORS",
      value: String(snapshot.active_vendors),
    },
    {
      label: "OUTSTANDING",
      value: formatMoney(snapshot.outstanding_revenue),
      badgeClass:
        snapshot.outstanding_revenue > 0 ? "platform-v6-hs-badge-dn" : undefined,
    },
    {
      label: "PO CONSUMED",
      value: `${snapshot.po_consumed_percent}%`,
    },
    {
      label: "MARGIN",
      value: formatPercent(snapshot.margin_percent),
    },
    {
      label: "ASSIGNMENTS",
      value: String(snapshot.assignments_count),
    },
  ];

  const liveCampaignCount = snapshot.recent_campaigns.filter(
    (campaign) => campaign.status === "active"
  ).length;

  return (
    <div className="platform-v6-hs-root">
      <HomeCanvas />
      <div className="platform-v6-hs-aurora" aria-hidden />
      <div className="platform-v6-hs-aurora-2" aria-hidden />
      <div className="platform-v6-hs-grid" aria-hidden />

      <nav className="platform-v6-hs-nav">
        <div className="platform-v6-hs-nav-left">
          <Link href="/" title="Thinkway">
            <ThinkwayLogo compact showText className="mb-0" />
          </Link>
        </div>
        <HomeWorkspaceNavTabs active="overview" />
        <div className="platform-v6-hs-nav-right">
          <Link className="platform-v6-hs-cta-btn" href="/campaigns">
            + New Campaign
          </Link>
          <div className="platform-v6-hs-nav-av">{snapshot.userInitials}</div>
          <span className="platform-v6-hs-nav-name">{snapshot.userHandle}</span>
        </div>
      </nav>

      <div className="platform-v6-hs-ticker">
        <div className="platform-v6-hs-ticker-inner">
          {[...tickerItems, ...tickerItems].map((item, index) => (
            <div key={`${item.label}-${index}`} className="platform-v6-hs-tick-item">
              {item.label}{" "}
              <span
                className={
                  item.badgeClass ? `platform-v6-hs-tick-val ${item.badgeClass}` : "platform-v6-hs-tick-val"
                }
              >
                {item.value}
              </span>
              {item.badge ? (
                <span className={item.badgeClass ?? "platform-v6-hs-badge-up"}>{item.badge}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="platform-v6-hs-main">
        <div className="platform-v6-hs-left">
          <div className="platform-v6-hs-greeting-meta">{dateLabel}</div>
          <h1 className="platform-v6-hs-heading">
            <span>{greetingWord}</span>
            <br />
            <span className="platform-v6-hs-heading-accent">{snapshot.displayName}</span>
            <span className="platform-v6-hs-heading-cursor" aria-hidden />
          </h1>
          <p className="platform-v6-hs-tagline">
            Your influencer ops platform. Revenue, creators, campaigns and clients — all in one
            view.
          </p>

          <div className="platform-v6-hs-kpis">
            <div className="platform-v6-hs-kpi">
              <div
                className="platform-v6-hs-kpi-icon"
                style={{ background: "rgba(99,102,241,.15)" }}
              >
                <LineChartIcon aria-hidden stroke="#818cf8" strokeWidth={2} />
              </div>
              <div className="platform-v6-hs-kpi-lbl">Revenue</div>
              <div className="platform-v6-hs-kpi-val">
                <HomeKpiCounter value={snapshot.total_revenue} currency={currency} />
              </div>
              <div className="platform-v6-hs-kpi-sub">
                {snapshot.margin_percent > 0 ? (
                  <span className="platform-v6-hs-badge-up">
                    ↑ {formatPercent(snapshot.margin_percent)}
                  </span>
                ) : null}{" "}
                gross profit
              </div>
            </div>

            <div className="platform-v6-hs-kpi">
              <div
                className="platform-v6-hs-kpi-icon"
                style={{ background: "rgba(16,185,129,.15)" }}
              >
                <DollarSignIcon aria-hidden stroke="#34d399" strokeWidth={2} />
              </div>
              <div className="platform-v6-hs-kpi-lbl">Gross profit</div>
              <div className="platform-v6-hs-kpi-val">
                <HomeKpiCounter
                  value={snapshot.gross_profit}
                  currency={currency}
                  durationMs={1500}
                />
              </div>
              <div className="platform-v6-hs-kpi-sub">{formatPercent(snapshot.margin_percent)} margin</div>
            </div>

            <div className="platform-v6-hs-kpi">
              <div
                className="platform-v6-hs-kpi-icon"
                style={{ background: "rgba(245,158,11,.15)" }}
              >
                <AlertCircleIcon aria-hidden stroke="#fbbf24" strokeWidth={2} />
              </div>
              <div className="platform-v6-hs-kpi-lbl">Outstanding</div>
              <div className="platform-v6-hs-kpi-val platform-v6-hs-kpi-val-warn">
                <HomeKpiCounter
                  value={snapshot.outstanding_revenue}
                  currency={currency}
                  durationMs={2000}
                />
              </div>
              <div className="platform-v6-hs-kpi-sub">
                {snapshot.outstanding_revenue > 0 ? (
                  <span className="platform-v6-hs-badge-dn">⚠ Needs action</span>
                ) : (
                  "All clear"
                )}
              </div>
            </div>

            <div className="platform-v6-hs-kpi">
              <div
                className="platform-v6-hs-kpi-icon"
                style={{ background: "rgba(139,92,246,.15)" }}
              >
                <UsersIcon aria-hidden stroke="#a78bfa" strokeWidth={2} />
              </div>
              <div className="platform-v6-hs-kpi-lbl">Active vendors</div>
              <div className="platform-v6-hs-kpi-val">{snapshot.active_vendors}</div>
              <div className="platform-v6-hs-kpi-sub">across active campaigns</div>
            </div>
          </div>

          <div className="platform-v6-hs-actions">
            <Link className="platform-v6-hs-btn-primary" href="/dashboard">
              <LayoutGridIcon aria-hidden strokeWidth={2} />
              Executive dashboard
            </Link>
            <Link className="platform-v6-hs-btn-ghost" href="/campaigns">
              <ActivityIcon aria-hidden strokeWidth={2} />
              Campaigns
            </Link>
            <Link className="platform-v6-hs-btn-ghost" href="/clients">
              <Building2Icon aria-hidden strokeWidth={2} />
              Clients
            </Link>
          </div>

          <div className="platform-v6-hs-modules-label">Quick access</div>
          <div className="platform-v6-hs-modules">
            {MODULES.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.id}
                  href={module.href}
                  className="platform-v6-hs-mod"
                  style={{ borderColor: module.borderColor }}
                >
                  <div
                    className="platform-v6-hs-mod-icon"
                    style={{ background: module.iconBg }}
                  >
                    <Icon aria-hidden stroke={module.iconColor} strokeWidth={2} />
                  </div>
                  <div className="platform-v6-hs-mod-body">
                    <div className="platform-v6-hs-mod-title">{module.title}</div>
                    <div className="platform-v6-hs-mod-desc">{module.description}</div>
                  </div>
                  <div className="platform-v6-hs-mod-arrow">
                    <ArrowRightIcon aria-hidden size={14} strokeWidth={2} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="platform-v6-hs-right">
          {snapshot.billing_alert ? (
            <div className="platform-v6-hs-alert">
              <div className="platform-v6-hs-alert-icon">
                <AlertCircleIcon aria-hidden strokeWidth={2} />
              </div>
              <div>
                <div className="platform-v6-hs-alert-title">{snapshot.billing_alert.title}</div>
                <div className="platform-v6-hs-alert-desc">{snapshot.billing_alert.description}</div>
                <Link className="platform-v6-hs-alert-link" href="/dashboard">
                  Review in dashboard →
                </Link>
              </div>
            </div>
          ) : null}

          <div className="platform-v6-hs-ring-panel">
            <HomePoRing percent={snapshot.po_consumed_percent} />
            <div>
              <div className="platform-v6-hs-ring-info-title">PO Consumption</div>
              <div className="platform-v6-hs-ring-info-desc">
                {formatMoney(snapshot.po_consumed)} of {formatMoney(snapshot.po_total)} consumed.
                {snapshot.po_consumed_percent >= 90 ? (
                  <>
                    <br />
                    Near limit — renewal required.
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="platform-v6-hs-panel platform-v6-hs-panel-delay-300">
            <div className="platform-v6-hs-panel-head">
              <span className="platform-v6-hs-panel-title">
                <ActivityIcon aria-hidden strokeWidth={2} />
                Recent campaigns
              </span>
              <Link className="platform-v6-hs-panel-link" href="/campaigns">
                VIEW ALL
              </Link>
            </div>
            {snapshot.recent_campaigns.length > 0 ? (
              <>
                <div className="platform-v6-hs-live">
                  <div className="platform-v6-hs-live-dot" aria-hidden />
                  Live · {liveCampaignCount || snapshot.recent_campaigns.length}{" "}
                  {liveCampaignCount === 1 ? "campaign" : "campaigns"}
                </div>
                {snapshot.recent_campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="platform-v6-hs-panel-row"
                  >
                    <div className="platform-v6-hs-pr-left">
                      <div className="platform-v6-hs-pr-av">{campaign.client_initials}</div>
                      <div>
                        <div className="platform-v6-hs-pr-name">{campaign.name}</div>
                        <div className="platform-v6-hs-pr-meta">
                          {campaign.document_number} · {campaign.status_label}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="platform-v6-hs-pr-val">
                        {formatMoney(campaign.revenue)}
                      </div>
                      <div className="platform-v6-hs-pr-sub">
                        {formatPercent(campaign.margin_percent)} margin
                      </div>
                    </div>
                  </Link>
                ))}
              </>
            ) : (
              <div className="platform-v6-hs-panel-empty">No campaigns yet.</div>
            )}
          </div>

          <div className="platform-v6-hs-panel platform-v6-hs-panel-delay-400">
            <div className="platform-v6-hs-panel-head">
              <span className="platform-v6-hs-panel-title">
                <UsersIcon aria-hidden strokeWidth={2} />
                Top vendors
              </span>
              <Link className="platform-v6-hs-panel-link" href="/vendors">
                VIEW ALL
              </Link>
            </div>
            {snapshot.top_vendors.length > 0 ? (
              snapshot.top_vendors.map((vendor, index) => (
                <Link
                  key={vendor.id}
                  href={`/vendors/${vendor.id}`}
                  className="platform-v6-hs-panel-row"
                >
                  <div className="platform-v6-hs-pr-left">
                    <div
                      className="platform-v6-hs-pr-av"
                      style={{
                        background:
                          index === 0
                            ? "linear-gradient(135deg,#c084fc,#818cf8)"
                            : index === 1
                              ? "linear-gradient(135deg,#34d399,#059669)"
                              : "linear-gradient(135deg,#fbbf24,#f97316)",
                      }}
                    >
                      {vendor.initials}
                    </div>
                    <div>
                      <div className="platform-v6-hs-pr-name">{vendor.display_name}</div>
                      <div className="platform-v6-hs-pr-meta">
                        {vendor.document_number} · {vendor.platform}
                        {vendor.country_code ? ` · ${vendor.country_code}` : ""}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="platform-v6-hs-pr-val">
                      {formatFollowerCount(vendor.follower_count)}
                    </div>
                    <div className="platform-v6-hs-pr-sub">followers</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="platform-v6-hs-panel-empty">No vendors yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="platform-v6-hs-footer-strip">
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Platform</div>
          <div className="platform-v6-hs-fs-val">Thinkway v2.6</div>
        </div>
        <div className="platform-v6-hs-fs-div" aria-hidden />
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Last sync</div>
          <div className="platform-v6-hs-fs-val">Just now</div>
        </div>
        <div className="platform-v6-hs-fs-div" aria-hidden />
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Period</div>
          <div className="platform-v6-hs-fs-val">{formatPeriodLabel(now)}</div>
        </div>
        <div className="platform-v6-hs-fs-div" aria-hidden />
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Currency</div>
          <div className="platform-v6-hs-fs-val">{currency}</div>
        </div>
        <div className="platform-v6-hs-fs-div" aria-hidden />
        <div className="platform-v6-hs-fs-item">
          <div className="platform-v6-hs-fs-lbl">Region</div>
          <div className="platform-v6-hs-fs-val">MENA</div>
        </div>
        <div className="platform-v6-hs-footer-live">
          <div className="platform-v6-hs-live-dot" aria-hidden />
          <span>LIVE</span>
        </div>
      </div>
    </div>
  );
}

```

#### `features/home/components/home-po-ring.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

type HomePoRingProps = {
  percent: number;
};

const RING_CIRCUMFERENCE = 157;

export function HomePoRing({ percent }: HomePoRingProps) {
  const [offset, setOffset] = useState(RING_CIRCUMFERENCE);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const clamped = Math.max(0, Math.min(100, percent));
      setOffset(RING_CIRCUMFERENCE * (1 - clamped / 100));
    }, 800);

    return () => window.clearTimeout(timer);
  }, [percent]);

  return (
    <div className="platform-v6-hs-ring">
      <svg width="80" height="80" viewBox="0 0 60 60" aria-hidden>
        <defs>
          <linearGradient id="platform-v6-hs-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#f472b6" />
          </linearGradient>
        </defs>
        <circle className="platform-v6-hs-ring-track" cx="30" cy="30" r="25" />
        <circle
          className="platform-v6-hs-ring-fill"
          cx="30"
          cy="30"
          r="25"
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="platform-v6-hs-ring-label">
        <div className="platform-v6-hs-ring-pct">{percent}%</div>
        <div className="platform-v6-hs-ring-sub">PO</div>
      </div>
    </div>
  );
}

```

#### `features/home/components/home-workspace-nav-tabs.tsx`

```tsx
import Link from "next/link";

export type HomeWorkspaceNavTab = "overview" | "finance" | "campaigns" | "clients";

const WORKSPACE_NAV_TABS: Array<{
  id: HomeWorkspaceNavTab;
  href: string;
  label: string;
}> = [
  { id: "overview", href: "/", label: "Overview" },
  { id: "finance", href: "/dashboard", label: "Finance" },
  { id: "campaigns", href: "/campaigns", label: "Campaigns" },
  { id: "clients", href: "/clients", label: "Clients" },
];

export function HomeWorkspaceNavTabs({ active }: { active: HomeWorkspaceNavTab }) {
  return (
    <div className="platform-v6-hs-nav-center" role="tablist" aria-label="Workspace sections">
      {WORKSPACE_NAV_TABS.map((tab) =>
        tab.id === active ? (
          <span
            key={tab.id}
            className="platform-v6-hs-nav-tab active"
            role="tab"
            aria-selected="true"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.id}
            href={tab.href}
            className="platform-v6-hs-nav-tab"
            role="tab"
            aria-selected="false"
          >
            {tab.label}
          </Link>
        )
      )}
    </div>
  );
}

```

## Route `/dashboard`

Executive (CFO) dashboard. Distinct from `/` home dashboard.

**Page file:** `app/(dashboard)/dashboard/page.tsx`

**Page-family shared used:** `components/platform/platform-v6-layout.tsx`, `components/platform/platform-v6-kpi-strip.tsx`, `components/platform/error-boundary.tsx`

### Mock / sample / fallback data

_No dedicated mock/fixture modules for this route._ UI renders with **live Supabase data** (see data loaders below). Empty arrays are used only on error fallbacks in `page.tsx`.

**Data loaders (live; not expanded as UI):**

- `features/analytics/load-executive-dashboard.ts`

### `page.tsx`

#### `app/(dashboard)/dashboard/page.tsx`

```tsx
import { Suspense } from "react";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PlatformV6Page, PlatformV6PageHeader } from "@/components/platform/platform-v6-layout";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ExecutiveDashboardView } from "@/features/executive-dashboard/components/executive-dashboard-view";
import {
  loadDashboardFilterOptions,
  loadExecutiveDashboard,
} from "@/features/analytics/load-executive-dashboard";
import {
  dashboardFiltersToAnalytics,
  parseDashboardSearchParams,
} from "@/lib/analytics/dashboard-filters";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExecutiveDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterState = parseDashboardSearchParams(params);
  const analyticsFilters = dashboardFiltersToAnalytics(filterState);

  let errorMessage: string | null = null;
  let payload = null;
  let filterOptions = null;

  try {
    [payload, filterOptions] = await Promise.all([
      loadExecutiveDashboard(analyticsFilters),
      loadDashboardFilterOptions(),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load executive dashboard.";
  }

  return (
    <DashboardShell
      title="Executive dashboard"
      description="CFO-grade finance monitoring — revenue, profitability, collections, and operational exposure."
      platformV6
      workspaceNavActive="finance"
    >
      <PlatformV6Page>
        <PlatformV6PageHeader
          title="Executive dashboard"
          description="CFO-grade finance monitoring — revenue, profitability, collections, and operational exposure."
        />

        {errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
            {errorMessage}
          </div>
        ) : payload && filterOptions ? (
          <Suspense
            fallback={
              <div className="space-y-4">
                <div className="h-14 animate-pulse rounded-2xl bg-muted" />
                <div className="h-32 animate-pulse rounded-2xl bg-muted" />
              </div>
            }
          >
            <PlatformErrorBoundary surface="executive">
              <ExecutiveDashboardView data={payload} filterOptions={filterOptions} />
            </PlatformErrorBoundary>
          </Suspense>
        ) : null}
      </PlatformV6Page>
    </DashboardShell>
  );
}

```
### Page-specific components

#### `features/executive-dashboard/components/dashboard-filter-bar.tsx`

```tsx
"use client";

import { useCallback, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterIcon, RotateCcwIcon } from "lucide-react";

import type { DashboardFilterOptions } from "@/features/analytics/load-executive-dashboard";
import {
  parseDashboardSearchParams,
  serializeDashboardFilters,
  type DashboardFilterState,
} from "@/lib/analytics/dashboard-filters";
import { devLog } from "@/lib/dev-log";

type DashboardFilterBarProps = {
  options: DashboardFilterOptions;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "achieved", label: "Achieved revenue" },
  { value: "unachieved", label: "Unachieved revenue" },
  { value: "invoiced", label: "Invoiced" },
  { value: "in_collections", label: "In collections" },
] as const;

export function DashboardFilterBar({ options }: DashboardFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const state = useMemo(
    () => parseDashboardSearchParams(Object.fromEntries(searchParams.entries())),
    [searchParams]
  );

  const applyState = useCallback(
    (next: DashboardFilterState) => {
      const params = serializeDashboardFilters(next);
      const query = params.toString();
      if (process.env.NODE_ENV === "development") {
        devLog("[dashboard-filter] apply", { query });
      }
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router]
  );

  const update = (patch: Partial<DashboardFilterState>) => {
    applyState({ ...state, ...patch });
  };

  const reset = () => {
    applyState({});
  };

  return (
    <div
      className="platform-v6-dash-filters"
      data-pending={isPending ? "true" : undefined}
    >
      <FilterIcon className="size-[13px] shrink-0 text-[var(--tw-text-3,#94a3b8)]" aria-hidden />
      <span className="text-[11px] font-semibold text-[var(--tw-text-2,#475569)]">Filters</span>
      <div className="platform-v6-dash-filter-divider" aria-hidden />
      <div className="platform-v6-dash-filter">
        <label htmlFor="filter-from" className="platform-v6-df-lbl">
          From
        </label>
        <input
          id="filter-from"
          type="date"
          className="platform-v6-df-input"
          value={state.from ?? ""}
          onChange={(e) => update({ from: e.target.value || undefined })}
        />
      </div>
      <div className="platform-v6-dash-filter">
        <label htmlFor="filter-to" className="platform-v6-df-lbl">
          To
        </label>
        <input
          id="filter-to"
          type="date"
          className="platform-v6-df-input"
          value={state.to ?? ""}
          onChange={(e) => update({ to: e.target.value || undefined })}
        />
      </div>
      <div className="platform-v6-dash-filter-divider" aria-hidden />
      <FilterSelect
        label="Country"
        value={state.country ?? "all"}
        onChange={(v) => update({ country: v === "all" ? undefined : v })}
        items={[
          { value: "all", label: "All countries" },
          ...options.countries.map((c) => ({ value: c, label: c })),
        ]}
      />
      <FilterSelect
        label="Client"
        value={state.clientId ?? "all"}
        onChange={(v) => update({ clientId: v === "all" ? undefined : v })}
        items={[
          { value: "all", label: "All clients" },
          ...options.clients.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />
      <FilterSelect
        label="Brand"
        value={state.brandId ?? "all"}
        onChange={(v) => update({ brandId: v === "all" ? undefined : v })}
        items={[
          { value: "all", label: "All brands" },
          ...options.brands.map((b) => ({ value: b.id, label: b.name })),
        ]}
      />
      <FilterSelect
        label="Currency"
        value={state.currency ?? "all"}
        onChange={(v) => update({ currency: v === "all" ? undefined : v })}
        items={[
          { value: "all", label: "All currencies" },
          ...options.currencies.map((c) => ({ value: c, label: c })),
        ]}
      />
      <FilterSelect
        label="Status"
        value={state.campaignStatus ?? "all"}
        onChange={(v) => update({ campaignStatus: v === "all" ? undefined : v })}
        items={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
      />
      <button
        type="button"
        className="platform-v6-btn platform-v6-btn-sm ml-auto"
        onClick={reset}
      >
        <RotateCcwIcon className="size-3" aria-hidden />
        Reset
      </button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="platform-v6-dash-filter">
      <label className="platform-v6-df-lbl">{label}</label>
      <select
        className="platform-v6-df-input cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}

```

#### `features/executive-dashboard/components/executive-dashboard-view.tsx`

```tsx
"use client";

import { Suspense } from "react";

import { PlatformV6PageSectionHeader } from "@/components/platform/platform-v6-layout";
import { ExecutiveChartsGrid } from "@/components/dashboard/charts/executive-charts-grid";
import { DashboardFilterBar } from "@/features/executive-dashboard/components/dashboard-filter-bar";
import { ExecutiveKpiStrip } from "@/features/executive-dashboard/components/executive-kpi-strip";
import { FinanceAlertsPanel } from "@/features/executive-dashboard/components/finance-alerts-panel";
import { ProfitabilitySection } from "@/features/executive-dashboard/components/profitability-section";
import type {
  DashboardFilterOptions,
  ExecutiveDashboardPayload,
} from "@/features/analytics/load-executive-dashboard";

type ExecutiveDashboardViewProps = {
  data: ExecutiveDashboardPayload;
  filterOptions: DashboardFilterOptions;
};

export function ExecutiveDashboardView({
  data,
  filterOptions,
}: ExecutiveDashboardViewProps) {
  return (
    <div className="space-y-5">
      <Suspense
        fallback={
          <div className="h-20 animate-pulse rounded-[10px] border border-[var(--tw-border,#e2e8f0)] bg-white" />
        }
      >
        <DashboardFilterBar options={filterOptions} />
      </Suspense>

      <ExecutiveKpiStrip strip={data.executive_kpis} />

      <section>
        <PlatformV6PageSectionHeader
          compact
          title="Performance trends"
          description="Revenue, GP, billing, collections, and PO consumption by period."
        />
        <ExecutiveChartsGrid charts={data.charts} />
      </section>

      <div className="platform-v6-dash-layout">
        <ProfitabilitySection tables={data.profitability_tables} />
        <FinanceAlertsPanel alerts={data.alerts} />
      </div>
    </div>
  );
}

```

#### `features/executive-dashboard/components/executive-kpi-strip.tsx`

```tsx
"use client";

import {
  ActivityIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  PercentIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { PlatformV6KpiStrip } from "@/components/platform/platform-v6-kpi-strip";
import type { AnalyticsKpiCard, AnalyticsKpiStrip } from "@/lib/analytics/types/outputs";

type ExecutiveKpiStripProps = {
  strip: AnalyticsKpiStrip;
  loading?: boolean;
};

const EXECUTIVE_KPI_IDS = [
  "revenue",
  "gp",
  "margin",
  "invoiced",
  "collected",
  "outstanding",
  "vendor",
  "unbilled",
] as const;

type ExecutiveKpiId = (typeof EXECUTIVE_KPI_IDS)[number];

const KPI_STYLE: Record<
  ExecutiveKpiId,
  { icon: LucideIcon; iconStroke: string; iconBg: string; valueClassName?: string }
> = {
  revenue: {
    icon: TrendingUpIcon,
    iconStroke: "#3b82f6",
    iconBg: "#eff6ff",
    valueClassName: "platform-v6-c-blue",
  },
  gp: {
    icon: TrendingUpIcon,
    iconStroke: "#a855f7",
    iconBg: "#faf5ff",
    valueClassName: "platform-v6-c-purple",
  },
  margin: {
    icon: PercentIcon,
    iconStroke: "#ef4444",
    iconBg: "#fef2f2",
  },
  invoiced: {
    icon: CalendarIcon,
    iconStroke: "#10b981",
    iconBg: "#ecfdf5",
  },
  collected: {
    icon: CheckCircle2Icon,
    iconStroke: "#2563eb",
    iconBg: "#eff6ff",
  },
  outstanding: {
    icon: CircleAlertIcon,
    iconStroke: "#f59e0b",
    iconBg: "#fffbeb",
    valueClassName: "platform-v6-c-amber",
  },
  vendor: {
    icon: UsersIcon,
    iconStroke: "#ec4899",
    iconBg: "#fdf2f8",
    valueClassName: "platform-v6-c-pink",
  },
  unbilled: {
    icon: ActivityIcon,
    iconStroke: "#10b981",
    iconBg: "#ecfdf5",
  },
};

function formatCardValue(card: AnalyticsKpiCard): string {
  if (card.id === "margin") {
    return `${card.value.toFixed(1)}%`;
  }
  return card.formatted_value;
}

export function ExecutiveKpiStrip({ strip, loading }: ExecutiveKpiStripProps) {
  if (loading) {
    return (
      <div className="platform-v6-kpi-strip platform-v6-kpi-strip--executive">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="platform-v6-kpi-cell animate-pulse">
            <div className="platform-v6-kpi-lbl">&nbsp;</div>
            <div className="platform-v6-kpi-val">&nbsp;</div>
          </div>
        ))}
      </div>
    );
  }

  const cards = strip.cards.filter((card) =>
    EXECUTIVE_KPI_IDS.includes(card.id as ExecutiveKpiId)
  );

  const items = cards.map((card) => {
    const style = KPI_STYLE[card.id as ExecutiveKpiId] ?? {
      icon: WalletIcon,
      iconStroke: "#2563eb",
      iconBg: "#eff6ff",
    };
    return {
      id: card.id,
      label: card.label.toUpperCase(),
      value: formatCardValue(card),
      icon: style.icon,
      iconStroke: style.iconStroke,
      iconBg: style.iconBg,
      valueClassName: style.valueClassName,
    };
  });

  return (
    <>
      {strip.currency.is_mixed_currency ? (
        <p className="platform-v6-mixed-currency">
          {strip.currency.mixed_label ?? "Mixed currency"} — totals are not FX-converted.
        </p>
      ) : null}
      <PlatformV6KpiStrip
        className="platform-v6-kpi-strip--executive mb-5"
        items={items}
        layout="flex"
      />
    </>
  );
}

```

#### `features/executive-dashboard/components/finance-alerts-panel.tsx`

```tsx
"use client";

import Link from "next/link";
import { UsersIcon } from "lucide-react";

import { PlatformV6PageSectionHeader } from "@/components/platform/platform-v6-layout";
import { formatAnalyticsAmount, buildCurrencyContext } from "@/lib/analytics/currency/engine";
import type { FinanceAlert, FinanceAlertsPayload } from "@/lib/analytics/queries/dashboard-alerts";

const GROUP_LABELS: Record<FinanceAlert["group"], string> = {
  po: "Purchase orders",
  collections: "Collections",
  billing: "Billing",
  profitability: "Profitability",
  vendor: "Vendor payments",
};

const GROUP_ORDER: FinanceAlert["group"][] = [
  "collections",
  "billing",
  "po",
  "profitability",
  "vendor",
];

type FinanceAlertsPanelProps = {
  alerts: FinanceAlertsPayload;
};

export function FinanceAlertsPanel({ alerts }: FinanceAlertsPanelProps) {
  const currency = buildCurrencyContext([]);

  return (
    <section>
      <PlatformV6PageSectionHeader
        compact
        title="Finance alerts"
        description="Grouped monitoring signals — click through to resolve."
      />
      <div className="platform-v6-alert-section">
        {alerts.alerts.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-[var(--tw-text-3,#94a3b8)]">
            No active alerts for the current filter set.
          </p>
        ) : (
          GROUP_ORDER.map((group) => {
            const items = alerts.by_group[group];
            if (items.length === 0) return null;
            return (
              <div key={group}>
                <div className="platform-v6-alert-group-label">
                  {group === "vendor" ? (
                    <UsersIcon className="size-3" aria-hidden />
                  ) : null}
                  {GROUP_LABELS[group]}
                  <span className="cnt">{items.length}</span>
                </div>
                <ul className="list-none p-0">
                  {items.slice(0, 8).map((alert) => (
                    <li key={alert.id}>
                      <Link href={alert.href} className="platform-v6-alert-item">
                        <div className="platform-v6-alert-dot" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 text-xs font-semibold text-[var(--tw-text,#0f172a)]">
                            {alert.title}
                          </div>
                          <div className="line-clamp-2 text-[11px] text-[var(--tw-text-3,#94a3b8)]">
                            {alert.description}
                          </div>
                          {alert.amount != null ? (
                            <div className="mt-1 text-xs font-bold text-[var(--tw-amber-text,#92400e)] tabular-nums">
                              {formatAnalyticsAmount(alert.amount, currency)}
                            </div>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

```

#### `features/executive-dashboard/components/profitability-section.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZIcon, ArrowUpAZIcon } from "lucide-react";

import {
  PlatformV6PageSectionHeader,
  PlatformV6SectionHead,
  PlatformV6SectionWrap,
} from "@/components/platform/platform-v6-layout";
import {
  OperationalConfigurableTable,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-table-controls";
import { Button } from "@/components/ui/button";
import type { AnalyticsRollupNode } from "@/lib/analytics/types/metrics";
import { cn } from "@/lib/utils";
import type { ExecutiveDashboardPayload } from "@/features/analytics/load-executive-dashboard";
import {
  buildProfitabilityTableColumns,
  type ProfitabilitySortKey,
} from "@/lib/tables/profitability-table-columns";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type ProfitabilitySectionProps = {
  tables: ExecutiveDashboardPayload["profitability_tables"];
};

const PROFITABILITY_TABLES = [
  {
    title: "Top clients",
    description: "Highest revenue clients",
    rowsKey: "top_clients" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityClients,
    contextLabel: "Top clients",
    defaultSort: "revenue" as ProfitabilitySortKey,
    grid: true,
  },
  {
    title: "Lowest margin clients",
    description: "Clients requiring margin review",
    rowsKey: "lowest_margin_clients" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityLowMarginClients,
    contextLabel: "Low margin clients",
    defaultSort: "margin" as ProfitabilitySortKey,
    grid: true,
  },
  {
    title: "Top campaigns",
    description: "Campaign-level revenue leaders",
    rowsKey: "top_campaigns" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityCampaigns,
    contextLabel: "Top campaigns",
    defaultSort: "revenue" as ProfitabilitySortKey,
    grid: true,
  },
  {
    title: "Country profitability",
    description: "GP performance by market",
    rowsKey: "country_profitability" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityCountries,
    contextLabel: "Country profitability",
    defaultSort: "gp" as ProfitabilitySortKey,
    grid: true,
  },
  {
    title: "Brand profitability",
    description: "Brand-level margin view",
    rowsKey: "brand_profitability" as const,
    tableId: OPERATIONAL_TABLE_IDS.executiveProfitabilityBrands,
    contextLabel: "Brand profitability",
    defaultSort: "margin" as ProfitabilitySortKey,
    grid: false,
  },
] as const;

function ProfitabilityTable({
  title,
  description,
  rows,
  tableId,
  contextLabel,
  defaultSort,
}: {
  title: string;
  description: string;
  rows: AnalyticsRollupNode[];
  tableId: (typeof OPERATIONAL_TABLE_IDS)[keyof typeof OPERATIONAL_TABLE_IDS];
  contextLabel: string;
  defaultSort: ProfitabilitySortKey;
}) {
  const [sortKey, setSortKey] = useState<ProfitabilitySortKey>(defaultSort);
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "label") {
        return asc ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label);
      }
      let av = 0;
      let bv = 0;
      if (sortKey === "revenue") {
        av = a.metrics.revenue;
        bv = b.metrics.revenue;
      } else if (sortKey === "gp") {
        av = a.metrics.gp;
        bv = b.metrics.gp;
      } else {
        av = a.metrics.margin_percent;
        bv = b.metrics.margin_percent;
      }
      return asc ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, asc]);

  const toggleSort = (key: ProfitabilitySortKey) => {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "label");
    }
  };

  const SortHead = ({
    label,
    active,
    asc: sortAsc,
    onClick,
    className,
  }: {
    label: string;
    active: boolean;
    asc: boolean;
    onClick: () => void;
    className?: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-1 inline-flex h-7 px-1.5 text-[10px] font-medium uppercase tracking-wide",
        className
      )}
      onClick={onClick}
    >
      {label}
      {active ? (
        sortAsc ? (
          <ArrowUpAZIcon className="size-3" data-icon="inline-end" />
        ) : (
          <ArrowDownAZIcon className="size-3" data-icon="inline-end" />
        )
      ) : null}
    </Button>
  );

  const columns = useMemo(
    () =>
      buildProfitabilityTableColumns({
        sortKey,
        asc,
        onToggleSort: toggleSort,
        SortHead,
      }),
    [sortKey, asc]
  );

  return (
    <OperationalTableSuiteProvider
      tableId={tableId}
      columns={columns}
      rows={sorted}
      filterAccessors={{
        name: (row) => row.label,
        revenue: (row) => row.metrics.revenue,
        gp: (row) => row.metrics.gp,
        margin: (row) => row.metrics.margin_percent,
      }}
    >
      <PlatformV6SectionWrap>
        <PlatformV6SectionHead
          title={title}
          description={description}
          actions={<OperationalTableControlsSlot contextLabel={contextLabel} />}
        />
        <div className="overflow-x-auto">
          {sorted.length === 0 ? (
            <p className="px-4 py-8 text-center text-[11px] text-[var(--tw-text-3,#94a3b8)]">
              No rows for current filters
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={columns}
              rows={sorted}
              rowKey={(row) => `${title}-${row.key}`}
            />
          )}
        </div>
      </PlatformV6SectionWrap>
    </OperationalTableSuiteProvider>
  );
}

export function ProfitabilitySection({ tables }: ProfitabilitySectionProps) {
  const gridTables = PROFITABILITY_TABLES.filter((t) => t.grid);
  const fullWidthTables = PROFITABILITY_TABLES.filter((t) => !t.grid);

  return (
    <section>
      <PlatformV6PageSectionHeader
        compact
        title="Profitability analysis"
        description="Client, campaign, country, and brand performance — sortable and pagination-ready."
      />
      <div className="platform-v6-pa-grid">
        {gridTables.map((config) => (
          <ProfitabilityTable
            key={config.tableId}
            title={config.title}
            description={config.description}
            rows={tables[config.rowsKey]}
            tableId={config.tableId}
            contextLabel={config.contextLabel}
            defaultSort={config.defaultSort}
          />
        ))}
      </div>
      {fullWidthTables.map((config) => (
        <ProfitabilityTable
          key={config.tableId}
          title={config.title}
          description={config.description}
          rows={tables[config.rowsKey]}
          tableId={config.tableId}
          contextLabel={config.contextLabel}
          defaultSort={config.defaultSort}
        />
      ))}
    </section>
  );
}

```

## Route `/campaigns`

Campaigns list with PlatformV6 page chrome + KPI strip.

**Page file:** `app/(dashboard)/campaigns/page.tsx`

**Page-family shared used:** `components/platform/platform-v6-layout.tsx`, `components/platform/platform-v6-kpi-strip.tsx`

### Mock / sample / fallback data

Found fallback/seed-related modules:

- `features/campaigns/campaign-page-fallbacks.ts`

**Data loaders (live; not expanded as UI):**

- `features/campaigns/queries.ts`
- `features/campaigns/actions.ts`

### `page.tsx`

#### `app/(dashboard)/campaigns/page.tsx`

```tsx
import { EMPTY_CAMPAIGN_FORM_OPTIONS } from "@/features/campaigns/campaign-page-fallbacks";
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformV6Page, PlatformV6PageHeader } from "@/components/platform/platform-v6-layout";
import { CampaignsKpiStrip } from "@/features/campaigns/components/campaigns-kpi-strip";
import { CampaignsListSection } from "@/features/campaigns/components/campaigns-list-section";
import { NewCampaignDialog } from "@/features/campaigns/components/new-campaign-dialog";
import {
  getCampaignFormOptions,
  getCampaignsKpis,
  getCampaignsList,
  type CampaignsKpis,
} from "@/features/campaigns/queries";

type CampaignsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
};

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.q?.trim() ?? "";

  let list;
  let formOptions;
  let errorMessage: string | null = null;
  let kpis: CampaignsKpis | null = null;

  try {
    const [kpisResult, listResult, formOptionsResult] = await Promise.allSettled([
      getCampaignsKpis(),
      getCampaignsList({ page, search }),
      getCampaignFormOptions(),
    ]);
    kpis = kpisResult.status === "fulfilled" ? kpisResult.value : null;
    list = listResult.status === "fulfilled" ? listResult.value : null;
    formOptions =
      formOptionsResult.status === "fulfilled" ? formOptionsResult.value : null;

    if (!list || !formOptions) {
      throw listResult.status === "rejected"
        ? listResult.reason
        : formOptionsResult.status === "rejected"
          ? formOptionsResult.reason
          : new Error("Failed to load campaigns.");
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load campaigns.";
    list = {
      campaigns: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };
    formOptions = EMPTY_CAMPAIGN_FORM_OPTIONS;
  }

  const { campaigns, total, totalPages } = list;
  const hasSearch = Boolean(search);
  const meta =
    total === 1 ? "1 campaign" : `${total} campaigns` + (hasSearch ? ` matching "${search}"` : "");

  return (
    <DashboardShell title="Campaigns" platformV6 workspaceNavActive="campaigns">
      <PlatformV6Page>
        <PlatformV6PageHeader
          inline
          title="Campaigns"
          description="Plan and manage campaign headers and lines across the brand hierarchy."
          actions={<NewCampaignDialog {...formOptions} />}
        />

        {kpis ? <CampaignsKpiStrip kpis={kpis} /> : null}

        <CampaignsListSection
          campaigns={campaigns}
          meta={meta}
          hasSearch={hasSearch}
          page={list.page}
          totalPages={totalPages}
          search={search}
          errorSlot={
            errorMessage ? (
              <div className="border-b px-4 py-3">
                <PageAlert>{errorMessage}</PageAlert>
              </div>
            ) : null
          }
        />
      </PlatformV6Page>
    </DashboardShell>
  );
}

```
### Mock / fallback sources

#### `features/campaigns/campaign-page-fallbacks.ts`

```ts
import type { CampaignFormOptions } from "@/features/campaigns/queries";

/** Minimal form options so workspace can render when secondary loaders fail. */
export const EMPTY_CAMPAIGN_FORM_OPTIONS: CampaignFormOptions = {
  groups: [],
  clients: [],
  brands: [],
  masterData: {
    categories: [],
    subcategories: [],
    currencies: [],
    countries: [],
    teams: [],
    reportTypes: [],
    paymentTerms: [],
    vrRates: [],
  },
  accountManagers: [],
};

```
### Page-specific components

#### `features/campaigns/components/assignment-hierarchy/operational-table-typography.ts`

```ts
import { cn } from "@/lib/utils";

/** Assignment operational grid — matches reference: light sans, tabular numbers, no mono. */
export const OPERATIONAL_TABLE_FONT = "font-sans";

/** Data sheet surface (token-based for light/dark). */
export const OPERATIONAL_TABLE_SURFACE = "bg-card";

/** Scoped CSS in `.thinkway-campaign-workspace` owns header strip styling. */
export const OPERATIONAL_TABLE_HEADER_SURFACE = "";

export const OPERATIONAL_TABLE_HEADER_ROW = "";

export const OPERATIONAL_TABLE_HEADER_CELL = "";

export const OPERATIONAL_AMOUNT_TABULAR =
  "text-[11px] tabular-nums tracking-normal";

/** Default money cells — neutral foreground. */
export const OPERATIONAL_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/90"
);

/** Child money cells match parent row exactly. */
export const OPERATIONAL_CHILD_AMOUNT_CLASS = OPERATIONAL_AMOUNT_CLASS;

/** Billable revenue — login blue primary. */
export const OPERATIONAL_REVENUE_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-medium text-primary"
);

/** Cost columns — subdued foreground. */
export const OPERATIONAL_COST_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/80"
);

export type OperationalAmountVariant =
  | "default"
  | "revenue"
  | "cost"
  | "gp"
  | "margin"
  | "muted";

export function operationalGpAmountClass(value: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    "font-medium",
    value > 0 && "text-brand-product",
    value < 0 && "text-destructive",
    value === 0 && "text-foreground/90"
  );
}

export function operationalMarginAmountClass(percent: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    percent < 15 ? "text-warning" : "text-muted-foreground"
  );
}

export function operationalAmountVariantClass(
  variant: OperationalAmountVariant,
  value?: number
): string {
  switch (variant) {
    case "revenue":
      return OPERATIONAL_REVENUE_AMOUNT_CLASS;
    case "cost":
      return OPERATIONAL_COST_AMOUNT_CLASS;
    case "gp":
      return operationalGpAmountClass(value ?? 0);
    case "margin":
      return operationalMarginAmountClass(value ?? 0);
    case "muted":
      return cn(OPERATIONAL_AMOUNT_TABULAR, "text-muted-foreground");
    default:
      return OPERATIONAL_AMOUNT_CLASS;
  }
}

export type OperationalKpiValueSemantic =
  | "revenue"
  | "gp"
  | "cost"
  | "margin"
  | "count";

export function operationalKpiValueClass(
  semantic: OperationalKpiValueSemantic | undefined,
  value?: number
): string | undefined {
  if (!semantic) return undefined;
  switch (semantic) {
    case "revenue":
      return "text-primary";
    case "cost":
      return "text-foreground/80";
    case "gp":
      if (value == null) return "text-brand-product";
      if (value < 0) return "text-destructive";
      if (value > 0) return "text-brand-product";
      return undefined;
    case "margin":
      if (value != null && value < 15) return "text-warning";
      return "text-muted-foreground";
    case "count":
      return "text-foreground";
    default:
      return undefined;
  }
}

/** Campaign workspace chrome — sans family; sizes match pre-operational header scale. */
export const OPERATIONAL_CHROME_TITLE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
);

export const OPERATIONAL_CHROME_META = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal text-muted-foreground"
);

export const OPERATIONAL_CHROME_LABEL = OPERATIONAL_CHROME_META;

/** Status / IO badges in workspace header (default badge scale). */
export const OPERATIONAL_CHROME_STATUS_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xs font-medium"
);

export const OPERATIONAL_CHROME_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal"
);

```

#### `features/campaigns/components/campaign-commercial-summary-card.tsx`

```tsx
"use client";

import { BriefcaseIcon } from "lucide-react";

import {
  ClientFormGrid,
  ClientFormSection,
  CLIENT_FORM_FIELD_LABEL_CLASS,
} from "@/features/clients/components/client-form-ui";

type CampaignCommercialSummaryCardProps = {
  groupName: string | null | undefined;
  clientName: string | null | undefined;
  category: string;
  subcategory: string;
  agencyOrDirect: string;
  vrPercent: string;
};

export function CampaignCommercialSummaryCard({
  groupName,
  clientName,
  category,
  subcategory,
  agencyOrDirect,
  vrPercent,
}: CampaignCommercialSummaryCardProps) {
  return (
    <ClientFormSection
      icon={BriefcaseIcon}
      title="Commercial profile"
      description="Inherited from brand and legal entity"
      className="shadow-none"
    >
      <ClientFormGrid>
        <SummaryField label="Group" value={groupName} />
        <SummaryField label="Client" value={clientName} />
        <SummaryField label="Category" value={category} />
        <SummaryField label="Subcategory" value={subcategory} />
        <SummaryField label="Agency / Direct" value={agencyOrDirect} />
        <SummaryField label="VR%" value={vrPercent} />
      </ClientFormGrid>
    </ClientFormSection>
  );
}

function SummaryField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const display = value?.trim();
  return (
    <div className="grid gap-[7px]">
      <p className={CLIENT_FORM_FIELD_LABEL_CLASS}>{label}</p>
      <p className="text-[13.5px] leading-snug text-foreground">
        {display && display !== "—" ? display : "—"}
      </p>
    </div>
  );
}

```

#### `features/campaigns/components/campaign-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import type { SemanticStatusTone } from "@/components/shared/status/status-config";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/types/database";

import { CAMPAIGN_STATUS_OPTIONS } from "../constants";

const CAMPAIGN_CHIP_TONE_CLASS: Record<SemanticStatusTone, string> = {
  success: "bg-[var(--camp-green-bg)] text-[var(--camp-green-text)]",
  warning: "bg-[var(--camp-amber-bg)] text-[var(--camp-amber-text)]",
  destructive: "bg-[var(--camp-red-bg)] text-[var(--camp-red-text)]",
  foreground: "bg-[var(--camp-blue-light)] text-[var(--camp-blue-text)]",
  neutral:
    "border border-[var(--camp-border)] bg-[var(--camp-surface)] text-[var(--camp-text-2)]",
};

type CampaignStatusBadgeProps = {
  status: CampaignStatus;
  className?: string;
};

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const label =
    CAMPAIGN_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;
  const tone = resolveStatusTone("campaign", status);

  return (
    <StatusBadge
      label={label}
      tone={tone}
      appearance="pill"
      className={cn(
        "thinkway-campaign-status-chip border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em]",
        CAMPAIGN_CHIP_TONE_CLASS[tone],
        className
      )}
    />
  );
}

```

#### `features/campaigns/components/campaigns-empty-state.tsx`

```tsx
import { MegaphoneIcon } from "lucide-react";

type CampaignsEmptyStateProps = {
  hasSearch: boolean;
};

export function CampaignsEmptyState({ hasSearch }: CampaignsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60">
        <MegaphoneIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-foreground">
          {hasSearch ? "No campaigns match your search" : "No campaigns yet"}
        </p>
        <p className="max-w-sm text-[11px] leading-snug text-muted-foreground">
          {hasSearch
            ? "Try a different search term or clear the filter to see all campaigns."
            : "Create your first campaign to plan budgets, timelines, and deliverables."}
        </p>
      </div>
    </div>
  );
}

```

#### `features/campaigns/components/campaigns-kpi-strip.tsx`

```tsx
"use client";

import {
  CheckCircle2Icon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { PlatformV6KpiStrip } from "@/components/platform/platform-v6-kpi-strip";
import type { CampaignsKpis } from "@/features/campaigns/queries";
import { formatMoney } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type CampaignsKpiStripProps = {
  kpis: CampaignsKpis;
  className?: string;
};

export function CampaignsKpiStrip({ kpis, className }: CampaignsKpiStripProps) {
  return (
    <PlatformV6KpiStrip
      className={cn(className)}
      items={[
        {
          id: "total",
          label: "TOTAL CAMPAIGNS",
          value: String(kpis.total_campaigns),
          icon: CheckCircle2Icon,
          iconStroke: "#2563eb",
          iconBg: "#eff6ff",
        },
        {
          id: "revenue",
          label: "TOTAL REVENUE",
          value: formatMoney(kpis.total_revenue, kpis.currency_code),
          icon: WalletIcon,
          iconStroke: "#a855f7",
          iconBg: "#faf5ff",
          valueClassName: "platform-v6-c-blue",
        },
        {
          id: "margin",
          label: "AVG MARGIN",
          value: `${kpis.avg_margin.toFixed(1)}%`,
          icon: TrendingUpIcon,
          iconStroke: "#f59e0b",
          iconBg: "#fffbeb",
          valueClassName: "platform-v6-c-amber",
        },
        {
          id: "assignments",
          label: "ASSIGNMENTS",
          value: String(kpis.assignments),
          icon: UsersIcon,
          iconStroke: "#10b981",
          iconBg: "#ecfdf5",
        },
      ]}
    />
  );
}

```

#### `features/campaigns/components/campaigns-list-section.tsx`

```tsx
"use client";

import { Suspense, type ReactNode } from "react";

import {
  PlatformV6SectionMeta,
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CampaignsEmptyState } from "@/features/campaigns/components/campaigns-empty-state";
import { CampaignsPagination } from "@/features/campaigns/components/campaigns-pagination";
import { CampaignsSearch } from "@/features/campaigns/components/campaigns-search";
import {
  CAMPAIGNS_TABLE_COLUMNS,
  CampaignsTable,
} from "@/features/campaigns/components/campaigns-table";
import {
  CAMPAIGNS_ADDITIONAL_FILTER_FIELDS,
  CAMPAIGNS_TABLE_FILTER_ACCESSORS,
} from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { CampaignListItem } from "@/types/database";

type CampaignsListSectionProps = {
  campaigns: CampaignListItem[];
  meta: string;
  hasSearch: boolean;
  page: number;
  totalPages: number;
  search: string;
  errorSlot?: ReactNode;
};

export function CampaignsListSection({
  campaigns,
  meta,
  hasSearch,
  page,
  totalPages,
  search,
  errorSlot,
}: CampaignsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.campaigns}
      columns={CAMPAIGNS_TABLE_COLUMNS}
      rows={campaigns}
      filterAccessors={CAMPAIGNS_TABLE_FILTER_ACCESSORS}
      additionalFilterFields={CAMPAIGNS_ADDITIONAL_FILTER_FIELDS}
    >
      <PlatformV6SectionMeta title="All campaigns" meta={meta} />
      <PlatformV6Toolbar>
        <Suspense fallback={null}>
          <OperationalTableToolbar contextLabel="Campaigns">
            <CampaignsSearch />
          </OperationalTableToolbar>
        </Suspense>
      </PlatformV6Toolbar>

      <PlatformV6SectionWrap>
        {errorSlot}

        {campaigns.length === 0 ? (
          <CampaignsEmptyState hasSearch={hasSearch} />
        ) : (
          <>
            <CampaignsTable campaigns={campaigns} />
            <div className="border-t px-4 py-3 md:px-[14px]">
              <CampaignsPagination page={page} totalPages={totalPages} search={search} />
            </div>
          </>
        )}
      </PlatformV6SectionWrap>
    </OperationalTableSuiteProvider>
  );
}

```

#### `features/campaigns/components/campaigns-pagination.tsx`

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type CampaignsPaginationProps = {
  page: number;
  totalPages: number;
  search?: string;
};

function buildHref(page: number, search?: string) {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("q", search.trim());
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/campaigns?${query}` : "/campaigns";
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);
  return pages;
}

export function CampaignsPagination({
  page,
  totalPages,
  search,
}: CampaignsPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = getPageNumbers(page, totalPages);

  return (
    <Pagination className="justify-end text-[11px]">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={buildHref(Math.max(1, page - 1), search)}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
          />
        </PaginationItem>
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink href={buildHref(item, search)} isActive={item === page}>
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            href={buildHref(Math.min(totalPages, page + 1), search)}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages ? "pointer-events-none opacity-50" : undefined
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

```

#### `features/campaigns/components/campaigns-search.tsx`

```tsx
"use client";

import { OperationalTableSearch } from "@/components/tables/operational-table-search";

export function CampaignsSearch() {
  return <OperationalTableSearch placeholder="Search campaigns…" />;
}

```

#### `features/campaigns/components/campaigns-table.tsx`

```tsx
"use client";

import Link from "next/link";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { DocumentNumber } from "@/components/ui/document-number";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { formatMoney } from "@/features/campaigns/utils";
import { resolveCampaignListPoBudget } from "@/lib/finance/po/operational-budget";
import {
  PO_ALERT_FRAME,
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
  resolvePoAlertStatus,
} from "@/lib/finance/po/status";
import type { CampaignListItem } from "@/types/database";
import { formatGroupDisplayName } from "@/lib/groups/group-display";
import { cn } from "@/lib/utils";

type CampaignsTableProps = {
  campaigns: CampaignListItem[];
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  return format(new Date(`${value}T00:00:00`), "MMM d, yyyy");
}

function campaignPoBudget(campaign: CampaignListItem) {
  return resolveCampaignListPoBudget(campaign);
}

function listPoAlertStatus(campaign: CampaignListItem) {
  const budget = campaignPoBudget(campaign);
  const consumed = Number(campaign.po_consumed_amount ?? 0);
  return resolvePoAlertStatus({
    po_status: campaign.po_status ?? "draft",
    po_exceeded: budget > 0 && consumed > budget,
  });
}

export const CAMPAIGNS_TABLE_COLUMNS: OperationalConfigurableColumnDef<CampaignListItem>[] = [
  {
    id: "document_number",
    label: "Campaign #",
    renderCell: (campaign) => (
      <Link href={`/campaigns/${campaign.id}`} className="platform-v6-link">
        <DocumentNumber value={campaign.document_number} />
      </Link>
    ),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "name",
    label: "Name",
    renderCell: (campaign) => (
      <Link
        href={`/campaigns/${campaign.id}`}
        className="text-xs font-semibold text-[var(--tw-text)] no-underline hover:text-[var(--tw-blue)]"
      >
        {campaign.name}
      </Link>
    ),
  },
  {
    id: "brand",
    label: "Brand",
    renderCell: (campaign) => campaign.brand?.name ?? "—",
    cellClassName: "text-muted-foreground",
  },
  {
    id: "group_client",
    label: "Group · Legal entity",
    renderCell: (campaign) => (
      <>
        {formatGroupDisplayName(campaign.group?.name)}
        {campaign.client?.legal_name || campaign.client?.name
          ? ` · ${campaign.client.legal_name ?? campaign.client.name}`
          : ""}
      </>
    ),
    cellClassName: "text-muted-foreground",
  },
  {
    id: "lines",
    label: "Lines",
    renderCell: (campaign) =>
      campaign.lines.length > 0 ? (
        <Badge
          variant="outline"
          className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
          title={campaign.lines
            .map((line) => formatDocumentNumberForDisplay(line.document_number))
            .join(", ")}
        >
          {campaign.lines.length} {campaign.lines.length === 1 ? "line" : "lines"}
        </Badge>
      ) : (
        "—"
      ),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (campaign) => (
      <CampaignStatusBadge
        status={campaign.status}
        className={OPERATIONAL_CHROME_STATUS_BADGE}
      />
    ),
  },
  {
    id: "po_total",
    label: "PO total",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (campaign) => {
      const poAlertStatus = listPoAlertStatus(campaign);
      return (
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "platform-v6-num font-semibold",
              poAlertStatus === "exceeded" && "platform-v6-c-red",
              poAlertStatus === "near_limit" && "platform-v6-c-amber"
            )}
          >
            {formatMoney(campaignPoBudget(campaign), campaign.currency_code)}
          </span>
          {poAlertStatus === "near_limit" ? (
            <span className={platformV6BadgeClass("outline-amber")}>Near limit</span>
          ) : campaign.po_status && campaign.po_status !== "draft" ? (
            <Badge
              variant={PO_STATUS_VARIANT[campaign.po_status]}
              className={cn(
                OPERATIONAL_CHROME_STATUS_BADGE,
                "font-normal",
                poAlertStatus && "border-2",
                poAlertStatus && PO_ALERT_FRAME[poAlertStatus]
              )}
            >
              {PO_STATUS_LABELS[campaign.po_status]}
            </Badge>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "dates",
    label: "Dates",
    renderCell: (campaign) =>
      `${formatDate(campaign.start_date)} – ${formatDate(campaign.end_date)}`,
    cellClassName: "whitespace-nowrap text-muted-foreground",
  },
];

export const CAMPAIGNS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(
  CAMPAIGNS_TABLE_COLUMNS
);

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <OperationalConfigurableTable
      columns={CAMPAIGNS_TABLE_COLUMNS}
      rows={campaigns}
      rowKey={(campaign) => campaign.id}
    />
  );
}

```

#### `features/campaigns/components/credit-limit-exceeded-dialog.tsx`

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/features/campaigns/utils";
import type { ClientCreditLimitCheck } from "@/lib/finance/client-credit-exposure";

type CreditLimitExceededDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditLimit: ClientCreditLimitCheck;
  onAcceptRisk: () => void;
  onCancel: () => void;
  pending?: boolean;
};

export function CreditLimitExceededDialog({
  open,
  onOpenChange,
  creditLimit,
  onAcceptRisk,
  onCancel,
  pending = false,
}: CreditLimitExceededDialogProps) {
  const currency = creditLimit.currency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client exceeded credit limit</DialogTitle>
          <DialogDescription>
            This campaign would push the client beyond their approved credit limit.
            {creditLimit.can_accept_risk
              ? " You may accept the risk and continue with acknowledgment."
              : " Accept risk is not enabled for this client."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-2xl border bg-muted/30 p-4 text-sm">
          <Row
            label="Current exposure"
            value={formatMoney(creditLimit.exposure, currency)}
          />
          <Row
            label="Credit limit"
            value={
              creditLimit.limit != null
                ? formatMoney(creditLimit.limit, currency)
                : "—"
            }
          />
          <Row
            label="Projected exposure"
            value={formatMoney(creditLimit.projected_exposure, currency)}
          />
          <Row
            label="Exceeded by"
            value={formatMoney(creditLimit.exceeded_by, currency)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          {creditLimit.can_accept_risk ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onAcceptRisk}
              disabled={pending}
            >
              {pending ? "Creating…" : "Accept risk and continue"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

```

#### `features/campaigns/components/new-campaign-dialog.tsx`

```tsx
"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCampaignAction,
  type CreateCampaignFormState,
} from "@/features/campaigns/actions";
import { CreditLimitExceededDialog } from "@/features/campaigns/components/credit-limit-exceeded-dialog";
import { CampaignCommercialSummaryCard } from "@/features/campaigns/components/campaign-commercial-summary-card";
import {
  CAMPAIGN_STATUS_OPTIONS,
  PLATFORM_OPTIONS,
} from "@/features/campaigns/constants";
import type { CampaignFormOptions } from "@/features/campaigns/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { resolveCommercialCategoryLabels } from "@/lib/master-data/commercial-category-labels";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { labelForOption } from "@/lib/master-data/constants";
import { AGENCY_OR_DIRECT_OPTIONS } from "@/features/clients/constants";
import {
  buildClientSelectOptions,
  dedupeClientsById,
} from "@/lib/clients/client-select-options";
import {
  buildGroupFilterSelectOptions,
  isIndependentGroupFilter,
  matchesGroupFilter,
} from "@/lib/groups/group-filter";
import { formatGroupDisplayName } from "@/lib/groups/group-display";

const initialState: CreateCampaignFormState = { ok: false };
const NONE_VALUE = "__none__";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

type NewCampaignDialogProps = CampaignFormOptions;

export function NewCampaignDialog({
  groups,
  clients,
  brands,
  accountManagers,
  masterData,
}: NewCampaignDialogProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [clientId, setClientId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("draft");
  const [currency, setCurrency] = useState(DEFAULT_PLATFORM_CURRENCY);
  const [accountManagerId, setAccountManagerId] = useState(NONE_VALUE);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const acceptRiskRef = useRef<HTMLInputElement>(null);
  const [state, formAction, isPending] = useActionState(
    createCampaignAction,
    initialState
  );

  const uniqueClients = useMemo(() => dedupeClientsById(clients), [clients]);

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId),
    [brands, brandId]
  );

  const selectedClient = useMemo(
    () => uniqueClients.find((c) => c.id === clientId),
    [uniqueClients, clientId]
  );

  const resolvedClientTaxonomy = useMemo(() => {
    const clientCategorySlug =
      selectedClient?.client_category ??
      selectedBrand?.client?.client_category ??
      null;
    const clientSubcategorySlug =
      selectedClient?.client_subcategory ??
      selectedBrand?.client?.client_subcategory ??
      null;

    return { clientCategorySlug, clientSubcategorySlug };
  }, [selectedBrand, selectedClient]);

  const commercialLabels = useMemo(() => {
    if (!selectedBrand && !selectedClient) {
      return null;
    }

    return resolveCommercialCategoryLabels({
      brandCategoryName: selectedBrand?.category?.name,
      brandSubcategoryName: selectedBrand?.subcategory?.name,
      clientCategorySlug: resolvedClientTaxonomy.clientCategorySlug,
      clientSubcategorySlug: resolvedClientTaxonomy.clientSubcategorySlug,
    });
  }, [selectedBrand, selectedClient, resolvedClientTaxonomy]);

  const commercialGroupName = useMemo(() => {
    if (selectedBrand?.group) {
      return (selectedBrand.group as { name: string }).name;
    }
    if (selectedClient?.group_id) {
      return groups.find((group) => group.id === selectedClient.group_id)?.name ?? null;
    }
    if (selectedBrand || selectedClient) {
      return formatGroupDisplayName(null);
    }
    return null;
  }, [groups, selectedBrand, selectedClient]);

  const commercialClientName = useMemo(() => {
    const brandClient = selectedBrand?.client;
    if (brandClient?.legal_name?.trim()) {
      return brandClient.legal_name;
    }
    if (brandClient?.name) {
      return brandClient.name;
    }
    if (selectedClient?.legal_name?.trim()) {
      return selectedClient.legal_name;
    }
    return selectedClient?.name ?? null;
  }, [selectedBrand, selectedClient]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !selectedClient) {
      return;
    }

    if (
      !resolvedClientTaxonomy.clientCategorySlug &&
      !resolvedClientTaxonomy.clientSubcategorySlug
    ) {
      console.warn("[new-campaign-dialog] client taxonomy missing at runtime", {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
      });
    }
  }, [resolvedClientTaxonomy, selectedClient]);

  const filteredClients = useMemo(() => {
    if (isIndependentGroupFilter(groupId)) {
      return uniqueClients.filter((c) => c.group_id == null);
    }
    if (!groupId) return uniqueClients;
    return uniqueClients.filter((c) => c.group_id === groupId);
  }, [uniqueClients, groupId]);

  const filteredBrands = useMemo(() => {
    if (clientId) return brands.filter((b) => b.client_id === clientId);
    if (isIndependentGroupFilter(groupId)) {
      return brands.filter((b) => b.group_id == null);
    }
    if (groupId) return brands.filter((b) => b.group_id === groupId);
    return brands;
  }, [brands, clientId, groupId]);

  const resetHierarchy = useCallback(() => {
    setGroupId("");
    setClientId("");
    setBrandId("");
  }, []);

  const handleGroupChange = useCallback(
    (id: string) => {
      setGroupId(id);
      if (!id) return;
      const client = uniqueClients.find((c) => c.id === clientId);
      if (client && !matchesGroupFilter(client.group_id, id)) {
        setClientId("");
        setBrandId("");
        return;
      }
      const brand = brands.find((b) => b.id === brandId);
      if (brand && !matchesGroupFilter(brand.group_id, id)) {
        setBrandId("");
      }
    },
    [brands, clientId, brandId, uniqueClients]
  );

  const handleClientChange = useCallback(
    (id: string) => {
      setClientId(id);
      if (!id) {
        setBrandId("");
        return;
      }
      const client = uniqueClients.find((c) => c.id === id);
      if (client?.group_id) {
        setGroupId(client.group_id);
      }
      const brand = brands.find((b) => b.id === brandId);
      if (!brand || brand.client_id !== id) {
        setBrandId("");
      }
    },
    [brands, brandId, uniqueClients]
  );

  const handleBrandChange = useCallback(
    (id: string) => {
      setBrandId(id);
      const brand = brands.find((b) => b.id === id);
      if (!brand) return;
      setClientId(brand.client_id);
      setGroupId(brand.group_id ?? "");
    },
    [brands]
  );

  useEffect(() => {
    if (selectedBrand?.currency_code) {
      setCurrency(selectedBrand.currency_code);
    }
  }, [selectedBrand]);

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      resetHierarchy();
      setPlatform("");
      setStatus("draft");
      setCurrency(DEFAULT_PLATFORM_CURRENCY);
      setAccountManagerId(NONE_VALUE);
      if (acceptRiskRef.current) {
        acceptRiskRef.current.value = "false";
      }
      setCreditDialogOpen(false);
      setOpen(false);
      return;
    }

    if (
      state.creditLimit?.exceeded &&
      state.creditLimit.can_accept_risk &&
      acceptRiskRef.current?.value !== "true"
    ) {
      setCreditDialogOpen(true);
      return;
    }

    toast.error(state.message);
  }, [state, resetHierarchy]);

  const groupOptions = buildGroupFilterSelectOptions(groups);

  const clientOptions = useMemo(
    () => buildClientSelectOptions(filteredClients),
    [filteredClients]
  );

  const brandOptions = filteredBrands.map((b) => ({
    value: b.id,
    label: b.name,
  }));

  const hasBrands = brands.length > 0;

  const handleAcceptCreditRisk = useCallback(() => {
    if (acceptRiskRef.current) {
      acceptRiskRef.current.value = "true";
    }
    formRef.current?.requestSubmit();
  }, []);

  const handleCreditDialogCancel = useCallback(() => {
    setCreditDialogOpen(false);
    if (acceptRiskRef.current) {
      acceptRiskRef.current.value = "false";
    }
  }, []);

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="platform-v6-btn platform-v6-btn-primary"
          disabled={!hasBrands}
          title={!hasBrands ? "Create a brand before creating campaigns." : undefined}
        >
          + New Campaign
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,800px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Choose client and brand — selections filter each other and
            auto-fill when you pick a brand or client. Holding group is optional.
            Only the campaign header and PO budget are created; add assignments
            from the Assignments tab.
          </DialogDescription>
        </DialogHeader>
        {!hasBrands ? (
          <p className="text-sm text-muted-foreground">
            Create a brand before creating campaigns.
          </p>
        ) : (
          <form ref={formRef} action={formAction} className="grid gap-4">
            <input type="hidden" name="brand_id" value={brandId} />
            <input type="hidden" name="platform" value={platform} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="currency_code" value={currency} />
            <input
              ref={acceptRiskRef}
              type="hidden"
              name="accept_credit_risk_confirmed"
              defaultValue="false"
            />
            <input
              type="hidden"
              name="account_manager_id"
              value={accountManagerId === NONE_VALUE ? "" : accountManagerId}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Holding group (optional)</Label>
                <SearchableSelect
                  value={groupId}
                  onValueChange={handleGroupChange}
                  options={groupOptions}
                  disabled={isPending}
                  placeholder="All groups"
                />
              </div>
              <div className="grid gap-2">
                <Label>Client</Label>
                <SearchableSelect
                  value={clientId}
                  onValueChange={handleClientChange}
                  options={clientOptions}
                  disabled={isPending || (groupId !== "" && filteredClients.length === 0)}
                  placeholder={
                    groupId && filteredClients.length === 0
                      ? isIndependentGroupFilter(groupId)
                        ? "No independent clients"
                        : "No clients in group"
                      : "Select client"
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Brand</Label>
                <SearchableSelect
                  value={brandId}
                  onValueChange={handleBrandChange}
                  options={brandOptions}
                  disabled={isPending || filteredBrands.length === 0}
                  placeholder={
                    clientId && filteredBrands.length === 0
                      ? "No brands for client"
                      : "Select brand"
                  }
                />
                <FieldError messages={state.fieldErrors?.brand_id} />
              </div>
            </div>

            {(selectedBrand || selectedClient) && commercialLabels ? (
              <CampaignCommercialSummaryCard
                groupName={commercialGroupName}
                clientName={commercialClientName}
                category={commercialLabels.category}
                subcategory={commercialLabels.subcategory}
                agencyOrDirect={labelForOption(
                  AGENCY_OR_DIRECT_OPTIONS,
                  selectedBrand?.client?.agency_or_direct
                )}
                vrPercent={
                  selectedBrand?.vr_rate
                    ? `${(selectedBrand.vr_rate as { rate_percent: number }).rate_percent}%`
                    : "—"
                }
              />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Campaign name</Label>
                <Input id="name" name="name" required disabled={isPending} />
                <FieldError messages={state.fieldErrors?.name} />
              </div>
              <div className="grid gap-2">
                <Label>Platform</Label>
                <Select
                  value={platform || NONE_VALUE}
                  onValueChange={(v) => setPlatform(v === NONE_VALUE ? "" : v)}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
                    {PLATFORM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus} disabled={isPending}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="po_amount">PO amount</Label>
                <Input
                  id="po_amount"
                  name="po_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.po_amount} />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fx_rate">FX rate (to USD)</Label>
                <Input
                  id="fx_rate"
                  name="fx_rate"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  defaultValue="1"
                  disabled={isPending}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="start_date">Start date</Label>
                <Input id="start_date" name="start_date" type="date" disabled={isPending} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_date">End date</Label>
                <Input id="end_date" name="end_date" type="date" disabled={isPending} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Account manager</Label>
                <Select
                  value={accountManagerId}
                  onValueChange={setAccountManagerId}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Assign account manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Unassigned</SelectItem>
                    {accountManagers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name ?? m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !brandId}>
                {isPending ? "Creating…" : "Create campaign"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
      {state.creditLimit?.exceeded ? (
        <CreditLimitExceededDialog
          open={creditDialogOpen}
          onOpenChange={setCreditDialogOpen}
          creditLimit={state.creditLimit}
          onAcceptRisk={handleAcceptCreditRisk}
          onCancel={handleCreditDialogCancel}
          pending={isPending}
        />
      ) : null}
    </>
  );
}

```

#### `features/campaigns/constants.ts`

```ts
/** @deprecated Import from `@/lib/campaigns/constants` — re-export for UI backward compat. */
export * from "@/lib/campaigns/constants";

```

#### `features/clients/components/client-form-ui.tsx`

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { SaveIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

import { PlatformV6PageSectionHeader, PlatformV6WideFormBlock } from "@/components/platform/platform-v6-layout";
import { Label } from "@/components/ui/label";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { cn } from "@/lib/utils";

const ClientProfilePlatformContext = createContext(false);

export function ClientProfilePlatformProvider({
  platformV6,
  children,
}: {
  platformV6?: boolean;
  children: ReactNode;
}) {
  return (
    <ClientProfilePlatformContext.Provider value={Boolean(platformV6)}>
      {children}
    </ClientProfilePlatformContext.Provider>
  );
}

export function useClientProfilePlatformV6() {
  return useContext(ClientProfilePlatformContext);
}

/** Marks a form as the Ctrl+S / Cmd+S save target (see KeyboardShortcutsProvider). */
export const CLIENT_FORM_SHORTCUT_SAVE_ATTR = "data-shortcut-save";

/**
 * Footer hint for client profile tab forms that register `useClientFormSaveShortcut`.
 *
 * Wired forms (when their tab is active):
 * - Overview: `#client-overview-form`
 * - Brands: add-brand dialog (`#client-add-brand-form` when open)
 * - Legal: `#client-legal-form`
 * - Finance: `#client-finance-form`
 */
export const CLIENT_FORM_SAVE_SHORTCUT_HINT = "Ctrl+S to save";

/** Registers Ctrl+S / Cmd+S to submit a form when `enabled` (e.g. active tab or open dialog). */
export function useClientFormSaveShortcut({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useRegisterShortcut(
    enabled
      ? {
          id: `client-form-save-${formId}`,
          keys: "ctrl+s",
          label: "Save form",
          group: "Forms",
          global: true,
          handler: () => {
            if (disabled) return;
            const form = document.getElementById(formId);
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          },
        }
      : null
  );
}

export function ClientFormKeyboardShortcuts({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useClientFormSaveShortcut({ formId, enabled, disabled });
  return null;
}

/** Form controls — Thinkway client form reference (Form_4: blue brand, neutral surfaces). */
export const CLIENT_FORM_MAX_WIDTH = "max-w-[880px]";

export const CLIENT_FORM_INPUT_CLASS = cn(
  "h-auto min-h-9 w-full rounded-[10px] border-border bg-muted px-[13px] py-[11px] text-[13.5px] text-foreground shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-primary focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-primary/20"
);

export const CLIENT_FORM_SELECT_TRIGGER_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "justify-between text-left font-normal"
);

export const CLIENT_FORM_TEXTAREA_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "min-h-[90px] resize-y leading-relaxed"
);

export const CLIENT_FORM_FIELD_LABEL_CLASS =
  "text-[12.5px] font-semibold text-foreground";

export const CLIENT_FORM_FIELD_HINT_CLASS =
  "text-[11.5px] leading-relaxed text-muted-foreground";

export const CLIENT_FORM_PRIMARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent px-4 py-2.5",
  "bg-[linear-gradient(135deg,#0057FF_0%,#2E74FF_55%,#1A6FFF_100%)]",
  "text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,87,255,0.3)]",
  "transition-[transform,box-shadow] active:scale-[0.97]",
  "hover:shadow-[0_6px_20px_rgba(0,87,255,0.42)]",
  "disabled:pointer-events-none disabled:opacity-50"
);

/** Form_4 primary submit for client profile tabs (Brands, Legal, Finance). */
export function ClientProfileTabSaveButton({
  formId,
  label,
  pendingLabel = "Saving…",
  isPending = false,
  disabled = false,
  showSaveIcon = true,
}: {
  formId: string;
  label: string;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  showSaveIcon?: boolean;
}) {
  return (
    <button
      type="submit"
      form={formId}
      className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
      disabled={disabled || isPending}
    >
      {showSaveIcon ? (
        <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
      ) : null}
      {isPending ? pendingLabel : label}
    </button>
  );
}

export const CLIENT_FORM_SECONDARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5",
  "text-xs font-semibold text-foreground transition-[border-color,background-color,transform]",
  "hover:border-border/80 active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export const CLIENT_FORM_GHOST_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-transparent px-4 py-2.5",
  "text-[13px] font-semibold text-muted-foreground transition-colors",
  "hover:bg-muted hover:text-foreground active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export function ClientFormPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.035em] text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-[5px] text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

export type ClientFormBreadcrumb = {
  label: string;
  href?: string;
};

/** Top bar — Form_4 breadcrumbs + Cancel / Save actions. */
export function ClientFormTopbar({
  breadcrumbs,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
}: {
  breadcrumbs: ClientFormBreadcrumb[];
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
}) {
  return (
    <div className="z-15 flex h-[62px] shrink-0 items-center gap-4 border-b border-border bg-background/70 px-[26px] backdrop-blur-md">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13.5px]">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-muted-foreground opacity-50" aria-hidden>
                  /
                </span>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {onCancel ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onCancel}
            disabled={saveDisabled}
          >
            Cancel
          </button>
        ) : null}
        {saveFormId ? (
          <button
            type="submit"
            form={saveFormId}
            className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
            disabled={saveDisabled}
          >
            <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
            {isSaving ? "Saving…" : saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Scrollable form body + pinned footer (Form_4 save bar pattern). */
export function ClientFormLayout({
  children,
  footer,
  topbar,
}: {
  children: ReactNode;
  footer?: ReactNode;
  topbar?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar}
      <div className="h-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {children}
      </div>
      {footer}
    </div>
  );
}

export const CLIENT_FORM_SCROLL_PADDING_CLASS = "px-[26px] pt-7 pb-[120px]";

export function ClientFormSection({
  icon: Icon,
  title,
  description,
  children,
  className,
  iconClassName,
  toolbar,
  bodyClassName,
  footer,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  toolbar?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  /** Tighter padding for dialogs and constrained viewports. */
  compact?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <PlatformV6WideFormBlock
        icon={Icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
        toolbar={toolbar}
        bodyClassName={bodyClassName}
        footer={footer}
        className={className}
      >
        {children}
      </PlatformV6WideFormBlock>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]",
        compact ? "overflow-visible" : "overflow-hidden",
        className
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 border-b border-border",
          compact ? "px-4 py-3" : "px-[22px] py-[18px]"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary",
            compact ? "size-8" : "size-[34px]"
          )}
        >
          <Icon
            className={compact ? "size-4" : "size-[18px]"}
            strokeWidth={1.8}
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-bold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-px text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div
        className={cn(
          compact ? "space-y-3.5 p-4" : "space-y-[18px] p-[22px]",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function ClientFormGrid({
  children,
  className,
  columns,
}: {
  children: ReactNode;
  className?: string;
  /** Override column layout when platform v6 is active. */
  columns?: 3 | 4;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const v6GridClass =
    columns === 4 ? "platform-v6-form-grid-4" : "platform-v6-form-grid";

  return (
    <div
      className={cn(
        platformV6
          ? v6GridClass
          : "grid gap-[18px] sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ClientFormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const platformV6 = useClientProfilePlatformV6();

  return (
    <div className={cn("grid gap-[7px]", className)}>
      <Label
        htmlFor={htmlFor}
        className={
          platformV6 ? "platform-v6-field-label" : CLIENT_FORM_FIELD_LABEL_CLASS
        }
      >
        {label}
      </Label>
      {children}
      {hint ? (
        typeof hint === "string" ? (
          <p
            className={
              platformV6 ? "platform-v6-field-hint" : CLIENT_FORM_FIELD_HINT_CLASS
            }
          >
            {hint}
          </p>
        ) : (
          hint
        )
      ) : null}
    </div>
  );
}

export function ClientFormSaveBar({
  children,
  status,
  onDiscard,
  discardLabel = "Discard",
  discardDisabled,
}: {
  children: ReactNode;
  status?: ReactNode;
  onDiscard?: () => void;
  discardLabel?: string;
  discardDisabled?: boolean;
}) {
  return (
    <div className="z-10 flex shrink-0 flex-wrap items-center gap-3.5 border-t border-border bg-background/90 px-[26px] py-3.5 backdrop-blur-[14px]">
      {status ? (
        <div className="flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
          {status}
        </div>
      ) : null}
      <div className="ml-auto flex flex-wrap gap-2.5">
        {onDiscard ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onDiscard}
            disabled={discardDisabled}
          >
            {discardLabel}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function ClientFormUnsavedStatus() {
  return (
    <>
      <span
        className="size-[7px] shrink-0 rounded-full bg-amber-600 shadow-[0_0_6px_#C2740B]"
        aria-hidden
      />
      Unsaved changes
    </>
  );
}

export const CLIENT_PROFILE_BREADCRUMBS: ClientFormBreadcrumb[] = [
  { label: "Clients", href: "/clients" },
  { label: "Legal Entities", href: "/clients" },
  { label: "Edit" },
];

/** Shared Form_4 shell for client profile tabs (topbar, scroll body, optional dirty footer). */
export function ClientProfileTabShell({
  title,
  description,
  children,
  beforeHeader,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
  isDirty,
  onDiscard,
  discardDisabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Renders above the page title (e.g. onboarding progress strip). */
  beforeHeader?: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-epanel-inner">
        {beforeHeader}
        <PlatformV6PageSectionHeader title={title} description={description} />
        {children}
      </div>
    );
  }

  return (
    <ClientFormLayout
      topbar={
        <ClientFormTopbar
          breadcrumbs={CLIENT_PROFILE_BREADCRUMBS}
          onCancel={onCancel}
          saveFormId={saveFormId}
          saveLabel={saveLabel}
          saveDisabled={saveDisabled}
          isSaving={isSaving}
        />
      }
      footer={
        isDirty ? (
          <ClientFormSaveBar
            status={<ClientFormUnsavedStatus />}
            onDiscard={onDiscard}
            discardDisabled={discardDisabled}
          >
            {saveFormId ? (
              <button
                type="submit"
                form={saveFormId}
                className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
                disabled={saveDisabled}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            ) : null}
          </ClientFormSaveBar>
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          CLIENT_FORM_MAX_WIDTH,
          CLIENT_FORM_SCROLL_PADDING_CLASS
        )}
      >
        <ClientFormPageHeader title={title} description={description} />
        {children}
      </div>
    </ClientFormLayout>
  );
}

```

#### `features/clients/constants.ts`

```ts
import type { ClientStatus } from "@/types/database";
import {
  CLIENT_INDUSTRY_OPTIONS,
} from "@/lib/master-data/constants";
import { getCityOptionsForCountry } from "@/lib/master-data/cities";

export const CLIENTS_PAGE_SIZE = 10;

/** @deprecated Prefer intelligence category/subcategory on clients. */
export const INDUSTRY_OPTIONS = CLIENT_INDUSTRY_OPTIONS;

export const CLIENT_STATUS_OPTIONS: {
  value: ClientStatus;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  CLIENT_INDUSTRY_OPTIONS,
  CLIENT_SUBCATEGORY_BY_CATEGORY,
  COUNTRY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  getClientSubcategoryOptions as getLegacyClientSubcategoryOptions,
  labelForOption,
} from "@/lib/master-data/constants";

export {
  getClientCategoryOptions,
  getClientSubcategoryOptions,
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";

export { getCityOptionsForCountry };

```

## Route `/clients`

Legal entities (clients) list.

**Page file:** `app/(dashboard)/clients/page.tsx`

**Page-family shared used:** `components/platform/platform-v6-layout.tsx`

### Mock / sample / fallback data

_No dedicated mock/fixture modules for this route._ UI renders with **live Supabase data** (see data loaders below). Empty arrays are used only on error fallbacks in `page.tsx`.

**Data loaders (live; not expanded as UI):**

- `features/clients/queries.ts`
- `features/clients/actions.ts`
- `features/validation/actions.ts`

### `page.tsx`

#### `app/(dashboard)/clients/page.tsx`

```tsx
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformV6Page, PlatformV6PageHeader } from "@/components/platform/platform-v6-layout";
import { ClientsListSection } from "@/features/clients/components/clients-list-section";
import { NewClientDialog } from "@/features/clients/components/new-client-dialog";
import { getClientsList } from "@/features/clients/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getGroupsForSelect, getMasterDataOptions } from "@/lib/master-data/queries";

type ClientsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.q?.trim() ?? "";

  let list;
  let groups: Awaited<ReturnType<typeof getGroupsForSelect>> = [];
  let currencyOptions: { value: string; label: string }[] = [];
  let errorMessage: string | null = null;

  try {
    const [listResult, groupsResult, masterData] = await Promise.all([
      getClientsList({ page, search }),
      getGroupsForSelect(),
      getMasterDataOptions(),
    ]);
    list = listResult;
    groups = groupsResult;
    currencyOptions = buildCurrencyOptions(masterData.currencies);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load clients.";
    list = {
      clients: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };
  }

  const { clients, total, totalPages } = list;
  const hasSearch = Boolean(search);
  const meta =
    total === 1
      ? "1 client"
      : `${total} clients` + (hasSearch ? ` matching "${search}"` : "");

  return (
    <DashboardShell title="Clients" platformV6 workspaceNavActive="clients">
      <PlatformV6Page>
        <PlatformV6PageHeader
          inline
          title="Clients"
          description="Clients within holding groups. Brands and campaigns hang off each client."
          actions={
            <NewClientDialog groups={groups} currencyOptions={currencyOptions} />
          }
        />

        <ClientsListSection
          clients={clients}
          meta={meta}
          hasSearch={hasSearch}
          page={list.page}
          totalPages={totalPages}
          search={search}
          errorSlot={
            errorMessage ? (
              <div className="border-b px-4 py-3">
                <PageAlert>{errorMessage}</PageAlert>
              </div>
            ) : null
          }
        />
      </PlatformV6Page>
    </DashboardShell>
  );
}

```
### Page-specific components

#### `features/campaigns/components/assignment-hierarchy/operational-table-typography.ts`

```ts
import { cn } from "@/lib/utils";

/** Assignment operational grid — matches reference: light sans, tabular numbers, no mono. */
export const OPERATIONAL_TABLE_FONT = "font-sans";

/** Data sheet surface (token-based for light/dark). */
export const OPERATIONAL_TABLE_SURFACE = "bg-card";

/** Scoped CSS in `.thinkway-campaign-workspace` owns header strip styling. */
export const OPERATIONAL_TABLE_HEADER_SURFACE = "";

export const OPERATIONAL_TABLE_HEADER_ROW = "";

export const OPERATIONAL_TABLE_HEADER_CELL = "";

export const OPERATIONAL_AMOUNT_TABULAR =
  "text-[11px] tabular-nums tracking-normal";

/** Default money cells — neutral foreground. */
export const OPERATIONAL_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/90"
);

/** Child money cells match parent row exactly. */
export const OPERATIONAL_CHILD_AMOUNT_CLASS = OPERATIONAL_AMOUNT_CLASS;

/** Billable revenue — login blue primary. */
export const OPERATIONAL_REVENUE_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-medium text-primary"
);

/** Cost columns — subdued foreground. */
export const OPERATIONAL_COST_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/80"
);

export type OperationalAmountVariant =
  | "default"
  | "revenue"
  | "cost"
  | "gp"
  | "margin"
  | "muted";

export function operationalGpAmountClass(value: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    "font-medium",
    value > 0 && "text-brand-product",
    value < 0 && "text-destructive",
    value === 0 && "text-foreground/90"
  );
}

export function operationalMarginAmountClass(percent: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    percent < 15 ? "text-warning" : "text-muted-foreground"
  );
}

export function operationalAmountVariantClass(
  variant: OperationalAmountVariant,
  value?: number
): string {
  switch (variant) {
    case "revenue":
      return OPERATIONAL_REVENUE_AMOUNT_CLASS;
    case "cost":
      return OPERATIONAL_COST_AMOUNT_CLASS;
    case "gp":
      return operationalGpAmountClass(value ?? 0);
    case "margin":
      return operationalMarginAmountClass(value ?? 0);
    case "muted":
      return cn(OPERATIONAL_AMOUNT_TABULAR, "text-muted-foreground");
    default:
      return OPERATIONAL_AMOUNT_CLASS;
  }
}

export type OperationalKpiValueSemantic =
  | "revenue"
  | "gp"
  | "cost"
  | "margin"
  | "count";

export function operationalKpiValueClass(
  semantic: OperationalKpiValueSemantic | undefined,
  value?: number
): string | undefined {
  if (!semantic) return undefined;
  switch (semantic) {
    case "revenue":
      return "text-primary";
    case "cost":
      return "text-foreground/80";
    case "gp":
      if (value == null) return "text-brand-product";
      if (value < 0) return "text-destructive";
      if (value > 0) return "text-brand-product";
      return undefined;
    case "margin":
      if (value != null && value < 15) return "text-warning";
      return "text-muted-foreground";
    case "count":
      return "text-foreground";
    default:
      return undefined;
  }
}

/** Campaign workspace chrome — sans family; sizes match pre-operational header scale. */
export const OPERATIONAL_CHROME_TITLE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
);

export const OPERATIONAL_CHROME_META = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal text-muted-foreground"
);

export const OPERATIONAL_CHROME_LABEL = OPERATIONAL_CHROME_META;

/** Status / IO badges in workspace header (default badge scale). */
export const OPERATIONAL_CHROME_STATUS_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xs font-medium"
);

export const OPERATIONAL_CHROME_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal"
);

```

#### `features/clients/components/client-form-ui.tsx`

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { SaveIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

import { PlatformV6PageSectionHeader, PlatformV6WideFormBlock } from "@/components/platform/platform-v6-layout";
import { Label } from "@/components/ui/label";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { cn } from "@/lib/utils";

const ClientProfilePlatformContext = createContext(false);

export function ClientProfilePlatformProvider({
  platformV6,
  children,
}: {
  platformV6?: boolean;
  children: ReactNode;
}) {
  return (
    <ClientProfilePlatformContext.Provider value={Boolean(platformV6)}>
      {children}
    </ClientProfilePlatformContext.Provider>
  );
}

export function useClientProfilePlatformV6() {
  return useContext(ClientProfilePlatformContext);
}

/** Marks a form as the Ctrl+S / Cmd+S save target (see KeyboardShortcutsProvider). */
export const CLIENT_FORM_SHORTCUT_SAVE_ATTR = "data-shortcut-save";

/**
 * Footer hint for client profile tab forms that register `useClientFormSaveShortcut`.
 *
 * Wired forms (when their tab is active):
 * - Overview: `#client-overview-form`
 * - Brands: add-brand dialog (`#client-add-brand-form` when open)
 * - Legal: `#client-legal-form`
 * - Finance: `#client-finance-form`
 */
export const CLIENT_FORM_SAVE_SHORTCUT_HINT = "Ctrl+S to save";

/** Registers Ctrl+S / Cmd+S to submit a form when `enabled` (e.g. active tab or open dialog). */
export function useClientFormSaveShortcut({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useRegisterShortcut(
    enabled
      ? {
          id: `client-form-save-${formId}`,
          keys: "ctrl+s",
          label: "Save form",
          group: "Forms",
          global: true,
          handler: () => {
            if (disabled) return;
            const form = document.getElementById(formId);
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          },
        }
      : null
  );
}

export function ClientFormKeyboardShortcuts({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useClientFormSaveShortcut({ formId, enabled, disabled });
  return null;
}

/** Form controls — Thinkway client form reference (Form_4: blue brand, neutral surfaces). */
export const CLIENT_FORM_MAX_WIDTH = "max-w-[880px]";

export const CLIENT_FORM_INPUT_CLASS = cn(
  "h-auto min-h-9 w-full rounded-[10px] border-border bg-muted px-[13px] py-[11px] text-[13.5px] text-foreground shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-primary focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-primary/20"
);

export const CLIENT_FORM_SELECT_TRIGGER_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "justify-between text-left font-normal"
);

export const CLIENT_FORM_TEXTAREA_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "min-h-[90px] resize-y leading-relaxed"
);

export const CLIENT_FORM_FIELD_LABEL_CLASS =
  "text-[12.5px] font-semibold text-foreground";

export const CLIENT_FORM_FIELD_HINT_CLASS =
  "text-[11.5px] leading-relaxed text-muted-foreground";

export const CLIENT_FORM_PRIMARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent px-4 py-2.5",
  "bg-[linear-gradient(135deg,#0057FF_0%,#2E74FF_55%,#1A6FFF_100%)]",
  "text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,87,255,0.3)]",
  "transition-[transform,box-shadow] active:scale-[0.97]",
  "hover:shadow-[0_6px_20px_rgba(0,87,255,0.42)]",
  "disabled:pointer-events-none disabled:opacity-50"
);

/** Form_4 primary submit for client profile tabs (Brands, Legal, Finance). */
export function ClientProfileTabSaveButton({
  formId,
  label,
  pendingLabel = "Saving…",
  isPending = false,
  disabled = false,
  showSaveIcon = true,
}: {
  formId: string;
  label: string;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  showSaveIcon?: boolean;
}) {
  return (
    <button
      type="submit"
      form={formId}
      className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
      disabled={disabled || isPending}
    >
      {showSaveIcon ? (
        <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
      ) : null}
      {isPending ? pendingLabel : label}
    </button>
  );
}

export const CLIENT_FORM_SECONDARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5",
  "text-xs font-semibold text-foreground transition-[border-color,background-color,transform]",
  "hover:border-border/80 active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export const CLIENT_FORM_GHOST_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-transparent px-4 py-2.5",
  "text-[13px] font-semibold text-muted-foreground transition-colors",
  "hover:bg-muted hover:text-foreground active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export function ClientFormPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.035em] text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-[5px] text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

export type ClientFormBreadcrumb = {
  label: string;
  href?: string;
};

/** Top bar — Form_4 breadcrumbs + Cancel / Save actions. */
export function ClientFormTopbar({
  breadcrumbs,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
}: {
  breadcrumbs: ClientFormBreadcrumb[];
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
}) {
  return (
    <div className="z-15 flex h-[62px] shrink-0 items-center gap-4 border-b border-border bg-background/70 px-[26px] backdrop-blur-md">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13.5px]">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-muted-foreground opacity-50" aria-hidden>
                  /
                </span>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {onCancel ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onCancel}
            disabled={saveDisabled}
          >
            Cancel
          </button>
        ) : null}
        {saveFormId ? (
          <button
            type="submit"
            form={saveFormId}
            className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
            disabled={saveDisabled}
          >
            <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
            {isSaving ? "Saving…" : saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Scrollable form body + pinned footer (Form_4 save bar pattern). */
export function ClientFormLayout({
  children,
  footer,
  topbar,
}: {
  children: ReactNode;
  footer?: ReactNode;
  topbar?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar}
      <div className="h-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {children}
      </div>
      {footer}
    </div>
  );
}

export const CLIENT_FORM_SCROLL_PADDING_CLASS = "px-[26px] pt-7 pb-[120px]";

export function ClientFormSection({
  icon: Icon,
  title,
  description,
  children,
  className,
  iconClassName,
  toolbar,
  bodyClassName,
  footer,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  toolbar?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  /** Tighter padding for dialogs and constrained viewports. */
  compact?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <PlatformV6WideFormBlock
        icon={Icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
        toolbar={toolbar}
        bodyClassName={bodyClassName}
        footer={footer}
        className={className}
      >
        {children}
      </PlatformV6WideFormBlock>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]",
        compact ? "overflow-visible" : "overflow-hidden",
        className
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 border-b border-border",
          compact ? "px-4 py-3" : "px-[22px] py-[18px]"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary",
            compact ? "size-8" : "size-[34px]"
          )}
        >
          <Icon
            className={compact ? "size-4" : "size-[18px]"}
            strokeWidth={1.8}
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-bold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-px text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div
        className={cn(
          compact ? "space-y-3.5 p-4" : "space-y-[18px] p-[22px]",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function ClientFormGrid({
  children,
  className,
  columns,
}: {
  children: ReactNode;
  className?: string;
  /** Override column layout when platform v6 is active. */
  columns?: 3 | 4;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const v6GridClass =
    columns === 4 ? "platform-v6-form-grid-4" : "platform-v6-form-grid";

  return (
    <div
      className={cn(
        platformV6
          ? v6GridClass
          : "grid gap-[18px] sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ClientFormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const platformV6 = useClientProfilePlatformV6();

  return (
    <div className={cn("grid gap-[7px]", className)}>
      <Label
        htmlFor={htmlFor}
        className={
          platformV6 ? "platform-v6-field-label" : CLIENT_FORM_FIELD_LABEL_CLASS
        }
      >
        {label}
      </Label>
      {children}
      {hint ? (
        typeof hint === "string" ? (
          <p
            className={
              platformV6 ? "platform-v6-field-hint" : CLIENT_FORM_FIELD_HINT_CLASS
            }
          >
            {hint}
          </p>
        ) : (
          hint
        )
      ) : null}
    </div>
  );
}

export function ClientFormSaveBar({
  children,
  status,
  onDiscard,
  discardLabel = "Discard",
  discardDisabled,
}: {
  children: ReactNode;
  status?: ReactNode;
  onDiscard?: () => void;
  discardLabel?: string;
  discardDisabled?: boolean;
}) {
  return (
    <div className="z-10 flex shrink-0 flex-wrap items-center gap-3.5 border-t border-border bg-background/90 px-[26px] py-3.5 backdrop-blur-[14px]">
      {status ? (
        <div className="flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
          {status}
        </div>
      ) : null}
      <div className="ml-auto flex flex-wrap gap-2.5">
        {onDiscard ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onDiscard}
            disabled={discardDisabled}
          >
            {discardLabel}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function ClientFormUnsavedStatus() {
  return (
    <>
      <span
        className="size-[7px] shrink-0 rounded-full bg-amber-600 shadow-[0_0_6px_#C2740B]"
        aria-hidden
      />
      Unsaved changes
    </>
  );
}

export const CLIENT_PROFILE_BREADCRUMBS: ClientFormBreadcrumb[] = [
  { label: "Clients", href: "/clients" },
  { label: "Legal Entities", href: "/clients" },
  { label: "Edit" },
];

/** Shared Form_4 shell for client profile tabs (topbar, scroll body, optional dirty footer). */
export function ClientProfileTabShell({
  title,
  description,
  children,
  beforeHeader,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
  isDirty,
  onDiscard,
  discardDisabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Renders above the page title (e.g. onboarding progress strip). */
  beforeHeader?: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-epanel-inner">
        {beforeHeader}
        <PlatformV6PageSectionHeader title={title} description={description} />
        {children}
      </div>
    );
  }

  return (
    <ClientFormLayout
      topbar={
        <ClientFormTopbar
          breadcrumbs={CLIENT_PROFILE_BREADCRUMBS}
          onCancel={onCancel}
          saveFormId={saveFormId}
          saveLabel={saveLabel}
          saveDisabled={saveDisabled}
          isSaving={isSaving}
        />
      }
      footer={
        isDirty ? (
          <ClientFormSaveBar
            status={<ClientFormUnsavedStatus />}
            onDiscard={onDiscard}
            discardDisabled={discardDisabled}
          >
            {saveFormId ? (
              <button
                type="submit"
                form={saveFormId}
                className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
                disabled={saveDisabled}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            ) : null}
          </ClientFormSaveBar>
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          CLIENT_FORM_MAX_WIDTH,
          CLIENT_FORM_SCROLL_PADDING_CLASS
        )}
      >
        <ClientFormPageHeader title={title} description={description} />
        {children}
      </div>
    </ClientFormLayout>
  );
}

```

#### `features/clients/components/client-list-status-cell.tsx`

```tsx
"use client";

import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  ONBOARDING_STATUS_LABELS,
  isClientOnboardingStatus,
  resolveClientListStatusBadges,
} from "@/lib/clients/onboarding-status";
import type { ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

import { ClientStatusBadge } from "./client-status-badge";
import { OnboardingStatusBadge } from "./onboarding-status-badge";

type ClientListStatusCellProps = {
  status: ClientStatus;
  onboardingStatus: string | null | undefined;
  className?: string;
  /** Use thinkway-platform_6.html badge styling on list pages. */
  platformV6?: boolean;
};

function resolveV6BadgeClass(
  kind: "operational" | "onboarding",
  status: string
): string {
  if (kind === "operational") {
    if (status === "active") return platformV6BadgeClass("outline-green");
    return platformV6BadgeClass("gray");
  }
  if (status === "active") return platformV6BadgeClass("outline-green");
  if (status === "legal_pending") return platformV6BadgeClass("outline-amber");
  return platformV6BadgeClass("gray");
}

export function ClientListStatusCell({
  status,
  onboardingStatus,
  className,
  platformV6 = true,
}: ClientListStatusCellProps) {
  const badges = resolveClientListStatusBadges({ status, onboardingStatus });

  if (platformV6) {
    const operationalLabel =
      CLIENT_STATUS_OPTIONS.find((option) => option.value === badges.operationalStatus)
        ?.label ?? badges.operationalStatus;

    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <span className={resolveV6BadgeClass("operational", badges.operationalStatus)}>
          {operationalLabel}
        </span>
        {badges.onboardingStatus &&
        isClientOnboardingStatus(badges.onboardingStatus) ? (
          <span className={resolveV6BadgeClass("onboarding", badges.onboardingStatus)}>
            {ONBOARDING_STATUS_LABELS[badges.onboardingStatus]}
          </span>
        ) : null}
      </div>
    );
  }

  const badgeClassName = cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-medium");

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <ClientStatusBadge status={badges.operationalStatus} className={badgeClassName} />
      {badges.onboardingStatus ? (
        <OnboardingStatusBadge
          status={badges.onboardingStatus}
          className={badgeClassName}
        />
      ) : null}
    </div>
  );
}

```

#### `features/clients/components/client-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/types/database";

import { CLIENT_STATUS_OPTIONS } from "../constants";
import { resolveStatusTone } from "@/components/shared/status/status-utils";

type ClientStatusBadgeProps = {
  status: ClientStatus;
  className?: string;
};

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  const label =
    CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("client", status)}
      className={cn("font-medium", className)}
    />
  );
}

```

#### `features/clients/components/clients-empty-state.tsx`

```tsx
import { Building2Icon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type ClientsEmptyStateProps = {
  hasSearch: boolean;
};

export function ClientsEmptyState({ hasSearch }: ClientsEmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Building2Icon className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            {hasSearch ? "No clients match your search" : "No clients yet"}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {hasSearch
              ? "Try a different search term or clear the filter to see all clients."
              : "Create your first client to start managing campaigns and deliverables."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

```

#### `features/clients/components/clients-list-section.tsx`

```tsx
"use client";

import { Suspense, type ReactNode } from "react";

import {
  PlatformV6SectionMeta,
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { ClientsEmptyState } from "@/features/clients/components/clients-empty-state";
import { ClientsPagination } from "@/features/clients/components/clients-pagination";
import { ClientsSearch } from "@/features/clients/components/clients-search";
import { CLIENTS_TABLE_COLUMNS, ClientsTable } from "@/features/clients/components/clients-table";
import type { ClientsListResult } from "@/features/clients/queries";
import { CLIENTS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type ClientsListSectionProps = {
  clients: ClientsListResult["clients"];
  meta: string;
  hasSearch: boolean;
  page: number;
  totalPages: number;
  search: string;
  errorSlot?: ReactNode;
};

export function ClientsListSection({
  clients,
  meta,
  hasSearch,
  page,
  totalPages,
  search,
  errorSlot,
}: ClientsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.clients}
      columns={CLIENTS_TABLE_COLUMNS}
      rows={clients}
      filterAccessors={CLIENTS_TABLE_FILTER_ACCESSORS}
    >
      <PlatformV6SectionMeta title="All clients" meta={meta} />
      <PlatformV6Toolbar>
        <Suspense fallback={null}>
          <OperationalTableToolbar contextLabel="Clients">
            <ClientsSearch />
          </OperationalTableToolbar>
        </Suspense>
      </PlatformV6Toolbar>

      <PlatformV6SectionWrap>
        {errorSlot}

        {clients.length === 0 ? (
          <ClientsEmptyState hasSearch={hasSearch} />
        ) : (
          <>
            <ClientsTable clients={clients} />
            <div className="border-t px-4 py-3 md:px-[14px]">
              <ClientsPagination page={page} totalPages={totalPages} search={search} />
            </div>
          </>
        )}
      </PlatformV6SectionWrap>
    </OperationalTableSuiteProvider>
  );
}

```

#### `features/clients/components/clients-pagination.tsx`

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type ClientsPaginationProps = {
  page: number;
  totalPages: number;
  search?: string;
};

function buildHref(page: number, search?: string) {
  const params = new URLSearchParams();
  if (search?.trim()) {
    params.set("q", search.trim());
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/clients?${query}` : "/clients";
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);
  return pages;
}

export function ClientsPagination({
  page,
  totalPages,
  search,
}: ClientsPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = getPageNumbers(page, totalPages);

  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={buildHref(Math.max(1, page - 1), search)}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
          />
        </PaginationItem>
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink href={buildHref(item, search)} isActive={item === page}>
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            href={buildHref(Math.min(totalPages, page + 1), search)}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages ? "pointer-events-none opacity-50" : undefined
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

```

#### `features/clients/components/clients-search.tsx`

```tsx
"use client";

import { OperationalTableSearch } from "@/components/tables/operational-table-search";

export function ClientsSearch() {
  return <OperationalTableSearch placeholder="Search clients..." />;
}

```

#### `features/clients/components/clients-table.tsx`

```tsx
"use client";

import Link from "next/link";
import { format } from "date-fns";

import { DocumentNumber } from "@/components/ui/document-number";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import type { ClientsListResult } from "@/features/clients/queries";

import { ClientListStatusCell } from "./client-list-status-cell";

type ClientsTableProps = {
  clients: ClientsListResult["clients"];
};

type ClientRow = ClientsListResult["clients"][number];

export const CLIENTS_TABLE_COLUMNS: OperationalConfigurableColumnDef<ClientRow>[] = [
  {
    id: "document_number",
    label: "Client #",
    colWidth: "96px",
    monoCell: true,
    renderCell: (client) => (
      <Link href={`/clients/${client.id}`} className="platform-v6-link">
        <DocumentNumber value={client.document_number} />
      </Link>
    ),
  },
  {
    id: "legal_entity",
    label: "Legal entity",
    colWidth: "24%",
    renderCell: (client) => {
      const legalName = client.legal_name?.trim();
      const showLegalSubtitle =
        Boolean(legalName) &&
        legalName!.toLowerCase() !== client.name.trim().toLowerCase();

      return (
        <div className="min-w-0 flex flex-col gap-0.5">
          <Link
            href={`/clients/${client.id}`}
            className="platform-v6-link font-semibold"
          >
            {client.name}
          </Link>
          {showLegalSubtitle ? (
            <span className="truncate text-[11px] text-muted-foreground">{legalName}</span>
          ) : null}
        </div>
      );
    },
  },
  {
    id: "group",
    label: "Group",
    colWidth: "16%",
    renderCell: (client) => (
      <span className="block truncate platform-v6-c-gray">
        {client.group?.name ?? "—"}
      </span>
    ),
  },
  {
    id: "status",
    label: "Status",
    colWidth: "18%",
    renderCell: (client) => (
      <ClientListStatusCell
        status={client.status}
        onboardingStatus={client.onboarding_status}
      />
    ),
  },
  {
    id: "billing_email",
    label: "Billing email",
    colWidth: "20%",
    renderCell: (client) => {
      const email = client.billing_email?.trim();
      if (!email) {
        return <span className="block truncate platform-v6-c-gray">—</span>;
      }
      return <span className="block truncate text-[11px]">{email}</span>;
    },
  },
  {
    id: "created",
    label: "Created",
    colWidth: "112px",
    renderCell: (client) => format(new Date(client.created_at), "MMM d, yyyy"),
    cellClassName: "whitespace-nowrap platform-v6-c-gray text-[11px]",
  },
];

export const CLIENTS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(CLIENTS_TABLE_COLUMNS);

export function ClientsTable({ clients }: ClientsTableProps) {
  return (
    <OperationalConfigurableTable
      columns={CLIENTS_TABLE_COLUMNS}
      rows={clients}
      rowKey={(client) => client.id}
    />
  );
}

```

#### `features/clients/components/new-client-dialog.tsx`

```tsx
"use client";

import { ClipboardListIcon, MapPinIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { ClientCategoryFields } from "@/components/forms/client-category-fields";
import type { ClientCategorySuggestionState } from "@/components/forms/client-category-suggestion";
import { useClientCategoryClassification } from "@/components/forms/use-client-category-classification";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ClientFormField,
  ClientFormGrid,
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  CLIENT_FORM_FIELD_HINT_CLASS,
  CLIENT_FORM_GHOST_BUTTON_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_PRIMARY_BUTTON_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS,
} from "@/features/clients/components/client-form-ui";
import {
  createClientAction,
  type CreateClientFormState,
} from "@/features/clients/actions";
import {
  AGENCY_OR_DIRECT_OPTIONS,
  COUNTRY_OPTIONS,
  getCityOptionsForCountry,
} from "@/features/clients/constants";
import { checkClientNameAvailable } from "@/features/validation/actions";
import type { AgencyOrDirect } from "@/types/database";
import { cn } from "@/lib/utils";

const initialState: CreateClientFormState = { ok: false };

type NewClientDialogProps = {
  groups: { id: string; name: string }[];
  currencyOptions: { value: string; label: string }[];
};

export function NewClientDialog({ groups, currencyOptions }: NewClientDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [agencyOrDirect, setAgencyOrDirect] = useState<AgencyOrDirect>("agency");
  const [status, setStatus] = useState("prospect");
  const [currency, setCurrency] = useState(DEFAULT_PLATFORM_CURRENCY);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [subcategorySlug, setSubcategorySlug] = useState("");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [classificationMeta, setClassificationMeta] =
    useState<ClientCategorySuggestionState | null>(null);

  const cityOptions = useMemo(() => getCityOptionsForCountry(country), [country]);

  const {
    suggestion,
    resetClassificationRequest,
  } = useClientCategoryClassification({
    companyName: entityName,
    country,
    enabled: open && !categoryTouched,
    onClassified: (result) => {
      if (!categoryTouched) {
        setCategorySlug(result.categorySlug);
        setSubcategorySlug(result.subcategorySlug);
        setClassificationMeta(result);
      }
    },
  });

  useEffect(() => {
    if (open && !categoryTouched && suggestion && !categorySlug && !subcategorySlug) {
      setCategorySlug(suggestion.categorySlug);
      setSubcategorySlug(suggestion.subcategorySlug);
      setClassificationMeta(suggestion);
    }
  }, [open, categoryTouched, suggestion, categorySlug, subcategorySlug]);

  function resetDialogForm() {
    setGroupId("");
    setEntityName("");
    setAgencyOrDirect("agency");
    setStatus("prospect");
    setCurrency(DEFAULT_PLATFORM_CURRENCY);
    setCountry("");
    setCity("");
    setCategorySlug("");
    setSubcategorySlug("");
    setCategoryTouched(false);
    setClassificationMeta(null);
    resetClassificationRequest();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetDialogForm();
    }
  }

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    entityName,
    checkClientNameAvailable,
    [agencyOrDirect],
    open && Boolean(agencyOrDirect)
  );
  const [state, formAction, isPending] = useActionState(
    createClientAction,
    initialState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      resetDialogForm();
      setOpen(false);
      if (state.clientId) {
        router.push(`/clients/${state.clientId}`);
      }
      return;
    }

    const fieldMessages = state.fieldErrors
      ? Object.values(state.fieldErrors).flat().filter(Boolean)
      : [];
    toast.error(
      fieldMessages.length > 0 ? fieldMessages[0] : state.message
    );
  }, [state, router]);

  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button type="button" className="platform-v6-btn platform-v6-btn-primary">
          + New Client
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-[20px] border-border p-0 shadow-[var(--card-shadow)] sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border bg-background/70 px-5 py-3.5 backdrop-blur-md">
          <DialogTitle className="text-[25px] font-extrabold tracking-[-0.02em]">
            New client
          </DialogTitle>
          <DialogDescription className="mt-[5px] text-sm">
            Add a client legal entity. Optionally link to a holding group now or
            assign one later from the client profile.
          </DialogDescription>
        </DialogHeader>
        <ClientFormKeyboardShortcuts
          formId="new-client-form"
          enabled={open}
          disabled={isPending || isDuplicate || checking}
        />
        <form
          id="new-client-form"
          action={formAction}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            if (isPending || isDuplicate || checking) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="country" value={country} />
          <input type="hidden" name="city" value={city} />
          <input type="hidden" name="client_category" value={categorySlug} />
          <input type="hidden" name="client_subcategory" value={subcategorySlug} />
          <input
            type="hidden"
            name="classification_source"
            value={classificationMeta?.source ?? ""}
          />
          <input
            type="hidden"
            name="classification_confidence"
            value={classificationMeta?.confidence ?? ""}
          />
          <input
            type="hidden"
            name="classification_reason"
            value={classificationMeta?.reason ?? ""}
          />
          <input
            type="hidden"
            name="suggestion_accepted"
            value={String(
              !categoryTouched && Boolean(classificationMeta) ? true : false
            )}
          />
          <input
            type="hidden"
            name="category_manually_set"
            value={String(categoryTouched)}
          />

          <div className="flex h-0 min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-y-contain px-5 py-4">
            {state.fieldErrors && !state.ok ? (
              <p className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {Object.entries(state.fieldErrors)
                  .flatMap(([field, messages]) =>
                    (messages ?? []).map((message) => `${field}: ${message}`)
                  )
                  .join(" · ")}
              </p>
            ) : null}

            <ClientFormSection
              icon={ClipboardListIcon}
              title="Identity"
              description="Legal name and classification"
              compact
              className="shadow-none"
            >
              <ClientFormGrid>
                <ClientFormField label="Client name (English)" htmlFor="name">
                  <Input
                    id="name"
                    name="name"
                    value={entityName}
                    onChange={(e) => {
                      setEntityName(e.target.value);
                      setCategoryTouched(false);
                      resetClassificationRequest();
                    }}
                    required
                    disabled={isPending}
                    placeholder="e.g. Mindshare LTD"
                    className={CLIENT_FORM_INPUT_CLASS}
                  />
                  <FieldError messages={state.fieldErrors?.name} />
                  {duplicateMessage ? (
                    <p className="text-xs text-destructive">{duplicateMessage}</p>
                  ) : checking ? (
                    <p className={CLIENT_FORM_FIELD_HINT_CLASS}>Checking availability…</p>
                  ) : null}
                </ClientFormField>

                <ClientFormField label="Client name (Arabic)" htmlFor="name_ar">
                  <Input
                    id="name_ar"
                    name="name_ar"
                    disabled={isPending}
                    placeholder="Optional Arabic legal name"
                    dir="rtl"
                    className={CLIENT_FORM_INPUT_CLASS}
                  />
                  <FieldError messages={state.fieldErrors?.name_ar} />
                </ClientFormField>
              </ClientFormGrid>

              <ClientCategoryFields
                categorySlug={categorySlug}
                subcategorySlug={subcategorySlug}
                onCategoryChange={(value) => {
                  setCategoryTouched(true);
                  setCategorySlug(value);
                  setClassificationMeta(null);
                }}
                onSubcategoryChange={(value) => {
                  setCategoryTouched(true);
                  setSubcategorySlug(value);
                  setClassificationMeta(null);
                }}
                disabled={isPending}
                layout="grid"
              />
              <FieldError messages={state.fieldErrors?.client_category} />
              <FieldError messages={state.fieldErrors?.client_subcategory} />

              <ClientFormField label="Holding group (optional)">
                <SearchableSelect
                  value={groupId}
                  onValueChange={setGroupId}
                  options={groupOptions}
                  disabled={isPending}
                  placeholder={
                    groups.length > 0 ? "Link to group (optional)" : "No groups yet"
                  }
                  className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
                />
                <FieldError messages={state.fieldErrors?.group_id} />
                {groups.length === 0 ? (
                  <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
                    You can create a client without a group and link one later.
                  </p>
                ) : null}
              </ClientFormField>

              <ClientFormField label="Relationship type">
                <Select
                  value={agencyOrDirect}
                  onValueChange={(v) => setAgencyOrDirect(v as AgencyOrDirect)}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENCY_OR_DIRECT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClientFormField>
            </ClientFormSection>

            <ClientFormSection
              icon={MapPinIcon}
              title="Location & defaults"
              description="Region and billing currency"
              compact
              className="shadow-none"
            >
              <ClientFormGrid>
                <ClientFormField label="Country">
                  <SearchableSelect
                    value={country}
                    onValueChange={(value) => {
                      setCountry(value);
                      setCity("");
                    }}
                    options={COUNTRY_OPTIONS}
                    disabled={isPending}
                    placeholder="Optional"
                    className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
                  />
                </ClientFormField>
                <ClientFormField label="City">
                  <SearchableSelect
                    value={city}
                    onValueChange={setCity}
                    options={cityOptions}
                    disabled={isPending || !country}
                    placeholder={country ? "Select city" : "Select country first"}
                    className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
                  />
                  <FieldError messages={state.fieldErrors?.city} />
                </ClientFormField>
              </ClientFormGrid>

              <ClientFormField label="Currency">
                <Select
                  value={currency}
                  onValueChange={setCurrency}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClientFormField>

              <ClientFormField label="Notes" htmlFor="notes">
                <Textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  disabled={isPending}
                  className={cn(CLIENT_FORM_TEXTAREA_CLASS, "min-h-[72px]")}
                />
              </ClientFormField>

              <p className="text-xs text-muted-foreground">
                Client IO terms use the platform default. Customize them from the client
                profile after creation.
              </p>
            </ClientFormSection>
          </div>

          <DialogFooter className="shrink-0 gap-2.5 border-t border-border bg-background/90 px-5 py-3 backdrop-blur-[14px]">
            <button
              type="button"
              className={CLIENT_FORM_GHOST_BUTTON_CLASS}
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
              disabled={isPending || isDuplicate || checking}
            >
              {isPending ? "Creating…" : "Create client"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

```

#### `features/clients/components/onboarding-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import {
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_TONE,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

type OnboardingStatusBadgeProps = {
  status: ClientOnboardingStatus;
  className?: string;
};

export function OnboardingStatusBadge({ status, className }: OnboardingStatusBadgeProps) {
  return (
    <StatusBadge
      label={ONBOARDING_STATUS_LABELS[status]}
      tone={ONBOARDING_STATUS_TONE[status]}
      className={cn("font-medium", className)}
    />
  );
}

```

#### `features/clients/constants.ts`

```ts
import type { ClientStatus } from "@/types/database";
import {
  CLIENT_INDUSTRY_OPTIONS,
} from "@/lib/master-data/constants";
import { getCityOptionsForCountry } from "@/lib/master-data/cities";

export const CLIENTS_PAGE_SIZE = 10;

/** @deprecated Prefer intelligence category/subcategory on clients. */
export const INDUSTRY_OPTIONS = CLIENT_INDUSTRY_OPTIONS;

export const CLIENT_STATUS_OPTIONS: {
  value: ClientStatus;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  CLIENT_INDUSTRY_OPTIONS,
  CLIENT_SUBCATEGORY_BY_CATEGORY,
  COUNTRY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  getClientSubcategoryOptions as getLegacyClientSubcategoryOptions,
  labelForOption,
} from "@/lib/master-data/constants";

export {
  getClientCategoryOptions,
  getClientSubcategoryOptions,
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";

export { getCityOptionsForCountry };

```

## Route `/vendors`

Vendors / influencers list.

**Page file:** `app/(dashboard)/vendors/page.tsx`

**Page-family shared used:** `components/platform/platform-v6-layout.tsx`

### Mock / sample / fallback data

_No dedicated mock/fixture modules for this route._ UI renders with **live Supabase data** (see data loaders below). Empty arrays are used only on error fallbacks in `page.tsx`.

**Data loaders (live; not expanded as UI):**

- `features/vendors/actions.ts`
- `features/vendors/queries.ts`

### `page.tsx`

#### `app/(dashboard)/vendors/page.tsx`

```tsx
import { PageAlert } from "@/components/ui/page-alert";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformV6Page, PlatformV6PageHeader } from "@/components/platform/platform-v6-layout";
import { NewVendorDialog } from "@/features/vendors/components/new-vendor-dialog";
import { VendorsListSection } from "@/features/vendors/components/vendors-list-section";
import { getVendorsList } from "@/features/vendors/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getMasterDataOptions } from "@/lib/master-data/queries";
import type { InfluencerStatus } from "@/types/database";

type VendorsPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    platform?: string;
  }>;
};

const VALID_STATUSES: InfluencerStatus[] = [
  "prospect",
  "active",
  "inactive",
  "blacklisted",
];

function parseStatus(value: string | undefined): InfluencerStatus | "" {
  if (!value) {
    return "";
  }

  return VALID_STATUSES.includes(value as InfluencerStatus)
    ? (value as InfluencerStatus)
    : "";
}

export default async function VendorsPage({ searchParams }: VendorsPageProps) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.q?.trim() ?? "";
  const status = parseStatus(params.status);
  const platform = params.platform?.trim() ?? "";

  let list;
  let currencyOptions: { value: string; label: string }[] = [];
  let errorMessage: string | null = null;

  try {
    const [listResult, masterDataResult] = await Promise.allSettled([
      getVendorsList({
        page,
        search,
        status: status || undefined,
        platform: platform || undefined,
      }),
      getMasterDataOptions(),
    ]);

    if (listResult.status === "fulfilled") {
      list = listResult.value;
    } else {
      throw listResult.reason;
    }

    if (masterDataResult.status === "fulfilled") {
      currencyOptions = buildCurrencyOptions(masterDataResult.value.currencies);
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load vendors.";
    list = {
      vendors: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };
  }

  const { vendors, total, totalPages } = list;
  const hasFilters = Boolean(search || status || platform);
  const meta =
    total === 1 ? "1 vendor" : `${total} vendors` + (hasFilters ? " matching filters" : "");

  return (
    <DashboardShell title="Vendors" platformV6>
      <PlatformV6Page>
        <PlatformV6PageHeader
          inline
          title="Vendors"
          description="Manage creators, agencies, and platform presence for campaign assignments."
          actions={<NewVendorDialog currencyOptions={currencyOptions} />}
        />

        <VendorsListSection
          vendors={vendors}
          meta={meta}
          hasFilters={hasFilters}
          page={list.page}
          totalPages={totalPages}
          search={search}
          status={status || undefined}
          platform={platform || undefined}
          errorSlot={
            errorMessage ? (
              <div className="border-b px-4 py-3">
                <PageAlert>{errorMessage}</PageAlert>
              </div>
            ) : null
          }
        />
      </PlatformV6Page>
    </DashboardShell>
  );
}

```
### Page-specific components

#### `features/vendors/components/new-vendor-dialog.tsx`

```tsx
"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EnrichmentMetricField } from "@/components/forms/enrichment-metric-field";
import {
  ProfileUrlEnrichInput,
  type ProfileEnrichmentPayload,
} from "@/components/forms/profile-url-enrich-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createVendorAction,
  type CreateVendorFormState,
} from "@/features/vendors/actions";
import {
  COUNTRY_OPTIONS,
  VENDOR_STATUS_OPTIONS,
} from "@/features/vendors/constants";
import {
  getPlatformMetricsHelper,
  resolveMetricsSourceForEnrichment,
  type MetricsSource,
} from "@/lib/social/enrichment/metrics-status";

const initialState: CreateVendorFormState = { ok: false };
const NONE_VALUE = "__none__";

type NewVendorDialogProps = {
  currencyOptions: { value: string; label: string }[];
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function NewVendorDialog({ currencyOptions }: NewVendorDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("prospect");
  const [countryCode, setCountryCode] = useState(NONE_VALUE);
  const [pricingCurrency, setPricingCurrency] = useState("USD");
  const [profileUrl, setProfileUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [followersSource, setFollowersSource] =
    useState<MetricsSource>("unavailable");
  const [followersManual, setFollowersManual] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [state, formAction, isPending] = useActionState(
    createVendorAction,
    initialState
  );

  const resetForm = useCallback(() => {
    setStatus("prospect");
    setCountryCode(NONE_VALUE);
    setPricingCurrency("USD");
    setProfileUrl("");
    setPlatform("");
    setHandle("");
    setFollowerCount("");
    setFollowersSource("unavailable");
    setFollowersManual(false);
    setDuplicateWarning("");
  }, []);

  const handleEnriched = useCallback((payload: ProfileEnrichmentPayload) => {
    const { parsed, enrichment, duplicates } = payload;
    setPlatform(parsed.platform);
    setHandle(parsed.username);
    setProfileUrl(parsed.profile_url);
    setDuplicateWarning(
      duplicates.length > 0
        ? `This account is already linked to ${duplicates[0].influencer_name}. You can still create the vendor.`
        : ""
    );

    if (!enrichment) {
      setFollowersSource("unavailable");
      return;
    }

    const source = resolveMetricsSourceForEnrichment({
      platform: parsed.platform,
      follower_count: enrichment.follower_count,
      engagement_rate: enrichment.engagement_rate,
      avg_views: enrichment.avg_views,
      sync_status: enrichment.sync_status,
    });
    setFollowersSource(source);

    if (enrichment.follower_count != null && !followersManual) {
      setFollowerCount(String(enrichment.follower_count));
    }
  }, [followersManual]);

  useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
      resetForm();
      setOpen(false);

      if (state.vendorId) {
        router.push(`/vendors/${state.vendorId}`);
      }

      return;
    }

    toast.error(state.message);
  }, [router, state, resetForm]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="platform-v6-btn platform-v6-btn-primary">
          <PlusIcon className="size-3.5" aria-hidden />
          New Vendor
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,840px)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New vendor</DialogTitle>
          <DialogDescription>
            Add a creator or agency. Paste a profile URL to auto-fill platform
            details, or enter them manually.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="status" value={status} />
          <input
            type="hidden"
            name="country_code"
            value={countryCode === NONE_VALUE ? "" : countryCode}
          />
          <input type="hidden" name="platform" value={platform} />
          <input type="hidden" name="handle" value={handle} />
          <input type="hidden" name="profile_url" value={profileUrl} />
          <input
            type="hidden"
            name="follower_count"
            value={followerCount}
          />
          <input type="hidden" name="pricing_currency" value={pricingCurrency} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="display_name">Creator name</Label>
              <Input
                id="display_name"
                name="display_name"
                placeholder="Jane Cooper"
                required
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.display_name} />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <ProfileUrlEnrichInput
                id="profile_url"
                label="Profile URL"
                value={profileUrl}
                disabled={isPending}
                onValueChange={(value) => {
                  setProfileUrl(value);
                  setDuplicateWarning("");
                }}
                onEnriched={handleEnriched}
              />
              {duplicateWarning ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {duplicateWarning}
                </p>
              ) : null}
              <FieldError messages={state.fieldErrors?.profile_url} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="legal_name">Agency name</Label>
              <Input
                id="legal_name"
                name="legal_name"
                placeholder="Creator Studio LLC"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.legal_name} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status_select">Status</Label>
              <Select
                value={status}
                onValueChange={setStatus}
                disabled={isPending}
              >
                <SelectTrigger id="status_select" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="creator@example.com"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.email} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 555 0100"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.phone} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="country_select">Country</Label>
              <Select
                value={countryCode}
                onValueChange={setCountryCode}
                disabled={isPending}
              >
                <SelectTrigger id="country_select" className="w-full">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Not specified</SelectItem>
                  {COUNTRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={state.fieldErrors?.country_code} />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="categories">Category / niche</Label>
              <Input
                id="categories"
                name="categories"
                placeholder="Beauty, Lifestyle, Skincare"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.categories} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="handle_display">Username (override)</Label>
              <Input
                id="handle_display"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@+/, ""))}
                placeholder="janecooper"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.handle} />
            </div>

            <div className="grid gap-2">
              <EnrichmentMetricField
                id="follower_count_display"
                label="Followers (override)"
                value={followerCount}
                fieldSource={
                  followersManual && followerCount.trim()
                    ? "manual"
                    : followersSource
                }
                isManualOverride={followersManual}
                onChange={(value) => {
                  setFollowerCount(value);
                  setFollowersManual(true);
                  setFollowersSource("manual");
                }}
              />
              {getPlatformMetricsHelper(platform) ? (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {getPlatformMetricsHelper(platform)}
                </p>
              ) : null}
              <FieldError messages={state.fieldErrors?.follower_count} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pricing_amount">Base pricing</Label>
              <Input
                id="pricing_amount"
                name="pricing_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="5000"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.pricing_amount} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pricing_currency_select">Pricing currency</Label>
              <Select
                value={pricingCurrency}
                onValueChange={setPricingCurrency}
                disabled={isPending}
              >
                <SelectTrigger id="pricing_currency_select" className="w-full">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Internal notes about this vendor"
                rows={3}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.notes} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

```

#### `features/vendors/components/vendor-dependency-dialog.tsx`

```tsx
"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { AlertTriangleIcon, ArchiveIcon, ArrowRightLeftIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VENDOR_ASSIGNMENT_DEPS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVendorDependenciesAction } from "@/features/vendors/actions";
import { formatMoney } from "@/features/vendors/utils";
import type { VendorLinkedAssignment } from "@/lib/operations/vendor-dependencies";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

const VENDOR_ASSIGNMENT_DEPS_COLUMNS: OperationalConfigurableColumnDef<VendorLinkedAssignment>[] =
  [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (assignment) => (
        <div>
          <span className="font-medium">{assignment.campaign_name}</span>
          <p className="text-xs text-muted-foreground">
            <DocumentNumber value={assignment.campaign_document_number} />
          </p>
        </div>
      ),
    },
    {
      id: "line",
      label: "Line",
      cellClassName: "text-xs",
      monoCell: true,
      renderCell: (assignment) => <DocumentNumber value={assignment.line_document_number} />,
    },
    {
      id: "billing",
      label: "Billing",
      cellClassName: "capitalize",
      renderCell: (assignment) => assignment.billing_status?.replace(/_/g, " ") ?? "—",
    },
    {
      id: "fee",
      label: "Fee",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (assignment) => formatMoney(assignment.agreed_fee, assignment.currency),
    },
  ];

const VENDOR_ASSIGNMENT_DEPS_COLUMN_METAS = getOperationalTableColumnMetas(
  VENDOR_ASSIGNMENT_DEPS_COLUMNS
);

type VendorDependencyDialogProps = {
  vendorId: string;
  vendorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: () => void;
};

export function VendorDependencyDialog({
  vendorId,
  vendorName,
  open,
  onOpenChange,
  onArchive,
}: VendorDependencyDialogProps) {
  const [state, formAction, pending] = useActionState(getVendorDependenciesAction, {
    ok: false,
  });

  useEffect(() => {
    if (!open) return;
    const fd = new FormData();
    fd.set("vendor_id", vendorId);
    formAction(fd);
  }, [open, vendorId, formAction]);

  const deps = state.dependencies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-500" />
            Operational dependencies
          </DialogTitle>
          <DialogDescription>
            {vendorName} — assignments, billing, and audit linkage before archive or delete.
          </DialogDescription>
        </DialogHeader>

        {pending && !deps ? (
          <p className="text-sm text-muted-foreground">Checking dependencies…</p>
        ) : deps ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Assignments", deps.assignments],
                ["Campaigns", deps.campaigns],
                ["Deliverables", deps.deliverables],
                ["Invoices", deps.invoices],
                ["Billing lines", deps.billing_lines],
                ["Payments", deps.payments],
                ["Collections", deps.collections],
                ["Approvals", deps.approvals],
                ["Audit records", deps.audit_records],
              ].map(([label, count]) => (
                <div key={label as string} className="rounded-2xl border p-3">
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <p className="text-xl font-semibold">{count as number}</p>
                </div>
              ))}
            </div>

            {deps.linked_assignments.length > 0 ? (
              <OperationalTableSuiteProvider
                tableId={OPERATIONAL_TABLE_IDS.dialogVendorAssignmentDeps}
                columns={VENDOR_ASSIGNMENT_DEPS_COLUMNS}
                rows={deps.linked_assignments}
                filterAccessors={VENDOR_ASSIGNMENT_DEPS_FILTER_ACCESSORS}
              >
                <div className="flex justify-end pb-2">
                  <OperationalTableControlsSlot contextLabel="Linked assignments" />
                </div>
                <OperationalConfigurableTable
                  columns={VENDOR_ASSIGNMENT_DEPS_COLUMNS}
                  rows={deps.linked_assignments}
                  rowKey={(assignment) => assignment.id}
                />
              </OperationalTableSuiteProvider>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {deps.can_permanently_delete
                ? "No operational linkage — permanent delete may be allowed."
                : "Hard delete blocked — reassign or archive instead."}
            </p>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/operations/move?vendor=${vendorId}`}>
              <ArrowRightLeftIcon className="size-4" />
              Reassign via Move
            </Link>
          </Button>
          {onArchive && deps?.can_archive ? (
            <Button variant="secondary" onClick={onArchive}>
              <ArchiveIcon className="size-4" />
              Archive vendor
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

#### `features/vendors/components/vendor-form-ui.tsx`

```tsx
"use client";

import type { ReactNode } from "react";

import {
  ClientFormLayout,
  ClientFormPageHeader,
  ClientFormSaveBar,
  ClientFormTopbar,
  ClientFormUnsavedStatus,
  CLIENT_FORM_MAX_WIDTH,
  CLIENT_FORM_PRIMARY_BUTTON_CLASS,
  CLIENT_FORM_SCROLL_PADDING_CLASS,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { PlatformV6PageSectionHeader } from "@/components/platform/platform-v6-layout";
import { cn } from "@/lib/utils";

export {
  ClientFormField as VendorFormField,
  ClientFormGrid as VendorFormGrid,
  ClientFormSection as VendorFormSection,
  ClientFormKeyboardShortcuts as VendorFormKeyboardShortcuts,
  CLIENT_FORM_INPUT_CLASS as VENDOR_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS as VENDOR_FORM_SELECT_TRIGGER_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS as VENDOR_FORM_TEXTAREA_CLASS,
  CLIENT_FORM_FIELD_LABEL_CLASS as VENDOR_FORM_FIELD_LABEL_CLASS,
} from "@/features/clients/components/client-form-ui";

export const VENDOR_PROFILE_BREADCRUMBS = [
  { label: "Vendors", href: "/vendors" },
  { label: "Creator workspace" },
] as const;

/** Form shell for vendor profile tabs — matches client profile tab layout. */
export function VendorProfileTabShell({
  title,
  description,
  children,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
  isDirty,
  onDiscard,
  discardDisabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-epanel-inner">
        <PlatformV6PageSectionHeader title={title} description={description} />
        {children}
      </div>
    );
  }

  return (
    <ClientFormLayout
      topbar={
        <ClientFormTopbar
          breadcrumbs={[...VENDOR_PROFILE_BREADCRUMBS]}
          onCancel={onCancel}
          saveFormId={saveFormId}
          saveLabel={saveLabel}
          saveDisabled={saveDisabled}
          isSaving={isSaving}
        />
      }
      footer={
        isDirty ? (
          <ClientFormSaveBar
            status={<ClientFormUnsavedStatus />}
            onDiscard={onDiscard}
            discardDisabled={discardDisabled}
          >
            {saveFormId ? (
              <button
                type="submit"
                form={saveFormId}
                className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
                disabled={saveDisabled}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            ) : null}
          </ClientFormSaveBar>
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          CLIENT_FORM_MAX_WIDTH,
          CLIENT_FORM_SCROLL_PADDING_CLASS
        )}
      >
        <ClientFormPageHeader title={title} description={description} />
        {children}
      </div>
    </ClientFormLayout>
  );
}

```

#### `features/vendors/components/vendor-list-status-cell.tsx`

```tsx
"use client";

import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { VENDOR_STATUS_OPTIONS } from "@/features/vendors/constants";
import type { InfluencerStatus } from "@/types/database";

type VendorListStatusCellProps = {
  status: InfluencerStatus;
};

function resolveV6BadgeClass(status: InfluencerStatus): string {
  if (status === "active") return platformV6BadgeClass("outline-green");
  if (status === "prospect") return platformV6BadgeClass("blue");
  if (status === "blacklisted") return platformV6BadgeClass("red");
  return platformV6BadgeClass("gray");
}

export function VendorListStatusCell({ status }: VendorListStatusCellProps) {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

  return <span className={resolveV6BadgeClass(status)}>{label}</span>;
}

```

#### `features/vendors/components/vendor-row-actions.tsx`

```tsx
"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  ArchiveIcon,
  ArrowRightLeftIcon,
  CreditCardIcon,
  GitMergeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
} from "lucide-react";
import { toast } from "sonner";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  archiveVendorAction,
  updateVendorStatusAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { VendorDependencyDialog } from "@/features/vendors/components/vendor-dependency-dialog";
import type { VendorListRow } from "@/features/vendors/types";

type VendorRowActionsProps = {
  vendor: VendorListRow;
};

export function VendorRowActions({ vendor }: VendorRowActionsProps) {
  const [depOpen, setDepOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveVendorAction,
    { ok: false } satisfies FormActionState
  );
  const [statusState, statusAction, statusPending] = useActionState(
    updateVendorStatusAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!archiveState.message) return;
    if (archiveState.ok) {
      toast.success(archiveState.message);
      setArchiveOpen(false);
      return;
    }
    toast.error(archiveState.message);
  }, [archiveState]);

  useEffect(() => {
    if (!statusState.message) return;
    if (statusState.ok) toast.success(statusState.message);
    else toast.error(statusState.message);
  }, [statusState]);

  const isArchived = vendor.status === "archived";
  const isActive = vendor.status === "active";
  const canArchive = !isArchived && vendor.assignment_count === 0;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={`Actions for ${vendor.display_name}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/vendors/${vendor.id}?tab=overview`}>
              <PencilIcon className="size-4" />
              Edit / open workspace
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/vendors/${vendor.id}?tab=assignments`}>
              View assignments
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/vendors/${vendor.id}?tab=billing`}>
              <CreditCardIcon className="size-4" />
              Billing & rate card
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/operations/move?vendor=${vendor.id}`}>
              <ArrowRightLeftIcon className="size-4" />
              Reassign (Move)
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <GitMergeIcon className="size-4" />
            Merge (coming soon)
          </DropdownMenuItem>
          {!isArchived ? (
            <>
              <DropdownMenuSeparator />
              {isActive ? (
                <DropdownMenuItem asChild disabled={statusPending}>
                  <form action={statusAction} className="w-full">
                    <input type="hidden" name="vendor_id" value={vendor.id} />
                    <input type="hidden" name="status" value="inactive" />
                    <button type="submit" className="flex w-full items-center gap-2">
                      <PowerOffIcon className="size-4" />
                      Set inactive
                    </button>
                  </form>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild disabled={statusPending}>
                  <form action={statusAction} className="w-full">
                    <input type="hidden" name="vendor_id" value={vendor.id} />
                    <input type="hidden" name="status" value="active" />
                    <button type="submit" className="flex w-full items-center gap-2">
                      <PowerIcon className="size-4" />
                      Set active
                    </button>
                  </form>
                </DropdownMenuItem>
              )}
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDepOpen(true)}>
            View dependencies
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={!canArchive}
            onClick={() => setArchiveOpen(true)}
          >
            <ArchiveIcon className="size-4" />
            {vendor.assignment_count > 0
              ? "Archive blocked (assignments)"
              : "Archive vendor"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <VendorDependencyDialog
        vendorId={vendor.id}
        vendorName={vendor.display_name}
        open={depOpen}
        onOpenChange={setDepOpen}
        onArchive={canArchive ? () => setArchiveOpen(true) : undefined}
      />

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive vendor</DialogTitle>
            <DialogDescription>
              Archive {vendor.display_name}? Historical records are preserved.
              Active assignments must be reassigned first.
            </DialogDescription>
          </DialogHeader>
          <form action={archiveAction}>
            <input type="hidden" name="vendor_id" value={vendor.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setArchiveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="secondary" disabled={archivePending}>
                {archivePending ? "Archiving…" : "Archive vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}


```

#### `features/vendors/components/vendor-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { cn } from "@/lib/utils";
import type { InfluencerStatus } from "@/types/database";

import { VENDOR_STATUS_OPTIONS } from "../constants";

type VendorStatusBadgeProps = {
  status: InfluencerStatus;
  className?: string;
};

export function VendorStatusBadge({ status, className }: VendorStatusBadgeProps) {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("vendor", status)}
      className={cn("font-medium", className)}
    />
  );
}

```

#### `features/vendors/components/vendors-empty-state.tsx`

```tsx
import { UsersIcon } from "lucide-react";

type VendorsEmptyStateProps = {
  hasFilters: boolean;
};

export function VendorsEmptyState({ hasFilters }: VendorsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60">
        <UsersIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-foreground">
          {hasFilters ? "No vendors match your filters" : "No vendors yet"}
        </p>
        <p className="max-w-sm text-[11px] leading-snug text-muted-foreground">
          {hasFilters
            ? "Adjust search or filters, or clear them to see all creators."
            : "Add creators and agencies to assign them to campaigns later."}
        </p>
      </div>
    </div>
  );
}

```

#### `features/vendors/components/vendors-filters.tsx`

```tsx
"use client";

import { OperationalTableUrlSelect } from "@/components/tables/operational-table-url-select";
import {
  PLATFORM_OPTIONS,
  VENDOR_STATUS_OPTIONS,
} from "@/features/vendors/constants";

const ALL_VALUE = "__all__";

export function VendorsFilters() {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <OperationalTableUrlSelect
        paramKey="status"
        defaultValue={ALL_VALUE}
        options={[
          { value: ALL_VALUE, label: "All statuses" },
          ...VENDOR_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        aria-label="Filter by status"
      />

      <OperationalTableUrlSelect
        paramKey="platform"
        defaultValue={ALL_VALUE}
        options={[
          { value: ALL_VALUE, label: "All platforms" },
          ...PLATFORM_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          })),
        ]}
        aria-label="Filter by platform"
      />
    </div>
  );
}

```

#### `features/vendors/components/vendors-list-section.tsx`

```tsx
"use client";

import { Suspense, type ReactNode } from "react";

import {
  PlatformV6SectionMeta,
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VendorsEmptyState } from "@/features/vendors/components/vendors-empty-state";
import { VendorsFilters } from "@/features/vendors/components/vendors-filters";
import { VendorsPagination } from "@/features/vendors/components/vendors-pagination";
import { VendorsSearch } from "@/features/vendors/components/vendors-search";
import { VENDORS_TABLE_COLUMNS, VendorsTable } from "@/features/vendors/components/vendors-table";
import type { VendorsListResult } from "@/features/vendors/queries";
import { VENDORS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { InfluencerStatus } from "@/types/database";

type VendorsListSectionProps = {
  vendors: VendorsListResult["vendors"];
  meta: string;
  hasFilters: boolean;
  page: number;
  totalPages: number;
  search: string;
  status?: InfluencerStatus;
  platform?: string;
  errorSlot?: ReactNode;
};

export function VendorsListSection({
  vendors,
  meta,
  hasFilters,
  page,
  totalPages,
  search,
  status,
  platform,
  errorSlot,
}: VendorsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.vendors}
      columns={VENDORS_TABLE_COLUMNS}
      rows={vendors}
      filterAccessors={VENDORS_TABLE_FILTER_ACCESSORS}
    >
      <PlatformV6SectionMeta title="All vendors" meta={meta} />
      <PlatformV6Toolbar>
        <Suspense fallback={null}>
          <OperationalTableToolbar contextLabel="Vendors">
            <VendorsSearch />
            <VendorsFilters />
          </OperationalTableToolbar>
        </Suspense>
      </PlatformV6Toolbar>

      <PlatformV6SectionWrap>
        {errorSlot}

        {vendors.length === 0 ? (
          <VendorsEmptyState hasFilters={hasFilters} />
        ) : (
          <>
            <VendorsTable vendors={vendors} />
            <div className="border-t px-4 py-3 md:px-[14px]">
              <VendorsPagination
                page={page}
                totalPages={totalPages}
                search={search}
                status={status}
                platform={platform}
              />
            </div>
          </>
        )}
      </PlatformV6SectionWrap>
    </OperationalTableSuiteProvider>
  );
}

```

#### `features/vendors/components/vendors-pagination.tsx`

```tsx
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type VendorsPaginationProps = {
  page: number;
  totalPages: number;
  search?: string;
  status?: string;
  platform?: string;
};

function buildHref(
  page: number,
  filters: { search?: string; status?: string; platform?: string }
) {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("q", filters.search.trim());
  }

  if (filters.status?.trim()) {
    params.set("status", filters.status.trim());
  }

  if (filters.platform?.trim()) {
    params.set("platform", filters.platform.trim());
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/vendors?${query}` : "/vendors";
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) {
    pages.push("ellipsis");
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  pages.push(total);
  return pages;
}

export function VendorsPagination({
  page,
  totalPages,
  search,
  status,
  platform,
}: VendorsPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = getPageNumbers(page, totalPages);
  const filters = { search, status, platform };

  return (
    <Pagination className="justify-end text-[11px]">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={buildHref(Math.max(1, page - 1), filters)}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
          />
        </PaginationItem>
        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href={buildHref(item, filters)}
                isActive={item === page}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            href={buildHref(Math.min(totalPages, page + 1), filters)}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages ? "pointer-events-none opacity-50" : undefined
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

```

#### `features/vendors/components/vendors-search.tsx`

```tsx
"use client";

import { OperationalTableSearch } from "@/components/tables/operational-table-search";

export function VendorsSearch() {
  return <OperationalTableSearch placeholder="Search vendors..." />;
}

```

#### `features/vendors/components/vendors-table.tsx`

```tsx
"use client";

import Link from "next/link";

import {
  CreatorIdentityCell,
  creatorProfileSourceFromAccounts,
} from "@/components/creator/creator-profile-link";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { VendorListStatusCell } from "@/features/vendors/components/vendor-list-status-cell";
import { VendorRowActions } from "@/features/vendors/components/vendor-row-actions";
import type { VendorsListResult } from "@/features/vendors/queries";
import {
  formatCategoriesList,
  formatFollowers,
  formatPlatformsSummary,
  formatPricing,
  getTotalFollowers,
} from "../utils";

type VendorsTableProps = {
  vendors: VendorsListResult["vendors"];
};

type VendorRow = VendorsListResult["vendors"][number];

export const VENDORS_TABLE_COLUMNS: OperationalConfigurableColumnDef<VendorRow>[] = [
  {
    id: "document_number",
    label: "Vendor #",
    renderCell: (vendor) => (
      <Link href={`/vendors/${vendor.id}`} className="platform-v6-link">
        <DocumentNumber value={vendor.document_number} />
      </Link>
    ),
  },
  {
    id: "creator",
    label: "Creator",
    renderCell: (vendor) => (
      <CreatorIdentityCell
        source={creatorProfileSourceFromAccounts(vendor.display_name, vendor.platform_accounts)}
        size="sm"
        showHandle={false}
        stopPropagation
        nameClassName="font-medium text-foreground"
      />
    ),
  },
  {
    id: "agency",
    label: "Agency",
    renderCell: (vendor) => (
      <span className="platform-v6-c-gray">{vendor.legal_name ?? "—"}</span>
    ),
  },
  {
    id: "platforms",
    label: "Platforms",
    renderCell: (vendor) => (
      <span className="platform-v6-c-blue">{formatPlatformsSummary(vendor.platform_accounts)}</span>
    ),
  },
  {
    id: "followers",
    label: "Followers",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className="platform-v6-num font-medium">
        {formatFollowers(getTotalFollowers(vendor.platform_accounts))}
      </span>
    ),
  },
  {
    id: "assignments",
    label: "Assignments",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className="platform-v6-num">{vendor.assignment_count}</span>
    ),
  },
  {
    id: "niche",
    label: "Niche",
    renderCell: (vendor) => (
      <span className="block max-w-[140px] truncate text-[11px] text-muted-foreground">
        {formatCategoriesList(vendor.categories)}
      </span>
    ),
  },
  {
    id: "pricing",
    label: "Pricing",
    headerClassName: "text-right",
    amountCell: true,
    renderCell: (vendor) => (
      <span className="platform-v6-c-gray">{formatPricing(vendor.rate_card)}</span>
    ),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (vendor) => <VendorListStatusCell status={vendor.status} />,
  },
  {
    id: "country",
    label: "Country",
    renderCell: (vendor) => vendor.country_code ?? "—",
    cellClassName: "text-muted-foreground",
  },
  {
    id: "actions",
    label: "Actions",
    locked: true,
    headerClassName: "text-right",
    renderCell: (vendor) => <VendorRowActions vendor={vendor} />,
    cellClassName: "text-right",
  },
];

export const VENDORS_TABLE_COLUMN_METAS = getOperationalTableColumnMetas(VENDORS_TABLE_COLUMNS);

export function VendorsTable({ vendors }: VendorsTableProps) {
  return (
    <OperationalConfigurableTable
      columns={VENDORS_TABLE_COLUMNS}
      rows={vendors}
      rowKey={(vendor) => vendor.id}
    />
  );
}

```

#### `features/vendors/constants.ts`

```ts
import type { InfluencerStatus } from "@/types/database";
import {
  COUNTRY_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
  GENDER_OPTIONS,
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  NATIONALITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  SOCIAL_PLATFORM_OPTIONS,
  labelForOption,
} from "@/lib/master-data/constants";

export const VENDORS_PAGE_SIZE = 10;

export const VENDOR_STATUS_OPTIONS: {
  value: InfluencerStatus;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "archived", label: "Archived" },
];

export const PLATFORM_OPTIONS = SOCIAL_PLATFORM_OPTIONS;

export {
  COUNTRY_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
  GENDER_OPTIONS,
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  NATIONALITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  labelForOption,
};

```

## Route `/studio`

Campaign Studio picker (conversations + campaigns).

**Page file:** `app/(dashboard)/studio/page.tsx`

**Page-family shared used:** `components/platform/error-boundary.tsx`

### Mock / sample / fallback data

Found fallback/seed-related modules:

- `features/campaign-outputs/hydration/seed-adapters.ts`

**Data loaders (live; not expanded as UI):**

- `features/studio/queries/list-studio-picker-data.ts`

### `page.tsx`

#### `app/(dashboard)/studio/page.tsx`

```tsx
import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageAlert } from "@/components/ui/page-alert";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { StudioCampaignPicker } from "@/features/studio/components/studio-campaign-picker";
import { listStudioPickerData } from "@/features/studio/queries/list-studio-picker-data";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const data = await listStudioPickerData();

  if ("error" in data) {
    return (
      <DashboardShell
        title="Campaign Studio"
        description="Strategy, outputs, and AI copilot for client-facing campaign work."
        platformV6
      >
        <div className="mx-auto max-w-lg px-5 py-12">
          <PageAlert>{data.error}</PageAlert>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/campaigns" className="font-medium text-[var(--tw-primary,#1D9E75)] hover:underline">
              Browse campaigns
            </Link>{" "}
            or contact your administrator for AI access.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Campaign Studio"
      description="Strategy, outputs, and AI copilot for client-facing campaign work."
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 overflow-y-auto p-0 md:p-0"
    >
      <PlatformErrorBoundary surface="analytics">
        <StudioCampaignPicker conversations={data.conversations} campaigns={data.campaigns} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}

```
### Mock / fallback sources

#### `features/campaign-outputs/hydration/seed-adapters.ts`

```ts
/**
 * Source adapters — normalize each business object into a `CampaignSeed`.
 * Deterministic and defensive: they read only the fields a source actually
 * carries and never invent values. Tier is taken from an explicit role when
 * present, otherwise inferred from follower count.
 */

import type { QuotationDetail, QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  deliverableTypeLines,
  formatTypeLinesSummary,
  quotationPostTypeLabel,
} from "@/lib/quotations/quotation-deliverable-types";
import { buildQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import { groupQuotationItemsByCreator } from "@/lib/quotations/quotation-creator-options";
import { isManualQuotationCreator } from "@/lib/quotations/quotation-creator-platform-utils";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import type { ShortlistDetail } from "@/features/discovery/shortlists/types";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import { getInfluencerTier, type InfluencerTier } from "@/lib/creators/influencer-tier";

import type { CampaignSeed, SeedCreator } from "./hydration-types";
import { normalizeCreatorMatchKey, parseAggregatedServiceLabel } from "./quotation-service-types";

/** Follower-count → tier, when a source has no explicit role. */
export function inferTier(followers?: number | null): InfluencerTier | undefined {
  if (followers == null || followers <= 0) return undefined;
  return getInfluencerTier(followers);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())).map((v) => v.trim()))];
}

// ---------------------------------------------------------------------------
// Quotation → seed
// ---------------------------------------------------------------------------

function serviceTypeLabel(line: { type: string; quantity: number }): string {
  return `${line.quantity}× ${quotationPostTypeLabel(line.type)}`;
}

function serviceTypesForItem(item: QuotationItemRow): string[] {
  const types: string[] = [];
  for (const deliverable of item.deliverables ?? []) {
    const lines = deliverableTypeLines(deliverable).filter((line) => line.type.trim());
    if (lines.length) {
      for (const line of lines) {
        types.push(serviceTypeLabel(line));
      }
      continue;
    }
    const typeSummary = formatTypeLinesSummary(deliverableTypeLines(deliverable));
    if (typeSummary && typeSummary !== "Select type…") {
      types.push(...parseAggregatedServiceLabel(typeSummary));
      continue;
    }
    const service = deliverable.service_description?.trim();
    if (service) types.push(...parseAggregatedServiceLabel(service));
  }
  if (!types.length && item.service_description?.trim()) {
    types.push(...parseAggregatedServiceLabel(item.service_description));
  }
  return [...new Set(types)];
}

function serviceLabelForItem(item: QuotationItemRow): string | undefined {
  const types = serviceTypesForItem(item);
  if (types.length) return [...new Set(types)].join(" · ");
  return undefined;
}

function seedCreatorFromQuotationItem(item: QuotationItemRow): SeedCreator {
  const profile = buildQuotationCreatorProfileSource(item);
  const serviceTypes = serviceTypesForItem(item);
  const manual = isManualQuotationCreator(item);
  return {
    creatorId: manual
      ? `manual:${item.id}`
      : item.unified_id ?? item.influencer_id ?? item.profile_id ?? item.id,
    displayName:
      formatCreatorDisplayName(profile.displayName) ||
      formatCreatorDisplayName(item.creator_name) ||
      "Creator",
    tier: inferTier(item.followers),
    quotedRevenue: item.revenue_egp > 0 ? item.revenue_egp : undefined,
    quotedCurrency: item.revenue_egp > 0 ? "EGP" : undefined,
    platform: item.platform ?? profile.platform ?? undefined,
    handle: profile.handle ?? item.handle ?? undefined,
    avatarUrl: profile.avatarUrl ?? item.profile_image_url ?? undefined,
    profileUrl: profile.profile_url ?? item.profile_url ?? undefined,
    serviceTypes: serviceTypes.length ? serviceTypes : undefined,
    serviceLabel: serviceTypes.length ? serviceTypes.join(" · ") : undefined,
    followers: item.followers ?? undefined,
    engagementRate: item.engagement_rate ?? undefined,
    categories: item.creator_categories ?? undefined,
    country: item.country_code ?? undefined,
  };
}

function seedCreatorFromQuotationGroup(group: ReturnType<typeof groupQuotationItemsByCreator>[number]): SeedCreator {
  const primaryItems = group.optionSets[0]?.items ?? [];
  const sourceItems = primaryItems.length ? primaryItems : [];

  const mergedTypes: string[] = [];
  let base: SeedCreator | undefined;
  let quotedRevenue = 0;

  for (const item of sourceItems) {
    mergedTypes.push(...serviceTypesForItem(item));
    if (!base) base = seedCreatorFromQuotationItem(item);
    if (item.revenue_egp > 0) quotedRevenue += item.revenue_egp;
  }

  const serviceTypes = [...new Set(mergedTypes)];
  return {
    ...base!,
    serviceTypes: serviceTypes.length ? serviceTypes : undefined,
    serviceLabel: serviceTypes.length ? serviceTypes.join(" · ") : undefined,
    quotedRevenue: quotedRevenue > 0 ? quotedRevenue : base!.quotedRevenue,
    quotedCurrency: quotedRevenue > 0 ? "EGP" : base!.quotedCurrency,
  };
}

/** Profile-linked lines group by creator; each manual quotation line stays its own slate row. */
function seedCreatorsFromQuotationItems(items: QuotationItemRow[]): SeedCreator[] {
  if (!items.length) return [];

  const entries: Array<{ sortOrder: number; creator: SeedCreator }> = [];

  for (const item of items) {
    if (!isManualQuotationCreator(item)) continue;
    entries.push({ sortOrder: item.sort_order, creator: seedCreatorFromQuotationItem(item) });
  }

  const profiledItems = items.filter((item) => !isManualQuotationCreator(item));
  for (const group of groupQuotationItemsByCreator(profiledItems)) {
    const sourceItems = group.optionSets[0]?.items ?? [];
    if (!sourceItems.length) continue;
    entries.push({
      sortOrder: Math.min(...sourceItems.map((item) => item.sort_order)),
      creator: seedCreatorFromQuotationGroup(group),
    });
  }

  return entries.sort((a, b) => a.sortOrder - b.sortOrder).map((entry) => entry.creator);
}

export function seedFromQuotation(quotation: QuotationDetail): CampaignSeed {
  const items = quotation.items ?? [];

  const creators: SeedCreator[] = seedCreatorsFromQuotationItems(items);

  const deliverables = uniqueStrings(
    items.flatMap((item) =>
      (item.deliverables ?? []).map((d) => {
        const lines = d.type_lines?.length
          ? d.type_lines.map((line) => `${line.quantity}× ${line.type}`).join(", ")
          : d.type
            ? `${d.quantity ?? 1}× ${d.type}`
            : null;
        return lines ? `${d.platform ? `${d.platform}: ` : ""}${lines}` : item.service_description ?? null;
      })
    )
  );

  const kpis: string[] = [];
  if (quotation.estimated_reach > 0) kpis.push(`${quotation.estimated_reach.toLocaleString()} reach`);
  if (quotation.estimated_engagement_rate)
    kpis.push(`${quotation.estimated_engagement_rate}% engagement`);

  return {
    source: "quotation",
    campaignName: quotation.campaign_name ?? quotation.name ?? undefined,
    client: quotation.client_name ?? quotation.temporary_client_name ?? undefined,
    brand: quotation.brand_name ?? quotation.temporary_brand_name ?? undefined,
    group: quotation.group_name ?? undefined,
    agencyOrDirect: quotation.agency_or_direct ?? undefined,
    agencyName:
      quotation.agency_or_direct === "agency"
        ? quotation.agency_name ?? quotation.client_name ?? undefined
        : undefined,
    budget:
      quotation.total_revenue_egp > 0
        ? { amount: quotation.total_revenue_egp, currency: "EGP" }
        : undefined,
    market: uniqueStrings(items.map((item) => item.country_code)),
    platforms: uniqueStrings(items.map((item) => item.platform)),
    deliverables,
    kpis,
    creators,
  };
}

// ---------------------------------------------------------------------------
// Creator Shortlist / Discovery → seed (both map a UnifiedCreatorResult slate)
// ---------------------------------------------------------------------------

function metricValue(metric: { value?: number | null } | undefined | null): number | undefined {
  return typeof metric?.value === "number" ? metric.value : undefined;
}

function seedCreatorFromUnified(creator: UnifiedCreatorResult): SeedCreator {
  const followers = metricValue(creator.metrics?.followers) ?? creator.platforms?.[0]?.follower_count ?? undefined;
  const engagementRate =
    metricValue(creator.metrics?.engagement_rate) ?? creator.platforms?.[0]?.engagement_rate ?? undefined;
  return {
    creatorId: creator.unified_id,
    displayName: creator.display_name,
    tier: creator.role?.trim() || inferTier(followers),
    platform: creator.platforms?.[0]?.platform ?? undefined,
    followers: followers ?? undefined,
    engagementRate: engagementRate ?? undefined,
    categories: creator.categories?.length ? creator.categories : undefined,
    country: creator.country_code ?? creator.estimated_country ?? undefined,
    brandFit: creator.brand_fit_score ?? undefined,
    aiScore: typeof creator.thinkway_score === "number" ? creator.thinkway_score : undefined,
  };
}

function seedFromUnifiedCreators(
  source: CampaignSeed["source"],
  creators: UnifiedCreatorResult[],
  base?: Partial<CampaignSeed>
): CampaignSeed {
  const seedCreators = creators.map(seedCreatorFromUnified);
  const audienceInterests = uniqueStrings(creators.flatMap((c) => c.audience_interests ?? [])).slice(0, 6);
  return {
    source,
    client: base?.client,
    brand: base?.brand,
    platforms: uniqueStrings(creators.flatMap((c) => (c.platforms ?? []).map((p) => p.platform))),
    market: uniqueStrings(creators.map((c) => c.country_code ?? c.estimated_country)),
    categories: uniqueStrings(creators.flatMap((c) => c.categories ?? [])),
    audience: audienceInterests.length ? `Interested in ${audienceInterests.join(", ")}` : undefined,
    creators: seedCreators,
    ...base,
  };
}

export function seedFromShortlist(shortlist: ShortlistDetail): CampaignSeed {
  const creators = (shortlist.creators ?? [])
    .map((item) => item.creator)
    .filter((c): c is UnifiedCreatorResult => Boolean(c));
  return seedFromUnifiedCreators("creator_shortlist", creators, {
    client: shortlist.client_name ?? undefined,
    brand: shortlist.brand_name ?? undefined,
    campaignName: shortlist.name ?? undefined,
  });
}

export function seedFromDiscovery(creators: UnifiedCreatorResult[]): CampaignSeed {
  return seedFromUnifiedCreators("discovery_selection", creators);
}

// ---------------------------------------------------------------------------
// Brief / Manual wizard → seed (explicit fields only)
// ---------------------------------------------------------------------------

export function seedFromManual(fields: Partial<Omit<CampaignSeed, "source" | "creators">> & { creators?: SeedCreator[] }): CampaignSeed {
  return { source: "manual_wizard", creators: fields.creators ?? [], ...fields };
}

export function seedFromBrief(fields: Partial<Omit<CampaignSeed, "source" | "creators">> & { creators?: SeedCreator[] }): CampaignSeed {
  return { source: "campaign_brief", creators: fields.creators ?? [], ...fields };
}

// ---------------------------------------------------------------------------
// CRM Campaign header → seed
// ---------------------------------------------------------------------------

type CampaignWorkspaceSeedInput = {
  name: string;
  brief?: string | null;
  platform?: string | null;
  currency_code?: string;
  client?: { name: string } | null;
  brand?: { name: string } | null;
  group?: { name: string } | null;
  financials?: { budget?: number };
};

/** Normalize an operational campaign header into a hydration seed. */
export function seedFromCampaign(workspace: CampaignWorkspaceSeedInput): CampaignSeed {
  const budget = workspace.financials?.budget;
  return {
    source: "crm_campaign",
    campaignName: workspace.name,
    client: workspace.client?.name,
    brand: workspace.brand?.name,
    group: workspace.group?.name,
    objective: workspace.brief?.trim() || undefined,
    platforms: workspace.platform ? [workspace.platform] : undefined,
    budget:
      budget != null && budget > 0
        ? { amount: budget, currency: workspace.currency_code ?? "USD" }
        : undefined,
    creators: [],
  };
}

```
### Page-specific components

#### `features/campaign-outputs/components/open-campaign-studio-launcher.tsx`

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboardIcon, LayersIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { StudioTab } from "../actions/campaign-workspace-message";
import { startCampaignOutputsFromSeed } from "../actions/generate-outputs-action";
import type { CampaignSeed } from "../hydration/hydration-types";

export type OpenCampaignStudioLauncherProps = {
  seed: CampaignSeed;
  tab?: StudioTab;
  workspace?: { type?: string; id?: string };
  existingConversationId?: string;
  /** Button label — defaults from tab. */
  label?: string;
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md";
  className?: string;
  showIcon?: boolean;
};

const TAB_LABELS: Record<StudioTab, string> = {
  studio: "Open Studio",
  outputs: "Open Outputs",
  director: "Open Director",
};

const TAB_ICONS: Record<StudioTab, typeof LayoutDashboardIcon> = {
  studio: LayoutDashboardIcon,
  outputs: LayersIcon,
  director: SparklesIcon,
};

/**
 * One-click entry into the Campaign Studio workspace from any business context
 * (quotation, shortlist, CRM campaign). Reuses the shared seed → conversation
 * hydration path; never duplicates studio logic.
 */
export function OpenCampaignStudioLauncher({
  seed,
  tab = "studio",
  workspace,
  existingConversationId,
  label,
  variant = "primary",
  size = "sm",
  className,
  showIcon = true,
}: OpenCampaignStudioLauncherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const Icon = TAB_ICONS[tab];
  const displayLabel = label ?? TAB_LABELS[tab];

  const launch = () => {
    startTransition(async () => {
      setError(null);
      const result = await startCampaignOutputsFromSeed({
        seed,
        existingConversationId,
        tab,
        workspace,
      });
      if (result.ok) router.push(result.href);
      else setError(result.message);
    });
  };

  return (
    <div className={cn("inline-flex flex-col items-end gap-0.5", className)}>
      <button
        type="button"
        onClick={launch}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-50",
          size === "sm" ? "h-[30px] rounded-[var(--camp-radius,8px)] px-3 text-[11px]" : "h-9 rounded-lg px-4 text-xs",
          variant === "primary" &&
            "bg-[var(--tw-primary,#1D9E75)] text-white hover:bg-[#178a66]",
          variant === "outline" &&
            "border border-border bg-background text-foreground hover:bg-muted/50",
          variant === "ghost" &&
            "text-foreground hover:bg-muted/50"
        )}
      >
        {pending ? (
          <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
        ) : showIcon ? (
          <Icon className="size-3.5" aria-hidden />
        ) : null}
        {displayLabel}
      </button>
      {error ? <p className="text-[10px] text-red-500">{error}</p> : null}
    </div>
  );
}

```

#### `features/campaign-outputs/hydration/hydration-types.ts`

```ts
/**
 * Smart Hydration — types.
 *
 * Every business object (Quotation, Shortlist, Discovery selection, Brief,
 * existing Campaign, Manual wizard) can become a Campaign Object. A source is
 * first normalized into a `CampaignSeed`; hydration then fills a Campaign Object
 * from the seed WITHOUT overwriting anything already validated, and reports
 * exactly what is still missing. The Campaign Object remains the SSOT; nothing
 * here duplicates campaign data — it maps existing data into the SSOT shape.
 */

export type HydrationSourceKind =
  | "campaign_brief"
  | "creator_shortlist"
  | "quotation"
  | "discovery_selection"
  | "existing_campaign"
  | "crm_campaign"
  | "manual_wizard";

/** One creator as a source knows it — mapped into the slate on hydration. */
export type SeedCreator = {
  creatorId: string;
  displayName: string;
  tier?: string;
  /** Client revenue from quotation / commercial line when known. */
  quotedRevenue?: number;
  quotedCurrency?: string;
  platform?: string;
  handle?: string;
  avatarUrl?: string;
  profileUrl?: string;
  /** Individual quotation ad types (e.g. ["1× IG Reel", "1× Mirrored TT"]). */
  serviceTypes?: string[];
  /** Summary label when multiple types exist (joined for display elsewhere). */
  serviceLabel?: string;
  followers?: number;
  engagementRate?: number;
  categories?: string[];
  country?: string;
  brandFit?: number;
  aiScore?: number;
};

/** Source-agnostic normalized campaign inputs. Only fields the source knows are set. */
export type CampaignSeed = {
  source: HydrationSourceKind;
  campaignName?: string;
  client?: string;
  brand?: string;
  group?: string;
  /** When `agency`, `agencyName` (or `client`) is shown on client-facing outputs. */
  agencyOrDirect?: "agency" | "direct" | "hybrid";
  agencyName?: string;
  budget?: { amount: number; currency: string };
  market?: string[];
  platforms?: string[];
  deliverables?: string[];
  objective?: string;
  audience?: string;
  durationWeeks?: number;
  kpis?: string[];
  categories?: string[];
  creators: SeedCreator[];
};

/** A campaign-input requirement and whether the Campaign Object satisfies it. */
export type HydrationField =
  | "client"
  | "brand"
  | "objective"
  | "audience"
  | "market"
  | "platforms"
  | "budget"
  | "durationWeeks"
  | "creators"
  | "deliverables"
  | "kpis";

export type MissingInformation = {
  known: HydrationField[];
  missing: HydrationField[];
  /** Human labels for the missing fields, e.g. "Campaign objective". */
  missingLabels: string[];
};

export type HydrationResult = {
  campaignObject: import("@/features/campaign-intelligence").CampaignObject;
  /** What the hydration filled vs left untouched (already validated). */
  hydratedFields: HydrationField[];
  preservedFields: HydrationField[];
  missing: MissingInformation;
};

```

#### `features/campaign-outputs/hydration/quotation-service-types.ts`

```ts
/**
 * Parse quotation ad-type labels into individual calendar slots.
 * Handles "1× IG Reel + 1× TT Video" and "1× IG Reel · 1× TT Video" summaries.
 */
export function parseAggregatedServiceLabel(label: string): string[] {
  const normalized = label.trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/\s*(?:\+|·)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [normalized];
}

/** Normalize creator display names for quotation ↔ slate matching. */
export function normalizeCreatorMatchKey(name: string): string {
  const trimmed = name.trim();
  const at = trimmed.indexOf(" (@");
  return (at > 0 ? trimmed.slice(0, at) : trimmed).trim().toLowerCase();
}

```

#### `features/studio/components/studio-campaign-picker.tsx`

```tsx
"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { LayoutDashboardIcon, MegaphoneIcon, MessageSquareIcon, PlusIcon } from "lucide-react";

import { OpenCampaignStudioLauncher } from "@/features/campaign-outputs/components/open-campaign-studio-launcher";
import { seedFromCampaign } from "@/features/campaign-outputs/hydration/seed-adapters";
import { workspaceHref } from "@/features/campaign-outputs/actions/campaign-workspace-message";
import type { StudioPickerCampaign, StudioPickerConversation } from "@/features/studio/queries/list-studio-picker-data";
import { cn } from "@/lib/utils";

type StudioCampaignPickerProps = {
  conversations: StudioPickerConversation[];
  campaigns: StudioPickerCampaign[];
};

function workspaceLabel(type: string): string {
  switch (type) {
    case "quotation":
      return "Quotation";
    case "shortlist":
      return "Shortlist";
    case "campaign":
      return "Campaign";
    case "discovery":
      return "Discovery";
    default:
      return "General";
  }
}

export function StudioCampaignPicker({ conversations, campaigns }: StudioCampaignPickerProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--tw-primary,#1D9E75)]/20 bg-[var(--tw-primary,#1D9E75)]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tw-primary,#1D9E75)]">
          <LayoutDashboardIcon className="size-3.5" aria-hidden />
          Campaign Studio
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Client-facing campaign workspaces
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Open Studio for strategy, outputs, and AI copilot — scoped to your quotation, shortlist, or
          live campaign. Resume a recent workspace or start from a campaign below.
        </p>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">Recent workspaces</h2>
          <Link
            href="/ai"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--tw-primary,#1D9E75)] hover:underline"
          >
            <PlusIcon className="size-3.5" />
            New conversation
          </Link>
        </div>
        {conversations.length ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {conversations.map((item) => (
              <li key={item.id}>
                <Link
                  href={workspaceHref(item.id, "studio")}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <MessageSquareIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {workspaceLabel(item.workspaceType)}
                      {item.isPinned ? " · Pinned" : ""}
                      {" · "}
                      {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-[var(--tw-primary,#1D9E75)]">
                    Open Studio →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No studio workspaces yet. Start from a campaign below or open a{" "}
            <Link href="/discovery/quotations" className="font-medium text-[var(--tw-primary,#1D9E75)] hover:underline">
              quotation
            </Link>
            .
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-foreground">Open from campaign</h2>
          <Link
            href="/campaigns"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all campaigns
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <MegaphoneIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{campaign.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {campaign.documentNumber}
                    {campaign.brandName ? ` · ${campaign.brandName}` : ""}
                    {campaign.clientName ? ` · ${campaign.clientName}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <OpenCampaignStudioLauncher
                  seed={seedFromCampaign({
                    name: campaign.name,
                    client: campaign.clientName ? { name: campaign.clientName } : null,
                    brand: campaign.brandName ? { name: campaign.brandName } : null,
                  })}
                  workspace={{ type: "campaign", id: campaign.id }}
                  tab="studio"
                  variant="primary"
                />
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className={cn(
                    "inline-flex h-[30px] items-center rounded-[var(--camp-radius,8px)] border border-border px-3 text-[11px] font-semibold text-foreground hover:bg-muted/50"
                  )}
                >
                  Campaign workspace
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

```

## Route `/clients/[id]`

Client operational workspace / profile.

**Page file:** `app/(dashboard)/clients/[id]/page.tsx`

**Page-family shared used:** `components/platform/platform-v6-layout.tsx`

### Mock / sample / fallback data

_No dedicated mock/fixture modules for this route._ UI renders with **live Supabase data** (see data loaders below). Empty arrays are used only on error fallbacks in `page.tsx`.

**Data loaders (live; not expanded as UI):**

- `features/client-access/queries.ts`
- `features/client-access/actions.ts`
- `features/brands/actions.ts`
- `features/validation/actions.ts`
- `features/io/actions.ts`
- `features/clients/actions.ts`
- `features/clients/client-document-upload-api.ts`
- `features/clients/onboarding-actions.ts`
- `features/clients/queries.ts`
- `features/io/queries.ts`

### `page.tsx`

#### `app/(dashboard)/clients/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  getAssignableClientProfiles,
  getClientAccessForEntity,
} from "@/features/client-access/queries";
import { ClientProfile } from "@/features/clients/components/client-profile";
import {
  getClientOnboardingPermissions,
  getClientOnboardingTimeline,
} from "@/features/clients/onboarding-queries";
import { getClientById } from "@/features/clients/queries";
import { getClientIoSendRecipients, getClientIosForClient } from "@/features/io/queries";
import { getGroupsForSelect, getMasterDataOptions } from "@/lib/master-data/queries";
import { tryCompleteFinanceOnboarding } from "@/lib/clients/try-complete-finance-onboarding";
import { requireRequestUser } from "@/lib/supabase/server";

type ClientProfilePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientProfilePage({
  params,
}: ClientProfilePageProps) {
  const { id } = await params;

  let client;
  let groups: Awaited<ReturnType<typeof getGroupsForSelect>> = [];
  let masterData: Awaited<ReturnType<typeof getMasterDataOptions>> | null = null;
  let clientIos: Awaited<ReturnType<typeof getClientIosForClient>> = [];
  let clientIoRecipients: Awaited<ReturnType<typeof getClientIoSendRecipients>> = [];
  let clientAccessEntity: Awaited<ReturnType<typeof getClientAccessForEntity>> = null;
  let assignableClientProfiles: Awaited<
    ReturnType<typeof getAssignableClientProfiles>
  > = [];
  let onboardingTimeline: Awaited<ReturnType<typeof getClientOnboardingTimeline>> = [];
  let onboardingPermissions: Awaited<ReturnType<typeof getClientOnboardingPermissions>> = {
    canEditChecklist: false,
    canOverrideStatus: false,
  };
  let errorMessage: string | null = null;

  try {
    client = await getClientById(id);
    if (
      client?.onboarding_status === "finance_pending" &&
      !(client.credit_limit_active ?? false) &&
      client.legal_completed_at
    ) {
      try {
        const { supabase, user } = await requireRequestUser();
        const reconciled = await tryCompleteFinanceOnboarding({
          supabase,
          clientId: id,
          userId: user.id,
        });
        if (reconciled.completed) {
          client = await getClientById(id);
        }
      } catch {
        // Unauthenticated or reconcile skipped — profile still renders with derived badge.
      }
    }
    [
      groups,
      masterData,
      clientIos,
      clientIoRecipients,
      clientAccessEntity,
      assignableClientProfiles,
      onboardingTimeline,
      onboardingPermissions,
    ] = await Promise.all([
      getGroupsForSelect(),
      getMasterDataOptions(),
      getClientIosForClient(id),
      getClientIoSendRecipients(id),
      getClientAccessForEntity(id),
      getAssignableClientProfiles(id),
      getClientOnboardingTimeline(id),
      getClientOnboardingPermissions(),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load client.";
  }

  if (!client && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title={client?.name ?? "Client profile"}
      hidePageHeader
      platformV6
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : client && masterData ? (
        <ClientProfile
          client={client}
          groups={groups}
          masterData={masterData}
          clientIos={clientIos}
          clientIoRecipients={clientIoRecipients}
          clientAccessEntity={clientAccessEntity}
          assignableClientProfiles={assignableClientProfiles}
          onboardingTimeline={onboardingTimeline}
          canEditOnboardingChecklist={onboardingPermissions.canEditChecklist}
          canOverrideOnboardingStatus={onboardingPermissions.canOverrideStatus}
        />
      ) : null}
    </DashboardShell>
  );
}

```
### Page-specific components

#### `features/brands/components/brand-row-actions.tsx`

```tsx
"use client";

import {
  ArchiveIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerIcon,
  PowerOffIcon,
} from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ClientStatusBadge } from "@/features/clients/components/client-status-badge";
import {
  updateBrandStatusAction,
  type FormActionState,
} from "@/features/brands/actions";
import type { BrandTableRow } from "@/features/brands/utils";
import type { ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type BrandRowActionsProps = {
  brand: BrandTableRow;
  onEdit: () => void;
  onArchive: () => void;
  triggerClassName?: string;
};

export function BrandStatusCell({ status }: { status: ClientStatus }) {
  return <ClientStatusBadge status={status} />;
}

export function BrandDeactivateButton({
  brand,
  className,
}: {
  brand: BrandTableRow;
  className?: string;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateBrandStatusAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!statusState.message) return;
    if (statusState.ok) toast.success(statusState.message);
    else toast.error(statusState.message);
  }, [statusState]);

  if (brand.status === "archived" || brand.status === "prospect") {
    return null;
  }

  const nextStatus = brand.status === "active" ? "inactive" : "active";
  const label = brand.status === "active" ? "Deactivate" : "Activate";

  return (
    <form action={statusAction} className={cn("inline-flex", className)}>
      <input type="hidden" name="brand_id" value={brand.id} />
      <input type="hidden" name="client_id" value={brand.client_id} />
      <input type="hidden" name="status" value={nextStatus} />
      <button
        type="submit"
        className="platform-v6-btn platform-v6-btn-sm"
        disabled={statusPending}
      >
        {label}
      </button>
    </form>
  );
}

export function BrandRowActions({
  brand,
  onEdit,
  onArchive,
  triggerClassName,
}: BrandRowActionsProps) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateBrandStatusAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!statusState.message) return;
    if (statusState.ok) toast.success(statusState.message);
    else toast.error(statusState.message);
  }, [statusState]);

  const isArchived = brand.status === "archived";
  const isActive = brand.status === "active";
  const canArchive = !isArchived && brand.active_campaigns === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {triggerClassName ? (
          <button
            type="button"
            className={triggerClassName}
            aria-label={`Actions for ${brand.name}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={`Actions for ${brand.name}`}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon className="size-4" />
          Edit brand
        </DropdownMenuItem>

        {!isArchived ? (
          <>
            <DropdownMenuSeparator />
            {isActive ? (
              <DropdownMenuItem asChild disabled={statusPending}>
                <form action={statusAction} className="w-full">
                  <input type="hidden" name="brand_id" value={brand.id} />
                  <input type="hidden" name="client_id" value={brand.client_id} />
                  <input type="hidden" name="status" value="inactive" />
                  <button type="submit" className="flex w-full items-center gap-2">
                    <PowerOffIcon className="size-4" />
                    Set inactive
                  </button>
                </form>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild disabled={statusPending}>
                <form action={statusAction} className="w-full">
                  <input type="hidden" name="brand_id" value={brand.id} />
                  <input type="hidden" name="client_id" value={brand.client_id} />
                  <input type="hidden" name="status" value="active" />
                  <button type="submit" className="flex w-full items-center gap-2">
                    <PowerIcon className="size-4" />
                    Set active
                  </button>
                </form>
              </DropdownMenuItem>
            )}
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={!canArchive}
          onClick={onArchive}
        >
          <ArchiveIcon className="size-4" />
          {brand.active_campaigns > 0
            ? "Archive blocked (campaigns)"
            : "Archive brand"}
        </DropdownMenuItem>
        {isArchived ? (
          <DropdownMenuItem onClick={onEdit}>
            <PowerIcon className="size-4" />
            Restore via edit
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BrandStatusToggle({
  brand,
}: {
  brand: BrandTableRow;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateBrandStatusAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!statusState.message) return;
    if (statusState.ok) toast.success(statusState.message);
    else toast.error(statusState.message);
  }, [statusState]);

  if (brand.status === "archived" || brand.status === "prospect") {
    return <BrandStatusCell status={brand.status} />;
  }

  const nextStatus = brand.status === "active" ? "inactive" : "active";

  return (
    <form action={statusAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="brand_id" value={brand.id} />
      <input type="hidden" name="client_id" value={brand.client_id} />
      <input type="hidden" name="status" value={nextStatus} />
      <BrandStatusCell status={brand.status} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={statusPending}
        className="h-7 px-2 text-xs"
      >
        {brand.status === "active" ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}

```

#### `features/brands/components/client-add-brand-dialog.tsx`

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBrandAction, type FormActionState } from "@/features/brands/actions";
import {
  CLIENT_FORM_FIELD_LABEL_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  ClientProfileTabSaveButton,
} from "@/features/clients/components/client-form-ui";
import { checkBrandNameAvailable } from "@/features/validation/actions";
import { brandVrInheritanceHint } from "@/lib/clients/vr-inheritance";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientDetail } from "@/types/database";

type ClientAddBrandDialogProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId?: string;
};

export function ClientAddBrandDialog({
  client,
  masterData,
  open,
  onOpenChange,
  formId = "client-add-brand-form",
}: ClientAddBrandDialogProps) {
  const router = useRouter();
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const clientVrRateId = client.vr_rate_id ?? null;

  const [brandName, setBrandName] = useState("");
  const [vrRateId, setVrRateId] = useState(clientVrRateId ?? "");
  const [currency, setCurrency] = useState(DEFAULT_PLATFORM_CURRENCY);

  const brandHasOverride = Boolean(vrRateId) && vrRateId !== (clientVrRateId ?? "");
  const vrHint = brandVrInheritanceHint(client.vr_rate_percent, brandHasOverride);

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    brandName,
    checkBrandNameAvailable,
    [client.id],
    open
  );

  const [state, formAction, isPending] = useActionState(createBrandAction, {
    ok: false,
  } satisfies FormActionState);

  const resetForm = () => {
    setBrandName("");
    setVrRateId(clientVrRateId ?? "");
    setCurrency(DEFAULT_PLATFORM_CURRENCY);
  };

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      resetForm();
      onOpenChange(false);
      router.refresh();
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange, router]);

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, client.id, clientVrRateId]);

  const submitDisabled = isPending || isDuplicate || checking;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add new brand</DialogTitle>
          <DialogDescription>
            Commercial brand profile for {client.name}. VR% inherits from the legal entity
            overview unless overridden.
          </DialogDescription>
        </DialogHeader>
        {!state.ok && state.message ? (
          <p className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {state.message}
          </p>
        ) : null}
        <form id={formId} action={formAction} className="grid gap-4">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="vr_rate_id" value={vrRateId} />
          <input type="hidden" name="currency_code" value={currency} />

          <div className="grid gap-2">
            <Label htmlFor="client_add_brand_name" className={CLIENT_FORM_FIELD_LABEL_CLASS}>
              Brand name
            </Label>
            <Input
              id="client_add_brand_name"
              name="name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className={CLIENT_FORM_INPUT_CLASS}
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.name} />
            {duplicateMessage ? (
              <p className="text-xs text-destructive">{duplicateMessage}</p>
            ) : checking ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className={CLIENT_FORM_FIELD_LABEL_CLASS}>VR%</Label>
              <SearchableSelect
                value={vrRateId}
                onValueChange={setVrRateId}
                options={masterData.vrRates.map((v) => ({
                  value: v.id,
                  label: v.name,
                }))}
                disabled={isPending}
                placeholder="Select VR rate"
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <p className="text-[11.5px] leading-relaxed text-[#9099A8]">{vrHint}</p>
            </div>
            <div className="grid gap-2">
              <Label className={CLIENT_FORM_FIELD_LABEL_CLASS}>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className={CLIENT_FORM_SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <ClientProfileTabSaveButton
              formId={formId}
              label="Create brand"
              pendingLabel="Creating…"
              isPending={isPending}
              disabled={submitDisabled}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

```

#### `features/campaigns/components/assignment-hierarchy/operational-table-typography.ts`

```ts
import { cn } from "@/lib/utils";

/** Assignment operational grid — matches reference: light sans, tabular numbers, no mono. */
export const OPERATIONAL_TABLE_FONT = "font-sans";

/** Data sheet surface (token-based for light/dark). */
export const OPERATIONAL_TABLE_SURFACE = "bg-card";

/** Scoped CSS in `.thinkway-campaign-workspace` owns header strip styling. */
export const OPERATIONAL_TABLE_HEADER_SURFACE = "";

export const OPERATIONAL_TABLE_HEADER_ROW = "";

export const OPERATIONAL_TABLE_HEADER_CELL = "";

export const OPERATIONAL_AMOUNT_TABULAR =
  "text-[11px] tabular-nums tracking-normal";

/** Default money cells — neutral foreground. */
export const OPERATIONAL_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/90"
);

/** Child money cells match parent row exactly. */
export const OPERATIONAL_CHILD_AMOUNT_CLASS = OPERATIONAL_AMOUNT_CLASS;

/** Billable revenue — login blue primary. */
export const OPERATIONAL_REVENUE_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-medium text-primary"
);

/** Cost columns — subdued foreground. */
export const OPERATIONAL_COST_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/80"
);

export type OperationalAmountVariant =
  | "default"
  | "revenue"
  | "cost"
  | "gp"
  | "margin"
  | "muted";

export function operationalGpAmountClass(value: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    "font-medium",
    value > 0 && "text-brand-product",
    value < 0 && "text-destructive",
    value === 0 && "text-foreground/90"
  );
}

export function operationalMarginAmountClass(percent: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    percent < 15 ? "text-warning" : "text-muted-foreground"
  );
}

export function operationalAmountVariantClass(
  variant: OperationalAmountVariant,
  value?: number
): string {
  switch (variant) {
    case "revenue":
      return OPERATIONAL_REVENUE_AMOUNT_CLASS;
    case "cost":
      return OPERATIONAL_COST_AMOUNT_CLASS;
    case "gp":
      return operationalGpAmountClass(value ?? 0);
    case "margin":
      return operationalMarginAmountClass(value ?? 0);
    case "muted":
      return cn(OPERATIONAL_AMOUNT_TABULAR, "text-muted-foreground");
    default:
      return OPERATIONAL_AMOUNT_CLASS;
  }
}

export type OperationalKpiValueSemantic =
  | "revenue"
  | "gp"
  | "cost"
  | "margin"
  | "count";

export function operationalKpiValueClass(
  semantic: OperationalKpiValueSemantic | undefined,
  value?: number
): string | undefined {
  if (!semantic) return undefined;
  switch (semantic) {
    case "revenue":
      return "text-primary";
    case "cost":
      return "text-foreground/80";
    case "gp":
      if (value == null) return "text-brand-product";
      if (value < 0) return "text-destructive";
      if (value > 0) return "text-brand-product";
      return undefined;
    case "margin":
      if (value != null && value < 15) return "text-warning";
      return "text-muted-foreground";
    case "count":
      return "text-foreground";
    default:
      return undefined;
  }
}

/** Campaign workspace chrome — sans family; sizes match pre-operational header scale. */
export const OPERATIONAL_CHROME_TITLE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
);

export const OPERATIONAL_CHROME_META = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal text-muted-foreground"
);

export const OPERATIONAL_CHROME_LABEL = OPERATIONAL_CHROME_META;

/** Status / IO badges in workspace header (default badge scale). */
export const OPERATIONAL_CHROME_STATUS_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xs font-medium"
);

export const OPERATIONAL_CHROME_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal"
);

```

#### `features/campaigns/components/operational-detail-panel.tsx`

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { APP_MAIN_HALF_PANEL_WIDTH } from "@/lib/layout/app-sidebar-width";
import { initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";
import { cn } from "@/lib/utils";

export const OPERATIONAL_DETAIL_SHEET_STYLE: CSSProperties = {
  width: APP_MAIN_HALF_PANEL_WIDTH,
  maxWidth: APP_MAIN_HALF_PANEL_WIDTH,
};

export const OPERATIONAL_DETAIL_SHEET_CLASS = cn(
  "flex flex-col gap-0 overflow-hidden border-y border-l border-border/60 bg-card p-0",
  "transition-[width,max-width] duration-200 ease-out",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none rounded-l-[1.75rem] rounded-r-none shadow-[-12px_0_40px_-8px_rgba(0,0,0,0.12)]"
);

type OperationalDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function OperationalDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: OperationalDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        showCloseButton
        showOverlay={false}
        style={OPERATIONAL_DETAIL_SHEET_STYLE}
        className={OPERATIONAL_DETAIL_SHEET_CLASS}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {description ? (
          <SheetDescription className="sr-only">{description}</SheetDescription>
        ) : null}
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function DetailField({
  label,
  children,
  valueClassName,
  onLabelClick,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
  /** Navigate to a workspace tab or section when the label is clicked. */
  onLabelClick?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/40 py-3.5 last:border-b-0">
      {onLabelClick ? (
        <button
          type="button"
          onClick={onLabelClick}
          className={cn(
            DETAIL_FIELD_LABEL_CLASS,
            "text-left transition-colors hover:text-primary hover:underline"
          )}
        >
          {label}
        </button>
      ) : (
        <span className={DETAIL_FIELD_LABEL_CLASS}>{label}</span>
      )}
      <div className={cn("min-w-0 text-right text-sm text-foreground", valueClassName)}>
        {children}
      </div>
    </div>
  );
}

export function DetailPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

export function TeamMemberValue({
  name,
  email,
}: {
  name: string | null | undefined;
  email?: string | null;
}) {
  const display = name?.trim() || email?.trim() || "—";
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {initialsFromName(display)}
      </span>
      <span>{display}</span>
    </span>
  );
}

export function ClientApprovalPill({ status }: { status: string | null }) {
  const normalized = (status ?? "draft").toLowerCase();
  if (normalized === "approved") {
    return (
      <DetailPill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
        Accepted ✓
      </DetailPill>
    );
  }
  if (normalized === "sent") {
    return (
      <DetailPill className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
        Pending approval
      </DetailPill>
    );
  }
  if (normalized === "rejected") {
    return (
      <DetailPill className="border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200">
        Rejected
      </DetailPill>
    );
  }
  if (normalized === "cancelled") {
    return (
      <DetailPill className="border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200">
        Cancelled
      </DetailPill>
    );
  }
  return <DetailPill>Draft</DetailPill>;
}

export function DetailTabList({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-b border-border/60 px-6">{children}</div>
  );
}

export const DETAIL_TAB_TRIGGER_CLASS =
  "rounded-none px-0 pb-3 pt-4 text-xs data-[state=active]:font-semibold";

export const DETAIL_FIELD_LABEL_CLASS =
  "shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

/** Compact inputs aligned with operational detail field rows. */
export const DETAIL_FIELD_INPUT_CLASS =
  "h-8 w-full border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

export const DETAIL_FIELD_SELECT_TRIGGER_CLASS = cn(
  DETAIL_FIELD_INPUT_CLASS,
  "text-left data-[size=default]:h-8"
);

/** Edit row — same rhythm as DetailField, with a control on the right. */
export function DetailEditField({
  label,
  children,
  valueClassName,
  align = "end",
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
  align?: "start" | "end";
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/40 py-3.5 last:border-b-0">
      <span className={DETAIL_FIELD_LABEL_CLASS}>{label}</span>
      <div
        className={cn(
          "min-w-0 w-full max-w-[min(100%,18rem)] flex-1",
          align === "end" ? "text-right" : "text-left",
          valueClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Multiline edit block inside detail panels. */
export function DetailEditBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/40 py-3.5 last:border-b-0">
      <p className={DETAIL_FIELD_LABEL_CLASS}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function DetailSheetFooter({
  hint,
  children,
}: {
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="shrink-0 border-t border-border/60 px-6 py-4">
      {hint ? (
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/** Full-width form controls inside operational edit drawers. */
export const DETAIL_FORM_INPUT_CLASS =
  "h-9 w-full border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

export const DETAIL_FORM_SELECT_TRIGGER_CLASS = cn(DETAIL_FORM_INPUT_CLASS, "text-left");

/** Portaled select menus must stack above operational sheets (z-[100]). */
export const DETAIL_SHEET_SELECT_CONTENT_PROPS = {
  position: "popper" as const,
  className: "z-[110]",
};

export function OperationalEditPanelHeader({
  title,
  description,
  badges,
}: {
  title: ReactNode;
  description?: string;
  badges?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-border/60 px-6 pb-4 pt-5">
      <div className="pr-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {badges ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>
        ) : null}
      </div>
    </div>
  );
}

export function DetailFormScrollBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className)}>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** Section label rhythm matching read-only DetailField rows. */
export function DetailFormSection({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className={DETAIL_FIELD_LABEL_CLASS}>{label}</p>
      {children}
      {hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function DetailPanelHeader({
  breadcrumb,
  actions,
  avatarInitials,
  avatarUrl,
  avatarPlatform,
  avatarUsername,
  profileUrl,
  profileTooltip,
  title,
  subtitle,
  badges,
}: {
  breadcrumb: ReactNode;
  actions?: ReactNode;
  avatarInitials: string;
  avatarUrl?: string | null;
  avatarPlatform?: string | null;
  avatarUsername?: string | null;
  profileUrl?: string | null;
  profileTooltip?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
}) {
  const avatarNode = avatarUrl?.trim() ? (
    <CreatorAvatarImage avatarUrl={avatarUrl} size="lg" sizeClassName="size-14" />
  ) : (
    <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/40 text-base font-semibold text-foreground">
      {avatarInitials}
    </span>
  );

  return (
    <div className="shrink-0 border-b border-border/60 px-6 pb-4 pt-5">
      <div className="flex items-start justify-between gap-3 pr-10">
        <p className="text-xs text-muted-foreground">{breadcrumb}</p>
        {actions}
      </div>
      <div className="mt-4 flex items-center gap-3">
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={profileTooltip ?? "Open social profile"}
            title={profileTooltip ?? "Open social profile"}
            className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {avatarNode}
          </a>
        ) : (
          avatarNode
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle}
          </div>
          {badges ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{badges}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

```

#### `features/client-access/components/assign-client-user-sheet.tsx`

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { assignClientUserAction } from "@/features/client-access/actions";
import { CLIENT_ACCESS_ROLES } from "@/features/client-access/constants";
import type { AssignableClientProfileRow } from "@/features/client-access/types";

const INITIAL = { ok: false } as const;

type Props = {
  clientId: string;
  clientName: string;
  assignable: AssignableClientProfileRow[];
};

export function AssignClientUserSheet({ clientId, clientName, assignable }: Props) {
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [accessRole, setAccessRole] = useState("view");
  const [isPrimary, setIsPrimary] = useState(false);
  const [state, action, pending] = useActionState(assignClientUserAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      setOpen(false);
      setProfileId("");
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" disabled={assignable.length === 0}>
          Assign user
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Assign client user</SheetTitle>
          <p className="text-sm text-muted-foreground">{clientName}</p>
        </SheetHeader>
        <form action={action} className="mt-4 grid gap-4">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="access_role" value={accessRole} />
          {isPrimary ? <input type="hidden" name="is_primary" value="on" /> : null}

          <div className="grid gap-2">
            <Label>User</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client portal user" />
              </SelectTrigger>
              <SelectContent>
                {assignable.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name ?? profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Role</Label>
            <Select value={accessRole} onValueChange={setAccessRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_ACCESS_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="size-4 rounded border"
            />
            <Label htmlFor="is_primary">Primary contact</Label>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !profileId}>
              {pending ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

```

#### `features/client-access/components/client-access-role-select.tsx`

```tsx
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateClientAccessRoleAction } from "@/features/client-access/actions";
import { CLIENT_ACCESS_ROLES } from "@/features/client-access/constants";
import type { ClientAccessRole } from "@/features/client-access/types";

const INITIAL = { ok: false } as const;

type Props = {
  clientId: string;
  profileId: string;
  currentRole: ClientAccessRole;
};

export function ClientAccessRoleSelect({ clientId, profileId, currentRole }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState(currentRole);
  const [state, action, pending] = useActionState(updateClientAccessRoleAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="profile_id" value={profileId} />
      <input type="hidden" name="access_role" value={role} />
      <Select
        value={role}
        onValueChange={(value) => {
          setRole(value as ClientAccessRole);
          requestAnimationFrame(() => formRef.current?.requestSubmit());
        }}
        disabled={pending}
      >
        <SelectTrigger className="h-8 w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CLIENT_ACCESS_ROLES.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}

```

#### `features/client-access/components/client-access-workspace.tsx`

```tsx
"use client";



import { useActionState, useEffect, useMemo } from "react";

import { toast } from "sonner";



import {

  OperationalConfigurableTable,

  type OperationalConfigurableColumnDef,

  getOperationalTableColumnMetas,

} from "@/components/tables/operational-configurable-table";

import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CLIENT_ACCESS_USERS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import { DocumentNumber } from "@/components/ui/document-number";

import {

  removeClientUserAction,

  setPrimaryClientUserAction,

} from "@/features/client-access/actions";

import { AssignClientUserSheet } from "@/features/client-access/components/assign-client-user-sheet";

import { ClientAccessRoleSelect } from "@/features/client-access/components/client-access-role-select";

import type {

  AssignableClientProfileRow,

  ClientAccessEntityRow,

} from "@/features/client-access/types";

import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";



const INITIAL = { ok: false } as const;



type ClientAccessUserRow = ClientAccessEntityRow["users"][number];



function buildClientAccessColumns({

  clientId,

  removeAction,

  removePending,

  primaryAction,

  primaryPending,

}: {

  clientId: string;

  removeAction: (payload: FormData) => void;

  removePending: boolean;

  primaryAction: (payload: FormData) => void;

  primaryPending: boolean;

}): OperationalConfigurableColumnDef<ClientAccessUserRow>[] {

  return [

    {

      id: "user",

      label: "User",

      cellClassName: "font-medium",

      renderCell: (user) => user.full_name ?? "—",

    },

    {

      id: "email",

      label: "Email",

      renderCell: (user) => user.email,

    },

    {

      id: "role",

      label: "Role",

      renderCell: (user) => (

        <ClientAccessRoleSelect

          clientId={clientId}

          profileId={user.profile_id}

          currentRole={user.access_role}

        />

      ),

    },

    {

      id: "primary",

      label: "Primary",

      renderCell: (user) =>

        user.is_primary ? (

          <Badge variant="secondary">Primary</Badge>

        ) : (

          <form action={primaryAction}>

            <input type="hidden" name="client_id" value={clientId} />

            <input type="hidden" name="profile_id" value={user.profile_id} />

            <Button type="submit" variant="ghost" size="sm" disabled={primaryPending}>

              Set primary

            </Button>

          </form>

        ),

    },

    {

      id: "actions",

      label: "Actions",

      locked: true,

      headerClassName: "text-right",

      cellClassName: "text-right",

      renderCell: (user) => (

        <form action={removeAction}>

          <input type="hidden" name="client_id" value={clientId} />

          <input type="hidden" name="profile_id" value={user.profile_id} />

          <Button type="submit" variant="outline" size="sm" disabled={removePending}>

            Remove

          </Button>

        </form>

      ),

    },

  ];

}



export const CLIENT_ACCESS_USERS_COLUMN_METAS = getOperationalTableColumnMetas(

  buildClientAccessColumns({

    clientId: "",

    removeAction: () => {},

    removePending: false,

    primaryAction: () => {},

    primaryPending: false,

  })

);



type Props = {

  entity: ClientAccessEntityRow;

  assignable: AssignableClientProfileRow[];

  compact?: boolean;

};



export function ClientAccessWorkspace({ entity, assignable, compact }: Props) {

  const [removeState, removeAction, removePending] = useActionState(

    removeClientUserAction,

    INITIAL

  );

  const [primaryState, primaryAction, primaryPending] = useActionState(

    setPrimaryClientUserAction,

    INITIAL

  );



  useEffect(() => {

    if (removeState.message) {

      if (removeState.ok) toast.success(removeState.message);

      else toast.error(removeState.message);

    }

  }, [removeState]);



  useEffect(() => {

    if (primaryState.message) {

      if (primaryState.ok) toast.success(primaryState.message);

      else toast.error(primaryState.message);

    }

  }, [primaryState]);



  const columns = useMemo(

    () =>

      buildClientAccessColumns({

        clientId: entity.client_id,

        removeAction,

        removePending,

        primaryAction,

        primaryPending,

      }),

    [entity.client_id, removeAction, removePending, primaryAction, primaryPending]

  );



  return (

    <OperationalTableSuiteProvider

      tableId={OPERATIONAL_TABLE_IDS.settingsClientAccessUsers}

      columns={columns}

      rows={entity.users}

      filterAccessors={CLIENT_ACCESS_USERS_FILTER_ACCESSORS}

    >

      <div className="space-y-4">

        {!compact ? (

          <div className="flex flex-wrap items-center justify-between gap-3">

            <div>

              <h3 className="font-heading text-lg font-semibold">{entity.client_name}</h3>

              <p className="text-sm text-muted-foreground">

                <DocumentNumber value={entity.document_number} />

              </p>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <OperationalTableControlsSlot contextLabel="Client access users" />

              <AssignClientUserSheet

                clientId={entity.client_id}

                clientName={entity.client_name}

                assignable={assignable}

              />

            </div>

          </div>

        ) : (

          <div className="flex flex-wrap items-center justify-end gap-2">

            <OperationalTableControlsSlot contextLabel="Client access users" />

            <AssignClientUserSheet

              clientId={entity.client_id}

              clientName={entity.client_name}

              assignable={assignable}

            />

          </div>

        )}



        {entity.users.length === 0 ? (

          <p className="px-4 py-8 text-[11px] text-muted-foreground">

            No client portal users assigned to this legal entity.

          </p>

        ) : (

          <OperationalConfigurableTable

            columns={columns}

            rows={entity.users}

            rowKey={(user) => user.profile_id}

          />

        )}

      </div>

    </OperationalTableSuiteProvider>

  );

}



```

#### `features/client-access/constants.ts`

```ts
export const CLIENT_ACCESS_REVALIDATE_PATHS = [
  "/settings/client-access",
  "/clients",
] as const;

export const CLIENT_ACCESS_ROLES = [
  { value: "view", label: "View" },
  { value: "approve", label: "Approve" },
] as const;

```

#### `features/clients/components/client-form-ui.tsx`

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { SaveIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

import { PlatformV6PageSectionHeader, PlatformV6WideFormBlock } from "@/components/platform/platform-v6-layout";
import { Label } from "@/components/ui/label";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { cn } from "@/lib/utils";

const ClientProfilePlatformContext = createContext(false);

export function ClientProfilePlatformProvider({
  platformV6,
  children,
}: {
  platformV6?: boolean;
  children: ReactNode;
}) {
  return (
    <ClientProfilePlatformContext.Provider value={Boolean(platformV6)}>
      {children}
    </ClientProfilePlatformContext.Provider>
  );
}

export function useClientProfilePlatformV6() {
  return useContext(ClientProfilePlatformContext);
}

/** Marks a form as the Ctrl+S / Cmd+S save target (see KeyboardShortcutsProvider). */
export const CLIENT_FORM_SHORTCUT_SAVE_ATTR = "data-shortcut-save";

/**
 * Footer hint for client profile tab forms that register `useClientFormSaveShortcut`.
 *
 * Wired forms (when their tab is active):
 * - Overview: `#client-overview-form`
 * - Brands: add-brand dialog (`#client-add-brand-form` when open)
 * - Legal: `#client-legal-form`
 * - Finance: `#client-finance-form`
 */
export const CLIENT_FORM_SAVE_SHORTCUT_HINT = "Ctrl+S to save";

/** Registers Ctrl+S / Cmd+S to submit a form when `enabled` (e.g. active tab or open dialog). */
export function useClientFormSaveShortcut({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useRegisterShortcut(
    enabled
      ? {
          id: `client-form-save-${formId}`,
          keys: "ctrl+s",
          label: "Save form",
          group: "Forms",
          global: true,
          handler: () => {
            if (disabled) return;
            const form = document.getElementById(formId);
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          },
        }
      : null
  );
}

export function ClientFormKeyboardShortcuts({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useClientFormSaveShortcut({ formId, enabled, disabled });
  return null;
}

/** Form controls — Thinkway client form reference (Form_4: blue brand, neutral surfaces). */
export const CLIENT_FORM_MAX_WIDTH = "max-w-[880px]";

export const CLIENT_FORM_INPUT_CLASS = cn(
  "h-auto min-h-9 w-full rounded-[10px] border-border bg-muted px-[13px] py-[11px] text-[13.5px] text-foreground shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-primary focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-primary/20"
);

export const CLIENT_FORM_SELECT_TRIGGER_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "justify-between text-left font-normal"
);

export const CLIENT_FORM_TEXTAREA_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "min-h-[90px] resize-y leading-relaxed"
);

export const CLIENT_FORM_FIELD_LABEL_CLASS =
  "text-[12.5px] font-semibold text-foreground";

export const CLIENT_FORM_FIELD_HINT_CLASS =
  "text-[11.5px] leading-relaxed text-muted-foreground";

export const CLIENT_FORM_PRIMARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent px-4 py-2.5",
  "bg-[linear-gradient(135deg,#0057FF_0%,#2E74FF_55%,#1A6FFF_100%)]",
  "text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,87,255,0.3)]",
  "transition-[transform,box-shadow] active:scale-[0.97]",
  "hover:shadow-[0_6px_20px_rgba(0,87,255,0.42)]",
  "disabled:pointer-events-none disabled:opacity-50"
);

/** Form_4 primary submit for client profile tabs (Brands, Legal, Finance). */
export function ClientProfileTabSaveButton({
  formId,
  label,
  pendingLabel = "Saving…",
  isPending = false,
  disabled = false,
  showSaveIcon = true,
}: {
  formId: string;
  label: string;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  showSaveIcon?: boolean;
}) {
  return (
    <button
      type="submit"
      form={formId}
      className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
      disabled={disabled || isPending}
    >
      {showSaveIcon ? (
        <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
      ) : null}
      {isPending ? pendingLabel : label}
    </button>
  );
}

export const CLIENT_FORM_SECONDARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5",
  "text-xs font-semibold text-foreground transition-[border-color,background-color,transform]",
  "hover:border-border/80 active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export const CLIENT_FORM_GHOST_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-transparent px-4 py-2.5",
  "text-[13px] font-semibold text-muted-foreground transition-colors",
  "hover:bg-muted hover:text-foreground active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export function ClientFormPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.035em] text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-[5px] text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

export type ClientFormBreadcrumb = {
  label: string;
  href?: string;
};

/** Top bar — Form_4 breadcrumbs + Cancel / Save actions. */
export function ClientFormTopbar({
  breadcrumbs,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
}: {
  breadcrumbs: ClientFormBreadcrumb[];
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
}) {
  return (
    <div className="z-15 flex h-[62px] shrink-0 items-center gap-4 border-b border-border bg-background/70 px-[26px] backdrop-blur-md">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13.5px]">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-muted-foreground opacity-50" aria-hidden>
                  /
                </span>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {onCancel ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onCancel}
            disabled={saveDisabled}
          >
            Cancel
          </button>
        ) : null}
        {saveFormId ? (
          <button
            type="submit"
            form={saveFormId}
            className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
            disabled={saveDisabled}
          >
            <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
            {isSaving ? "Saving…" : saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Scrollable form body + pinned footer (Form_4 save bar pattern). */
export function ClientFormLayout({
  children,
  footer,
  topbar,
}: {
  children: ReactNode;
  footer?: ReactNode;
  topbar?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar}
      <div className="h-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {children}
      </div>
      {footer}
    </div>
  );
}

export const CLIENT_FORM_SCROLL_PADDING_CLASS = "px-[26px] pt-7 pb-[120px]";

export function ClientFormSection({
  icon: Icon,
  title,
  description,
  children,
  className,
  iconClassName,
  toolbar,
  bodyClassName,
  footer,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  toolbar?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  /** Tighter padding for dialogs and constrained viewports. */
  compact?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <PlatformV6WideFormBlock
        icon={Icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
        toolbar={toolbar}
        bodyClassName={bodyClassName}
        footer={footer}
        className={className}
      >
        {children}
      </PlatformV6WideFormBlock>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]",
        compact ? "overflow-visible" : "overflow-hidden",
        className
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 border-b border-border",
          compact ? "px-4 py-3" : "px-[22px] py-[18px]"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary",
            compact ? "size-8" : "size-[34px]"
          )}
        >
          <Icon
            className={compact ? "size-4" : "size-[18px]"}
            strokeWidth={1.8}
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-bold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-px text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div
        className={cn(
          compact ? "space-y-3.5 p-4" : "space-y-[18px] p-[22px]",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function ClientFormGrid({
  children,
  className,
  columns,
}: {
  children: ReactNode;
  className?: string;
  /** Override column layout when platform v6 is active. */
  columns?: 3 | 4;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const v6GridClass =
    columns === 4 ? "platform-v6-form-grid-4" : "platform-v6-form-grid";

  return (
    <div
      className={cn(
        platformV6
          ? v6GridClass
          : "grid gap-[18px] sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ClientFormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const platformV6 = useClientProfilePlatformV6();

  return (
    <div className={cn("grid gap-[7px]", className)}>
      <Label
        htmlFor={htmlFor}
        className={
          platformV6 ? "platform-v6-field-label" : CLIENT_FORM_FIELD_LABEL_CLASS
        }
      >
        {label}
      </Label>
      {children}
      {hint ? (
        typeof hint === "string" ? (
          <p
            className={
              platformV6 ? "platform-v6-field-hint" : CLIENT_FORM_FIELD_HINT_CLASS
            }
          >
            {hint}
          </p>
        ) : (
          hint
        )
      ) : null}
    </div>
  );
}

export function ClientFormSaveBar({
  children,
  status,
  onDiscard,
  discardLabel = "Discard",
  discardDisabled,
}: {
  children: ReactNode;
  status?: ReactNode;
  onDiscard?: () => void;
  discardLabel?: string;
  discardDisabled?: boolean;
}) {
  return (
    <div className="z-10 flex shrink-0 flex-wrap items-center gap-3.5 border-t border-border bg-background/90 px-[26px] py-3.5 backdrop-blur-[14px]">
      {status ? (
        <div className="flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
          {status}
        </div>
      ) : null}
      <div className="ml-auto flex flex-wrap gap-2.5">
        {onDiscard ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onDiscard}
            disabled={discardDisabled}
          >
            {discardLabel}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function ClientFormUnsavedStatus() {
  return (
    <>
      <span
        className="size-[7px] shrink-0 rounded-full bg-amber-600 shadow-[0_0_6px_#C2740B]"
        aria-hidden
      />
      Unsaved changes
    </>
  );
}

export const CLIENT_PROFILE_BREADCRUMBS: ClientFormBreadcrumb[] = [
  { label: "Clients", href: "/clients" },
  { label: "Legal Entities", href: "/clients" },
  { label: "Edit" },
];

/** Shared Form_4 shell for client profile tabs (topbar, scroll body, optional dirty footer). */
export function ClientProfileTabShell({
  title,
  description,
  children,
  beforeHeader,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
  isDirty,
  onDiscard,
  discardDisabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Renders above the page title (e.g. onboarding progress strip). */
  beforeHeader?: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-epanel-inner">
        {beforeHeader}
        <PlatformV6PageSectionHeader title={title} description={description} />
        {children}
      </div>
    );
  }

  return (
    <ClientFormLayout
      topbar={
        <ClientFormTopbar
          breadcrumbs={CLIENT_PROFILE_BREADCRUMBS}
          onCancel={onCancel}
          saveFormId={saveFormId}
          saveLabel={saveLabel}
          saveDisabled={saveDisabled}
          isSaving={isSaving}
        />
      }
      footer={
        isDirty ? (
          <ClientFormSaveBar
            status={<ClientFormUnsavedStatus />}
            onDiscard={onDiscard}
            discardDisabled={discardDisabled}
          >
            {saveFormId ? (
              <button
                type="submit"
                form={saveFormId}
                className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
                disabled={saveDisabled}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            ) : null}
          </ClientFormSaveBar>
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          CLIENT_FORM_MAX_WIDTH,
          CLIENT_FORM_SCROLL_PADDING_CLASS
        )}
      >
        <ClientFormPageHeader title={title} description={description} />
        {children}
      </div>
    </ClientFormLayout>
  );
}

```

#### `features/clients/components/client-inline-document-attach.tsx`

```tsx
"use client";

import {
  EyeIcon,
  FileCheck2Icon,
  Loader2Icon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteClientDocumentAction,
  getClientDocumentDownloadUrlAction,
} from "@/features/clients/actions";
import { uploadClientDocumentViaApi } from "@/features/clients/client-document-upload-api";
import type { ClientDetail } from "@/types/database";
import {
  friendlyServerActionError,
  isServerActionDecodeError,
} from "@/lib/clients/client-document-utils";
import { cn } from "@/lib/utils";

/** File inputs use this id so they are not associated with profile tab save forms. */
export const CLIENT_INLINE_DOCUMENT_FILE_FORM_ID =
  "client-inline-document-file-form";

type ClientDocumentType = ClientDetail["documents"][number]["document_type"];
type ClientDocument = ClientDetail["documents"][number];

type ClientInlineDocumentAttachProps = {
  clientId: string;
  documentType: ClientDocumentType;
  document?: ClientDocument | null;
  className?: string;
};

export function findClientDocumentByType(
  documents: ClientDetail["documents"],
  documentType: ClientDocumentType
) {
  return documents.find((doc) => doc.document_type === documentType) ?? null;
}

export function ClientInlineDocumentAttach({
  clientId,
  documentType,
  document,
  className,
}: ClientInlineDocumentAttachProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localDocument, setLocalDocument] = useState(document ?? null);
  const [previousDocument, setPreviousDocument] = useState(document);
  const [isDownloading, startDownload] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  if (document !== previousDocument) {
    setPreviousDocument(document);
    setLocalDocument(document ?? null);
  }

  const busy = isUploading || isDeleting || isDownloading;

  function refreshClientProfileSafely() {
    try {
      router.refresh();
    } catch {
      toast.error("Document saved, but the page could not refresh. Reload if needed.");
    }
  }

  function openFilePicker() {
    if (!busy) {
      fileInputRef.current?.click();
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.stopPropagation();

    const formData = new FormData();
    formData.set("client_id", clientId);
    formData.set("document_type", documentType);
    formData.set("file", file);

    startUpload(async () => {
      try {
        const result = await uploadClientDocumentViaApi(clientId, formData);
        if (result.ok) {
          toast.success(result.message ?? "Document uploaded.");
          refreshClientProfileSafely();
          return;
        }
        toast.error(result.message ?? "Upload failed.");
      } catch (error) {
        toast.error(friendlyServerActionError(error));
      } finally {
        event.target.value = "";
      }
    });
  }

  function handleDelete() {
    if (!localDocument) {
      return;
    }

    const formData = new FormData();
    formData.set("document_id", localDocument.id);
    formData.set("client_id", clientId);

    startDelete(async () => {
      try {
        const result = await deleteClientDocumentAction({ ok: false }, formData);
        if (result.ok) {
          toast.success(result.message ?? "Document removed.");
          setLocalDocument(null);
          refreshClientProfileSafely();
          return;
        }
        toast.error(result.message ?? "Could not remove document.");
      } catch (error) {
        if (isServerActionDecodeError(error)) {
          refreshClientProfileSafely();
          toast.warning(friendlyServerActionError(error));
          return;
        }
        toast.error(friendlyServerActionError(error));
      }
    });
  }

  return (
    <div className={cn("shrink-0", className)}>
      {localDocument ? (
        <div
          className={cn(
            "flex h-9 items-center gap-0.5 rounded-3xl border border-primary/30 bg-primary/10 px-1",
            busy && "opacity-70"
          )}
          title={localDocument.file_name}
        >
          <span className="flex items-center gap-1 pl-1.5 pr-0.5">
            <FileCheck2Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="hidden max-w-[4.5rem] truncate text-[10px] font-medium text-primary sm:inline">
              {localDocument.file_name}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-primary hover:bg-primary/15 hover:text-primary"
            disabled={busy}
            title="View attachment"
            onClick={() => {
              startDownload(async () => {
                try {
                  const result = await getClientDocumentDownloadUrlAction(
                    localDocument.id,
                    clientId
                  );
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  if (result.url) {
                    window.open(result.url, "_blank", "noopener,noreferrer");
                  }
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not open document."
                  );
                }
              });
            }}
          >
            {isDownloading ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <EyeIcon className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-primary hover:bg-primary/15 hover:text-primary"
            disabled={busy}
            title="Replace attachment"
            onClick={openFilePicker}
          >
            <PaperclipIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            title="Remove attachment"
            onClick={handleDelete}
          >
            {isDeleting ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XIcon className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "h-9 w-9 shrink-0 rounded-3xl border-primary/30 bg-primary/10 text-primary shadow-none",
            "hover:border-primary/45 hover:bg-primary/15 hover:text-primary"
          )}
          disabled={busy}
          title="Attach certificate"
          onClick={openFilePicker}
        >
          {isUploading ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <PaperclipIcon className="h-4 w-4" />
          )}
        </Button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        form={CLIENT_INLINE_DOCUMENT_FILE_FORM_ID}
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        disabled={busy}
        tabIndex={-1}
        className="sr-only"
        aria-hidden
        onChange={handleFileChange}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

```

#### `features/clients/components/client-list-status-cell.tsx`

```tsx
"use client";

import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  ONBOARDING_STATUS_LABELS,
  isClientOnboardingStatus,
  resolveClientListStatusBadges,
} from "@/lib/clients/onboarding-status";
import type { ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

import { ClientStatusBadge } from "./client-status-badge";
import { OnboardingStatusBadge } from "./onboarding-status-badge";

type ClientListStatusCellProps = {
  status: ClientStatus;
  onboardingStatus: string | null | undefined;
  className?: string;
  /** Use thinkway-platform_6.html badge styling on list pages. */
  platformV6?: boolean;
};

function resolveV6BadgeClass(
  kind: "operational" | "onboarding",
  status: string
): string {
  if (kind === "operational") {
    if (status === "active") return platformV6BadgeClass("outline-green");
    return platformV6BadgeClass("gray");
  }
  if (status === "active") return platformV6BadgeClass("outline-green");
  if (status === "legal_pending") return platformV6BadgeClass("outline-amber");
  return platformV6BadgeClass("gray");
}

export function ClientListStatusCell({
  status,
  onboardingStatus,
  className,
  platformV6 = true,
}: ClientListStatusCellProps) {
  const badges = resolveClientListStatusBadges({ status, onboardingStatus });

  if (platformV6) {
    const operationalLabel =
      CLIENT_STATUS_OPTIONS.find((option) => option.value === badges.operationalStatus)
        ?.label ?? badges.operationalStatus;

    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <span className={resolveV6BadgeClass("operational", badges.operationalStatus)}>
          {operationalLabel}
        </span>
        {badges.onboardingStatus &&
        isClientOnboardingStatus(badges.onboardingStatus) ? (
          <span className={resolveV6BadgeClass("onboarding", badges.onboardingStatus)}>
            {ONBOARDING_STATUS_LABELS[badges.onboardingStatus]}
          </span>
        ) : null}
      </div>
    );
  }

  const badgeClassName = cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-medium");

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <ClientStatusBadge status={badges.operationalStatus} className={badgeClassName} />
      {badges.onboardingStatus ? (
        <OnboardingStatusBadge
          status={badges.onboardingStatus}
          className={badgeClassName}
        />
      ) : null}
    </div>
  );
}

```

#### `features/clients/components/client-profile.tsx`

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlatformV6EntityBreadcrumb,
  platformV6BadgeClass,
} from "@/components/platform/platform-v6-layout";
import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  CLIENT_PROFILE_TAB_ORDER,
  CLIENT_PROFILE_TAB_STORAGE_KEY,
  isClientProfileTabId,
  type ClientProfileTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import type {
  AssignableClientProfileRow,
  ClientAccessEntityRow,
} from "@/features/client-access/types";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  deriveOnboardingStatusFromCompletion,
  isClientOnboardingStatus,
  ONBOARDING_STATUS_LABELS,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { computeClientProfileTabMissingCounts } from "@/lib/clients/client-profile-readiness";

import { ClientProfileTabShell, ClientProfilePlatformProvider } from "./client-form-ui";
import { ClientAccessTab } from "./tabs/client-access-tab";
import { ClientBrandsTab } from "./tabs/client-brands-tab";
import { ClientCampaignsTab } from "./tabs/client-campaigns-tab";
import { ClientClientIosTab, CLIENT_IO_SAVE_FORM_ID } from "./tabs/client-client-ios-tab";
import { ClientFinanceTab } from "./tabs/client-finance-tab";
import { ClientLegalTab } from "./tabs/client-legal-tab";
import { ClientOverviewTab } from "./tabs/client-overview-tab";
import { OnboardingWorkspace } from "./onboarding-workspace";
import type { ClientOverviewSavePatch } from "@/features/clients/actions";
type ClientProfileProps = {
  client: ClientDetail;
  groups: { id: string; name: string; document_number: string }[];
  masterData: MasterDataOptions;
  clientIos: ClientIoRow[];
  clientIoRecipients: ClientIoSendRecipient[];
  clientAccessEntity: ClientAccessEntityRow | null;
  assignableClientProfiles: AssignableClientProfileRow[];
  onboardingTimeline?: import("@/features/clients/onboarding-queries").ClientOnboardingTimelineEvent[];
  canEditOnboardingChecklist?: boolean;
  canOverrideOnboardingStatus?: boolean;
};

const TAB_SAVE_LABELS: Record<ClientProfileTabId, string> = {
  overview: "Save changes",
  brands: "Save",
  legal: "Save legal",
  finance: "Save finance",
  "client-ios": "Save draft",
  campaigns: "Save",
  access: "Save",
};

const TAB_FORM_IDS: Partial<Record<ClientProfileTabId, string>> = {
  overview: "client-overview-form",
  legal: "client-legal-form",
  finance: "client-finance-form",
  "client-ios": CLIENT_IO_SAVE_FORM_ID,
};

function resolveEntityStatusBadge(client: ClientDetail): {
  label: string;
  className: string;
} {
  if (isClientOnboardingStatus(client.onboarding_status)) {
    const storedStatus = client.onboarding_status as ClientOnboardingStatus;
    const status = deriveOnboardingStatusFromCompletion(
      {
        legal_completed_at: client.legal_completed_at,
        finance_completed_at: client.finance_completed_at,
        contracts_completed_at: client.contracts_completed_at,
        tax_completed_at: client.tax_completed_at,
        credit_limit_active: client.credit_limit_active ?? false,
      },
      storedStatus
    );
    if (status === "active") {
      return { label: ONBOARDING_STATUS_LABELS.active, className: platformV6BadgeClass("outline-green") };
    }
    if (status === "legal_pending") {
      return {
        label: ONBOARDING_STATUS_LABELS.legal_pending,
        className: platformV6BadgeClass("outline-amber"),
      };
    }
    return { label: ONBOARDING_STATUS_LABELS[status], className: platformV6BadgeClass("gray") };
  }

  const label =
    CLIENT_STATUS_OPTIONS.find((option) => option.value === client.status)?.label ??
    client.status;
  const className =
    client.status === "active"
      ? platformV6BadgeClass("outline-green")
      : platformV6BadgeClass("gray");
  return { label, className };
}

export function ClientProfile({
  client,
  groups,
  masterData,
  clientIos,
  clientIoRecipients,
  clientAccessEntity,
  assignableClientProfiles,
  onboardingTimeline = [],
  canEditOnboardingChecklist = false,
  canOverrideOnboardingStatus = false,
}: ClientProfileProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ClientProfileTabId>("overview");
  const [clientRecord, setClientRecord] = useState(client);
  const currencyOptions = buildCurrencyOptions(masterData.currencies);

  useEffect(() => {
    setClientRecord(client);
  }, [client]);

  const applyClientPatch = useCallback((patch: ClientOverviewSavePatch) => {
    setClientRecord((current) => ({
      ...current,
      group_id: patch.group_id,
      group: patch.group,
      updated_at: patch.updated_at,
    }));
  }, []);  const { tabOrder } = useWorkspaceTabOrder({
    storageKey: CLIENT_PROFILE_TAB_STORAGE_KEY,
    defaultOrder: CLIENT_PROFILE_TAB_ORDER,
    isValidId: isClientProfileTabId,
  });

  const handleCancel = () => router.push("/clients");
  const entityBadge = resolveEntityStatusBadge(clientRecord);
  const tabMissingCounts = useMemo(
    () => computeClientProfileTabMissingCounts(clientRecord),
    [clientRecord]
  );
  const tabsById = useMemo(
    (): Record<ClientProfileTabId, OperationalWorkspaceTabDef> => ({
      overview: {
        value: "overview",
        label: "Overview",
        count: tabMissingCounts.overview,
      },
      brands: {
        value: "brands",
        label: "Brands",
        count: tabMissingCounts.brands,
      },
      legal: { value: "legal", label: "Legal", count: tabMissingCounts.legal },
      finance: { value: "finance", label: "Finance", count: tabMissingCounts.finance },
      "client-ios": {
        value: "client-ios",
        label: "Client IO",
      },
      campaigns: {
        value: "campaigns",
        label: "Campaign history",
      },
      access: { value: "access", label: "Client access" },
    }),
    [tabMissingCounts]
  );

  const tabPanelClassName =
    "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

  const tabPanels = (
    <>
      <OperationalWorkspaceTabContent value="overview" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientOverviewTab
            client={clientRecord}
            groups={groups}
            masterData={masterData}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "overview"}
            onClientPatch={applyClientPatch}
            onboardingSlot={
              <OnboardingWorkspace
                clientId={clientRecord.id}
                status={clientRecord.onboarding_status}
                creditLimitActive={clientRecord.credit_limit_active ?? false}
                completion={{
                  legal_completed_at: clientRecord.legal_completed_at,
                  finance_completed_at: clientRecord.finance_completed_at,
                  contracts_completed_at: clientRecord.contracts_completed_at,
                  tax_completed_at: clientRecord.tax_completed_at,
                }}
                activatedAt={clientRecord.activated_at ?? null}                timeline={onboardingTimeline}
                canEditChecklist={canEditOnboardingChecklist}
                canOverrideStatus={canOverrideOnboardingStatus}
                platformV6
              />
            }
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="brands" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientBrandsTab
            client={clientRecord}
            masterData={masterData}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "brands"}
            onGoToOverview={() => setActiveTab("overview")}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="legal" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientLegalTab
            client={clientRecord}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "legal"}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="finance" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientFinanceTab
            client={clientRecord}
            currencyOptions={currencyOptions}
            onCancel={handleCancel}
            shortcutsEnabled={activeTab === "finance"}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="client-ios" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientClientIosTab
            clientId={clientRecord.id}
            clientName={clientRecord.name}
            clientIoTermsText={clientRecord.client_io_terms_text}
            rows={clientIos}
            recipients={clientIoRecipients}
            onCancel={handleCancel}
          />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="campaigns" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientCampaignsTab client={clientRecord} onCancel={handleCancel} />
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
      <OperationalWorkspaceTabContent value="access" className={tabPanelClassName}>
        <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ClientProfileTabShell
            title="Client access"
            description="Manage portal users and roles for this legal entity."
            onCancel={handleCancel}
          >
            <ClientAccessTab
              entity={clientAccessEntity}
              assignable={assignableClientProfiles}
            />
          </ClientProfileTabShell>
        </OperationalWorkspaceTabPanel>
      </OperationalWorkspaceTabContent>
    </>
  );

  return (
    <ClientProfilePlatformProvider platformV6>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isClientProfileTabId(value)) {
            setActiveTab(value);
          }
        }}
        className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <div className="platform-v6-entity-nav-bar">
          <div className="platform-v6-entity-nav-inner">
            <span className="platform-v6-entity-title">{clientRecord.name}</span>            <span className={entityBadge.className}>{entityBadge.label}</span>
            <span className="platform-v6-also-view">Also View</span>
          </div>
          <div className="platform-v6-entity-tabs-row" role="tablist">
            {tabOrder.map((tabId) => {
              const tab = tabsById[tabId];
              const isActive = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tabId)}
                  className={cn("platform-v6-etab", isActive && "active")}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 ? ` (${tab.count})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <PlatformV6EntityBreadcrumb
          crumbs={[
            { label: "Clients", href: "/clients" },
            { label: "Legal Entities", href: "/clients" },
            { label: "Edit" },
          ]}
          actions={
            <>
              <button
                type="button"
                className="platform-v6-btn platform-v6-btn-sm"
                onClick={handleCancel}
              >
                Cancel
              </button>
              {TAB_FORM_IDS[activeTab] ? (
                <button
                  type="submit"
                  form={TAB_FORM_IDS[activeTab]}
                  className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm"
                >
                  {TAB_SAVE_LABELS[activeTab]}
                </button>
              ) : (
                <button
                  type="button"
                  className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm"
                >
                  {TAB_SAVE_LABELS[activeTab]}
                </button>
              )}
            </>
          }
        />

        <div className="min-h-0 flex-1 overflow-y-auto">{tabPanels}</div>
      </Tabs>
    </div>
    </ClientProfilePlatformProvider>
  );
}

```

#### `features/clients/components/client-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/types/database";

import { CLIENT_STATUS_OPTIONS } from "../constants";
import { resolveStatusTone } from "@/components/shared/status/status-utils";

type ClientStatusBadgeProps = {
  status: ClientStatus;
  className?: string;
};

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  const label =
    CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("client", status)}
      className={cn("font-medium", className)}
    />
  );
}

```

#### `features/clients/components/onboarding-progress-tracker.tsx`

```tsx
import { CheckCircle2Icon, CircleIcon } from "lucide-react";

import {
  computeOnboardingProgress,
  deriveOnboardingStatusFromCompletion,
  formatOnboardingProgressDetail,
  getIncompleteOnboardingSectionLabels,
  isOnboardingSectionApplicable,
  type ClientOnboardingStatus,
  type OnboardingCompletionFields,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

import { OnboardingStatusBadge } from "./onboarding-status-badge";

type OnboardingProgressTrackerProps = {
  status: ClientOnboardingStatus;
  completion: OnboardingCompletionFields;
  creditLimitActive?: boolean;
  className?: string;
  compact?: boolean;
};

export function OnboardingProgressTracker({
  status,
  completion,
  creditLimitActive = false,
  className,
  compact = false,
}: OnboardingProgressTrackerProps) {
  const derivationInput = { ...completion, credit_limit_active: creditLimitActive };
  const displayStatus = deriveOnboardingStatusFromCompletion(derivationInput, status);
  const progress = computeOnboardingProgress(derivationInput);
  const applicableSections = progress.sections.filter((section) =>
    isOnboardingSectionApplicable(section.id, derivationInput)
  );

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        compact && "p-3",
        className
      )}
      aria-label="Client onboarding progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
            Onboarding progress
          </h3>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              Complete legal, finance (when credit limit is active), and tax before activating for campaigns.
            </p>
          ) : null}
        </div>
        <OnboardingStatusBadge status={displayStatus} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.percentage}%` }}
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={formatOnboardingProgressDetail(progress, derivationInput)}
          />
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {progress.percentage >= 100 ? "Complete" : `${progress.percentage}%`}
        </span>
      </div>

      {progress.percentage < 100 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {formatOnboardingProgressDetail(progress, derivationInput)}
        </p>
      ) : null}

      {getIncompleteOnboardingSectionLabels(progress, derivationInput).length > 0 ? (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Still needed: {getIncompleteOnboardingSectionLabels(progress, derivationInput).join(" · ")}
        </p>
      ) : null}

      <ul className={cn("mt-3 space-y-2", compact && "mt-2 space-y-1.5")}>
        {applicableSections.map((section) => (
          <li key={section.id} className="flex items-center gap-2 text-sm">
            {section.completed ? (
              <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
            ) : (
              <CircleIcon className="size-4 shrink-0 text-amber-600" aria-hidden />
            )}
            <span
              className={
                section.completed ? "text-foreground" : "font-medium text-amber-700"
              }
            >
              {section.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

```

#### `features/clients/components/onboarding-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import {
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_TONE,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

type OnboardingStatusBadgeProps = {
  status: ClientOnboardingStatus;
  className?: string;
};

export function OnboardingStatusBadge({ status, className }: OnboardingStatusBadgeProps) {
  return (
    <StatusBadge
      label={ONBOARDING_STATUS_LABELS[status]}
      tone={ONBOARDING_STATUS_TONE[status]}
      className={cn("font-medium", className)}
    />
  );
}

```

#### `features/clients/components/onboarding-workspace.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ChevronDownIcon, CircleIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateClientOnboardingChecklistAction,
  overrideClientOnboardingStatusAction,
} from "@/features/clients/onboarding-actions";
import type { ClientOnboardingTimelineEvent } from "@/features/clients/onboarding-queries";
import { useDebouncedAutosave, type AutosaveStatus } from "@/lib/hooks/use-debounced-autosave";
import {
  CLIENT_ONBOARDING_STATUSES,
  computeOnboardingProgress,
  deriveOnboardingStatusFromCompletion,
  formatOnboardingProgressDetail,
  formatOnboardingStatusProgressBadge,
  getIncompleteOnboardingSectionLabels,
  ONBOARDING_STATUS_LABELS,
  type ClientOnboardingStatus,
  type OnboardingChecklistSection,
  type OnboardingCompletionFields,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

import { OnboardingStatusBadge } from "./onboarding-status-badge";

type OnboardingWorkspaceProps = {
  clientId: string;
  status: ClientOnboardingStatus;
  completion: OnboardingCompletionFields;
  creditLimitActive?: boolean;
  activatedAt: string | null;
  timeline: ClientOnboardingTimelineEvent[];
  canEditChecklist: boolean;
  canOverrideStatus: boolean;
  className?: string;
  compact?: boolean;
  /** When true, checklist/override/timeline collapse behind a slim summary bar. */
  collapsible?: boolean;
  /** Initial expanded state when collapsible (defaults to collapsed). */
  defaultExpanded?: boolean;
  /** thinkway-platform_6.html slim progress strip on overview tab. */
  platformV6?: boolean;
};

type ChecklistState = Record<OnboardingChecklistSection, boolean>;

function completionToChecklist(
  completion: OnboardingCompletionFields,
  creditLimitActive: boolean
): ChecklistState {
  return {
    legal: Boolean(completion.legal_completed_at),
    finance: Boolean(completion.finance_completed_at) || !creditLimitActive,
    contracts: Boolean(completion.contracts_completed_at),
    tax: Boolean(completion.tax_completed_at),
  };
}

function SaveIndicator({ status }: { status: AutosaveStatus }) {
  if (status === "saved") {
    return <span className="text-xs text-success">Saved</span>;
  }
  if (status === "saving" || status === "pending") {
    return <span className="text-xs text-muted-foreground">Saving…</span>;
  }
  if (status === "error") {
    return <span className="text-xs text-destructive">Save failed</span>;
  }
  return null;
}

function formatTimelineDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function OnboardingWorkspace({
  clientId,
  status: initialStatus,
  completion,
  creditLimitActive = false,
  activatedAt,
  timeline,
  canEditChecklist,
  canOverrideStatus,
  className,
  compact = false,
  collapsible = false,
  defaultExpanded = false,
  platformV6 = false,
}: OnboardingWorkspaceProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [checklist, setChecklist] = useState<ChecklistState>(() =>
    completionToChecklist(completion, creditLimitActive)
  );
  const [overrideStatus, setOverrideStatus] = useState<ClientOnboardingStatus>(initialStatus);
  const [overridePending, setOverridePending] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
    setOverrideStatus(initialStatus);
    setChecklist(completionToChecklist(completion, creditLimitActive));
  }, [initialStatus, completion, creditLimitActive]);

  const derivationInput = {
    legal_completed_at: completion.legal_completed_at,
    finance_completed_at: completion.finance_completed_at,
    contracts_completed_at: completion.contracts_completed_at,
    tax_completed_at: completion.tax_completed_at,
    credit_limit_active: creditLimitActive,
  };

  const displayStatus = deriveOnboardingStatusFromCompletion(derivationInput, initialStatus);

  const progress = computeOnboardingProgress(derivationInput);

  const saveChecklist = useCallback(
    async (payload: ChecklistState) => {
      const result = await updateClientOnboardingChecklistAction({
        client_id: clientId,
        ...payload,
      });
      if (result.ok && result.onboardingStatus) {
        setStatus(result.onboardingStatus);
        setOverrideStatus(result.onboardingStatus);
        router.refresh();
      }
      return { ok: result.ok, message: result.message };
    },
    [clientId, router]
  );

  const { status: saveStatus, schedule } = useDebouncedAutosave(saveChecklist);

  function toggleSection(section: OnboardingChecklistSection, checked: boolean) {
    const next = { ...checklist, [section]: checked };
    setChecklist(next);
    schedule(next);
  }

  async function applyManualOverride(next: ClientOnboardingStatus) {
    setOverridePending(true);
    try {
      const result = await overrideClientOnboardingStatusAction({
        client_id: clientId,
        status: next,
      });
      if (result.ok && result.onboardingStatus) {
        setStatus(result.onboardingStatus);
        setOverrideStatus(result.onboardingStatus);
        router.refresh();
      }
    } finally {
      setOverridePending(false);
    }
  }

  const sectionLabels: Record<OnboardingChecklistSection, string> = {
    legal: "Legal completed",
    finance: creditLimitActive ? "Finance completed" : "Finance completed (not required)",
    contracts: "Contracts completed",
    tax: "Tax completed",
  };

  const fallbackTimeline: ClientOnboardingTimelineEvent[] = [];
  if (completion.legal_completed_at) {
    fallbackTimeline.push({
      id: "legal-fallback",
      kind: "legal_completed",
      label: "Legal completed",
      occurredAt: completion.legal_completed_at,
      actorName: null,
      previousStatus: null,
      newStatus: "finance_pending",
    });
  }
  if (completion.finance_completed_at) {
    fallbackTimeline.push({
      id: "finance-fallback",
      kind: "finance_completed",
      label: "Finance approved",
      occurredAt: completion.finance_completed_at,
      actorName: null,
      previousStatus: null,
      newStatus: "ready",
    });
  }
  if (activatedAt) {
    fallbackTimeline.push({
      id: "activated-fallback",
      kind: "activated",
      label: "Client activated",
      occurredAt: activatedAt,
      actorName: null,
      previousStatus: "ready",
      newStatus: "active",
    });
  }

  const displayTimeline =
    timeline.length > 0
      ? timeline
      : fallbackTimeline.sort(
          (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
        );

  if (platformV6) {
    const incompleteLabels = getIncompleteOnboardingSectionLabels(progress, derivationInput);
    const progressDetail = formatOnboardingProgressDetail(progress, derivationInput);
    const statusBadgeLabel = formatOnboardingStatusProgressBadge(displayStatus, progress);
    const showReadyExplanation =
      displayStatus === "ready" && progress.percentage < 100;

    return (
      <div className={cn("mb-1.5", className)}>
        <div className="platform-v6-progress-bar">
          <div
            className="platform-v6-progress-fill"
            style={{ width: `${progress.percentage}%` }}
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progressDetail}
          />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--tw-text-3,#94a3b8)]">
          <span className="min-w-0 truncate" title={progressDetail}>
            {progress.percentage >= 100 ? "Onboarding complete" : progressDetail}
          </span>
          <span
            className={cn(
              "platform-v6-badge shrink-0",
              progress.percentage >= 100
                ? "platform-v6-badge-outline-green"
                : "platform-v6-badge-outline-green"
            )}
            title={progressDetail}
          >
            {statusBadgeLabel}
          </span>
        </div>
        {incompleteLabels.length > 0 ? (
          <p className="mt-1 text-[10px] font-medium text-amber-700">
            Still needed: {incompleteLabels.join(" · ")}
          </p>
        ) : null}
        {showReadyExplanation ? (
          <p className="mt-0.5 text-[10px] text-[var(--tw-text-3,#94a3b8)]">
            Ready means finance is cleared. Complete remaining steps to activate fully.
          </p>
        ) : null}
      </div>
    );
  }

  const progressBar = (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:h-2">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress.percentage}%` }}
            role="progressbar"
            aria-valuenow={progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={formatOnboardingProgressDetail(progress, derivationInput)}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {progress.percentage >= 100 ? "Complete" : `${progress.percentage}%`}
        </span>
      </div>
      {progress.percentage < 100 ? (
        <p className="text-[11px] text-muted-foreground">
          {formatOnboardingProgressDetail(progress, derivationInput)}
        </p>
      ) : null}
    </div>
  );

  const checklistGrid = (
    <ul
      className={cn(
        "grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2",
        compact && "gap-y-1.5"
      )}
    >
      {progress.sections.map((section) => {
        const financeNotRequired = section.id === "finance" && !creditLimitActive;
        return (
        <li key={section.id} className="flex items-center gap-2 text-sm">
          {canEditChecklist ? (
            <Checkbox
              id={`onboarding-${section.id}`}
              checked={checklist[section.id]}
              disabled={saveStatus === "saving" || financeNotRequired}
              onCheckedChange={(checked) =>
                toggleSection(section.id, checked === true)
              }
              aria-label={sectionLabels[section.id]}
            />
          ) : section.completed ? (
            <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
            ) : (
            <CircleIcon className="size-4 shrink-0 text-amber-600" aria-hidden />
          )}
          <Label
            htmlFor={canEditChecklist ? `onboarding-${section.id}` : undefined}
            className={cn(
              "font-normal",
              section.completed || checklist[section.id]
                ? "text-foreground"
                : "font-medium text-amber-700"
            )}
          >
            {sectionLabels[section.id]}
          </Label>
        </li>
        );
      })}
    </ul>
  );

  const expandedDetails = (
    <>
      {!compact ? (
        <p className="text-xs text-muted-foreground">
          Complete legal, finance (when credit limit is active), and tax before activating for campaigns.
        </p>
      ) : null}

      {getIncompleteOnboardingSectionLabels(progress, derivationInput).length > 0 ? (
        <p className="text-xs font-medium text-amber-700">
          Still needed: {getIncompleteOnboardingSectionLabels(progress, derivationInput).join(" · ")}
        </p>
      ) : null}

      {checklistGrid}

      {canOverrideStatus ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="onboarding-status-override" className="text-xs text-muted-foreground">
              Manual status override
            </Label>
            <Select
              value={overrideStatus}
              onValueChange={(value) => {
                const next = value as ClientOnboardingStatus;
                setOverrideStatus(next);
                void applyManualOverride(next);
              }}
              disabled={overridePending}
            >
              <SelectTrigger id="onboarding-status-override" className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_ONBOARDING_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ONBOARDING_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {displayTimeline.length > 0 ? (
        <div className="border-t border-border pt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </h4>
          <ol className="mt-2 space-y-1.5">
            {displayTimeline.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimelineDate(event.occurredAt)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </>
  );

  if (collapsible) {
    return (
      <section
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card",
          className
        )}
        aria-label="Client onboarding progress"
      >
        <details className="group" {...(defaultExpanded ? { open: true } : {})}>
          <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none sm:px-4 sm:py-3 [&::-webkit-details-marker]:hidden">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h3
                    className={cn(
                      "font-semibold text-foreground",
                      compact ? "text-sm" : "text-[15px]"
                    )}
                  >
                    Onboarding progress
                  </h3>
                  <ChevronDownIcon
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </div>
                <div className="flex items-center gap-2">
                  {canEditChecklist ? <SaveIndicator status={saveStatus} /> : null}
                  <OnboardingStatusBadge status={displayStatus} />
                </div>
              </div>
              {progressBar}
            </div>
          </summary>
          <div className="space-y-3 border-t border-border px-3 pb-3 pt-3 sm:px-4 sm:pb-4">
            {expandedDetails}
          </div>
        </details>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        compact && "p-3",
        className
      )}
      aria-label="Client onboarding progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
            Onboarding progress
          </h3>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              Complete legal, finance (when credit limit is active), and tax before activating for campaigns.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canEditChecklist ? <SaveIndicator status={saveStatus} /> : null}
          <OnboardingStatusBadge status={displayStatus} />
        </div>
      </div>

      <div className="mt-3">{progressBar}</div>

      <div className={cn("mt-3", compact && "mt-2")}>{checklistGrid}</div>

      {canOverrideStatus ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
          <div className="min-w-[180px] flex-1">
            <Label htmlFor="onboarding-status-override" className="text-xs text-muted-foreground">
              Manual status override
            </Label>
            <Select
              value={overrideStatus}
              onValueChange={(value) => {
                const next = value as ClientOnboardingStatus;
                setOverrideStatus(next);
                void applyManualOverride(next);
              }}
              disabled={overridePending}
            >
              <SelectTrigger id="onboarding-status-override" className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_ONBOARDING_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ONBOARDING_STATUS_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {displayTimeline.length > 0 ? (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </h4>
          <ol className="mt-2 space-y-2">
            {displayTimeline.map((event) => (
              <li key={event.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{event.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimelineDate(event.occurredAt)}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

```

#### `features/clients/components/tabs/client-access-tab.tsx`

```tsx
"use client";

import { UsersIcon } from "lucide-react";

import { ClientFormSection } from "@/features/clients/components/client-form-ui";
import { ClientAccessWorkspace } from "@/features/client-access/components/client-access-workspace";
import type {
  AssignableClientProfileRow,
  ClientAccessEntityRow,
} from "@/features/client-access/types";

type Props = {
  entity: ClientAccessEntityRow | null;
  assignable: AssignableClientProfileRow[];
};

export function ClientAccessTab({ entity, assignable }: Props) {
  if (!entity) {
    return (
      <p className="text-[13px] text-[#9099A8]">Legal entity not found.</p>
    );
  }

  return (
    <ClientFormSection
      icon={UsersIcon}
      title="Client portal access"
      description="Assign users who can sign in to the client portal for this legal entity."
    >
      <ClientAccessWorkspace entity={entity} assignable={assignable} compact />
    </ClientFormSection>
  );
}

```

#### `features/clients/components/tabs/client-brands-tab.tsx`

```tsx
"use client";

import { PlusIcon, TagIcon } from "lucide-react";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveBrandAction } from "@/features/brands/actions";
import { ClientAddBrandDialog } from "@/features/brands/components/client-add-brand-dialog";
import {
  BrandDeactivateButton,
  BrandRowActions,
  BrandStatusCell,
} from "@/features/brands/components/brand-row-actions";
import {
  brandTableRowToGroupBrandRow,
  clientToLegalEntityRow,
} from "@/features/brands/utils";
import { BrandSheet } from "@/features/groups/components/brand-sheet";
import type { GroupBrandRow } from "@/features/groups/types";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { CLIENT_BRANDS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import type { ClientBrandRow, ClientDetail } from "@/types/database";
import {
  CLIENT_FORM_GHOST_BUTTON_CLASS,
  CLIENT_FORM_PRIMARY_BUTTON_CLASS,
  CLIENT_FORM_SAVE_SHORTCUT_HINT,
  CLIENT_FORM_SECONDARY_BUTTON_CLASS,
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  ClientProfileTabShell,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { cn } from "@/lib/utils";

const CLIENT_ADD_BRAND_FORM_ID = "client-add-brand-form";

type ClientBrandsTabProps = {
  client: ClientDetail;
  masterData: MasterDataOptions;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
  onGoToOverview?: () => void;
};

type BrandTableContext = {
  onEdit: (brand: ClientBrandRow) => void;
  onArchive: (brand: ClientBrandRow) => void;
  platformV6: boolean;
};

function formatBrandVrOverride(brand: ClientBrandRow): string {
  if (brand.vr_rate_id && brand.vr_rate_percent != null) {
    return `${brand.vr_rate_percent}%`;
  }
  return "—";
}

function buildClientBrandsColumns(
  context: BrandTableContext
): OperationalConfigurableColumnDef<ClientBrandRow>[] {
  return [
    {
      id: "brand_number",
      label: "Brand #",
      monoCell: true,
      renderCell: (brand) => (
        <button
          type="button"
          onClick={() => context.onEdit(brand)}
          className={cn(
            context.platformV6
              ? "platform-v6-link tabular-nums"
              : "font-mono text-[#0057FF] hover:underline"
          )}
        >
          {brand.document_number}
        </button>
      ),
    },
    {
      id: "name",
      label: "Name",
      renderCell: (brand) => (
        <span className={cn(context.platformV6 && "font-semibold text-[var(--tw-text)]")}>
          {brand.name}
        </span>
      ),
    },
    {
      id: "vr_rate",
      label: "VR%",
      renderCell: (brand) => formatBrandVrOverride(brand),
    },
    {
      id: "currency",
      label: "Currency",
      renderCell: (brand) => brand.currency_code,
    },
    {
      id: "campaigns",
      label: "Campaigns",
      headerClassName: "text-center",
      cellClassName: "text-center",
      renderCell: (brand) => brand.active_campaigns,
    },
    {
      id: "status",
      label: "Status",
      renderCell: (brand) =>
        context.platformV6 ? (
          brand.status === "active" ? (
            <span className={platformV6BadgeClass("outline-green")}>Active</span>
          ) : (
            <BrandStatusCell status={brand.status} />
          )
        ) : (
          <BrandStatusCell status={brand.status} />
        ),
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (brand) => (
        <div
          className={cn(
            context.platformV6 && "platform-v6-row-actions"
          )}
        >
          <BrandDeactivateButton brand={brand} />
          <BrandRowActions
            brand={brand}
            onEdit={() => context.onEdit(brand)}
            onArchive={() => context.onArchive(brand)}
            triggerClassName={
              context.platformV6
                ? "platform-v6-btn platform-v6-btn-sm !px-[6px]"
                : undefined
            }
          />
        </div>
      ),
    },
  ];
}

export function ClientBrandsTab({
  client,
  masterData,
  onCancel,
  shortcutsEnabled = true,
  onGoToOverview,
}: ClientBrandsTabProps) {
  const platformV6 = useClientProfilePlatformV6();
  const savedGroupId = client.group_id ?? client.group?.id ?? null;
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupBrandRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ClientBrandRow | null>(null);

  const openEditBrand = useCallback(
    (brand: ClientBrandRow) => {
      setEditing(brandTableRowToGroupBrandRow(brand, client.name));
      setEditSheetOpen(true);
    },
    [client.name]
  );

  const columns = useMemo(
    () =>
      buildClientBrandsColumns({
        onEdit: openEditBrand,
        onArchive: setArchiveTarget,
        platformV6,
      }),
    [openEditBrand, platformV6]
  );

  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveBrandAction,
    { ok: false }
  );

  useEffect(() => {
    if (!archiveState.message) return;
    if (archiveState.ok) {
      toast.success(archiveState.message);
      setArchiveTarget(null);
      return;
    }
    toast.error(archiveState.message);
  }, [archiveState]);

  const legalEntity = clientToLegalEntityRow(client);
  const openAddBrandDialog = () => setAddDialogOpen(true);

  const portfolioFooter = (
    <>
      Set default VR% on client overview or override here. Use{" "}
      <strong>Add new brand</strong> to create another brand after each save.
      {platformV6 ? null : (
        <>
          {" "}
          {CLIENT_FORM_SAVE_SHORTCUT_HINT} while the add dialog is open.
        </>
      )}
    </>
  );

  const addBrandButton = platformV6 ? (
    <button
      type="button"
      className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm"
      onClick={openAddBrandDialog}
    >
      + Add new brand
    </button>
  ) : (
    <button
      type="button"
      className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
      onClick={openAddBrandDialog}
    >
      <PlusIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
      Add new brand
    </button>
  );

  const portfolioToolbar = (
    <>
      <OperationalTableControlsSlot contextLabel="Client brands" />
      {addBrandButton}
    </>
  );

  return (
    <>
      <ClientFormKeyboardShortcuts
        formId={CLIENT_ADD_BRAND_FORM_ID}
        enabled={shortcutsEnabled && addDialogOpen}
      />
      <ClientProfileTabShell
        title="Brands"
        description="Commercial brands under this legal entity. VR% inherits from overview unless overridden."
        onCancel={onCancel}
      >
        <div className={cn(!platformV6 && "grid gap-[18px]")}>
          {!savedGroupId ? (
            <div
              className={cn(
                platformV6
                  ? "mb-3 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-950"
                  : "rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950"
              )}
            >
              <p className="font-medium">No holding group linked</p>
              <p className="mt-1 text-[12px] text-amber-900/80">
                You can add brands without a holding group. If this legal entity belongs to
                one, link it on the Overview tab for group-level reporting.
              </p>
              {onGoToOverview ? (
                <button
                  type="button"
                  className={cn(
                    platformV6
                      ? "platform-v6-btn platform-v6-btn-sm mt-3"
                      : CLIENT_FORM_SECONDARY_BUTTON_CLASS,
                    !platformV6 && "mt-3"
                  )}
                  onClick={onGoToOverview}
                >
                  Go to Overview
                </button>
              ) : null}
            </div>
          ) : null}

          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.clientBrands}
            columns={columns}
            rows={client.brands}
            filterAccessors={CLIENT_BRANDS_FILTER_ACCESSORS}
          >
            <ClientFormSection
              icon={TagIcon}
              iconClassName="platform-v6-wide-form-head-icon-purple"
              title="Brand portfolio"
              description="Manage brands, VR overrides, and status for this legal entity."
              toolbar={portfolioToolbar}
              bodyClassName={platformV6 ? "platform-v6-wide-form-body-table" : undefined}
              footer={portfolioFooter}
            >
              {client.brands.length === 0 ? (
                <div
                  className={cn(
                    platformV6 ? "platform-v6-empty-state" : "space-y-3 py-6"
                  )}
                >
                  <p
                    className={cn(
                      !platformV6 && "text-[13px] text-[#9099A8]"
                    )}
                  >
                    No brands yet for this legal entity.
                  </p>
                  <button
                    type="button"
                    className={
                      platformV6
                        ? "platform-v6-btn platform-v6-btn-sm mt-3"
                        : CLIENT_FORM_SECONDARY_BUTTON_CLASS
                    }
                    onClick={openAddBrandDialog}
                  >
                    {platformV6 ? (
                      "+ Add new brand"
                    ) : (
                      <>
                        <PlusIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
                        Add new brand
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    "overflow-x-auto",
                    !platformV6 && "-mx-[22px]"
                  )}
                >
                  <OperationalConfigurableTable
                    columns={columns}
                    rows={client.brands}
                    rowKey={(brand) => brand.id}
                    className={platformV6 ? "platform-v6-data-table" : undefined}
                  />
                </div>
              )}
            </ClientFormSection>
          </OperationalTableSuiteProvider>
        </div>
      </ClientProfileTabShell>

      <ClientAddBrandDialog
        client={client}
        masterData={masterData}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        formId={CLIENT_ADD_BRAND_FORM_ID}
      />

      <BrandSheet
        legalEntities={[legalEntity]}
        masterData={masterData}
        brand={editing}
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) {
            setEditing(null);
          }
        }}
      />

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive brand</DialogTitle>
            <DialogDescription>
              {archiveTarget?.active_campaigns
                ? "This brand cannot be archived because campaigns are linked to it."
                : `Archive ${archiveTarget?.name}? You can restore it later by editing the brand status.`}
            </DialogDescription>
          </DialogHeader>
          {archiveTarget ? (
            <form action={archiveAction}>
              <input type="hidden" name="brand_id" value={archiveTarget.id} />
              <input type="hidden" name="client_id" value={archiveTarget.client_id} />
              <DialogFooter>
                <button
                  type="button"
                  className={CLIENT_FORM_GHOST_BUTTON_CLASS}
                  onClick={() => setArchiveTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-destructive px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                  disabled={archivePending || archiveTarget.active_campaigns > 0}
                >
                  {archivePending ? "Archiving…" : "Archive brand"}
                </button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

```

#### `features/clients/components/tabs/client-campaigns-tab.tsx`

```tsx
"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ActivityIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { CLIENT_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  ClientFormSection,
  ClientProfileTabShell,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

type CampaignRow = ClientDetail["campaigns"][number];

function buildClientCampaignsColumns(
  platformV6: boolean
): OperationalConfigurableColumnDef<CampaignRow>[] {
  return [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (campaign) => (
        <Link
          href={`/campaigns/${campaign.id}`}
          className={cn(
            platformV6
              ? "platform-v6-link font-medium"
              : "font-medium text-[#0057FF] hover:underline"
          )}
        >
          {campaign.name}
        </Link>
      ),
    },
    {
      id: "campaign_number",
      label: "Campaign #",
      monoCell: true,
      renderCell: (campaign) =>
        platformV6 ? (
          <Link
            href={`/campaigns/${campaign.id}`}
            className="platform-v6-link tabular-nums"
          >
            <DocumentNumber
              value={campaign.document_number}
              showCanonicalTitle={false}
            />
          </Link>
        ) : (
          <DocumentNumber value={campaign.document_number} />
        ),
    },
    {
      id: "brand",
      label: "Brand",
      renderCell: (campaign) =>
        (campaign.brand as { name: string } | null)?.name ?? "—",
    },
    {
      id: "status",
      label: "Status",
      cellClassName: "capitalize",
      renderCell: (campaign) => campaign.status.replace(/_/g, " "),
    },
    {
      id: "currency",
      label: "Currency",
      renderCell: (campaign) => campaign.currency_code,
    },
    {
      id: "dates",
      label: "Dates",
      cellClassName: platformV6 ? "text-[11px] text-[var(--tw-text-3)]" : "text-[#9099A8]",
      renderCell: (campaign) => (
        <>
          {campaign.start_date
            ? format(new Date(campaign.start_date), "MMM d, yyyy")
            : "—"}
          {" — "}
          {campaign.end_date
            ? format(new Date(campaign.end_date), "MMM d, yyyy")
            : "—"}
        </>
      ),
    },
  ];
}

export const CLIENT_CAMPAIGNS_TABLE_COLUMNS = buildClientCampaignsColumns(false);

export function ClientCampaignsTab({
  client,
  onCancel,
}: {
  client: ClientDetail;
  onCancel?: () => void;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const columns = buildClientCampaignsColumns(platformV6);

  return (
    <ClientProfileTabShell
      title="Campaign history"
      description="Campaign headers linked to brands under this legal entity."
      onCancel={onCancel}
    >
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.clientCampaigns}
        columns={columns}
        rows={client.campaigns}
        filterAccessors={CLIENT_CAMPAIGNS_FILTER_ACCESSORS}
      >
        <ClientFormSection
          icon={ActivityIcon}
          iconClassName={platformV6 ? "platform-v6-wide-form-head-icon-green" : undefined}
          title="Campaigns"
          description="Open a campaign workspace from the list below."
          toolbar={
            <OperationalTableControlsSlot contextLabel="Client campaigns" />
          }
          bodyClassName={platformV6 ? "platform-v6-wide-form-body-table" : undefined}
        >
          {client.campaigns.length === 0 ? (
            <div
              className={cn(
                platformV6 ? "platform-v6-empty-state" : "py-6 text-[13px] text-[#9099A8]"
              )}
            >
              No campaigns yet for this client.
            </div>
          ) : (
            <div
              className={cn(
                "overflow-x-auto",
                !platformV6 && "-mx-[22px]"
              )}
            >
              <OperationalConfigurableTable
                columns={columns}
                rows={client.campaigns}
                rowKey={(campaign) => campaign.id}
                className={platformV6 ? "platform-v6-data-table" : undefined}
              />
            </div>
          )}
        </ClientFormSection>
      </OperationalTableSuiteProvider>
    </ClientProfileTabShell>
  );
}

```

#### `features/clients/components/tabs/client-client-ios-tab.tsx`

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileTextIcon } from "lucide-react";

import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import {
  CLIENT_IOS_TABLE_COLUMNS,
  ClientIosTable,
} from "@/features/io/components/client-ios-table";
import { ClientIoForm } from "@/features/io/components/client-io-form";
import type { ClientIoRow, ClientIoSendRecipient } from "@/features/io/types";
import {
  ClientFormSection,
  ClientProfileTabShell,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { CLIENT_IOS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";

export const CLIENT_IO_SAVE_FORM_ID = "client-io-save";

type ClientClientIosTabProps = {
  clientId: string;
  clientName: string;
  clientIoTermsText: string | null;
  rows: ClientIoRow[];
  recipients: ClientIoSendRecipient[];
  onCancel?: () => void;
};

export function ClientClientIosTab({
  clientId,
  clientName,
  clientIoTermsText,
  rows,
  recipients,
  onCancel,
}: ClientClientIosTabProps) {
  const platformV6 = useClientProfilePlatformV6();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const filterAccessors = useMemo(() => {
    const { client: _client, ...rest } = CLIENT_IOS_FILTER_ACCESSORS;
    return rest;
  }, []);

  const registerToolbar = (
    <>
      <Link
        href={`/ios/client?client=${clientId}`}
        className={cn(platformV6 && "platform-v6-btn platform-v6-btn-sm")}
      >
        Open IO register
      </Link>
      <OperationalTableControlsSlot contextLabel="Client IO register" />
    </>
  );

  return (
    <ClientProfileTabShell
      title="Client IO"
      description={`All client insertion orders issued to ${clientName}.`}
      onCancel={onCancel}
    >
      <OperationalTableSuiteProvider
        tableId={OPERATIONAL_TABLE_IDS.clientClientIos}
        columns={CLIENT_IOS_TABLE_COLUMNS}
        rows={rows}
        filterAccessors={filterAccessors}
      >
        <ClientFormSection
          icon={FileTextIcon}
          title="Client IO register"
          description="Select a row to review terms, recipients, and send history."
          toolbar={registerToolbar}
          bodyClassName={platformV6 ? "platform-v6-wide-form-body-table" : undefined}
        >
          {rows.length === 0 ? (
            <div className={cn(platformV6 ? "platform-v6-empty-state" : "py-6")}>
              <p className={cn(!platformV6 && "text-[13px] text-[#9099A8]")}>
                No client IOs issued for this legal entity yet. IOs are created from
                campaign workspaces when a campaign is prepared for client approval.
              </p>
            </div>
          ) : (
            <div className={cn("overflow-x-auto", !platformV6 && "-mx-[22px]")}>
              <ClientIosTable
                rows={rows}
                selectedId={selected?.id ?? null}
                onView={setSelectedId}
                showClientColumn={false}
                platformV6={platformV6}
              />
            </div>
          )}
        </ClientFormSection>
      </OperationalTableSuiteProvider>

      {selected ? (
        <ClientFormSection
          icon={FileTextIcon}
          title={selected.document_number ?? "Client IO detail"}
          description={`Review and manage ${selected.brand_name ?? "this IO"}.`}
          className={platformV6 ? "mt-3.5" : undefined}
        >
          <ClientIoForm
            key={selected.id}
            row={selected}
            recipients={recipients}
            clientDefaultTermsText={selected.client_io_terms_text ?? clientIoTermsText}
            brandName={selected.brand_name}
          />
        </ClientFormSection>
      ) : null}
    </ClientProfileTabShell>
  );
}

```

#### `features/clients/components/tabs/client-documents-tab.tsx`

```tsx
"use client";

import { useMemo } from "react";

import {
  deleteClientDocumentAction,
  getClientDocumentDownloadUrlAction,
} from "@/features/clients/actions";
import { uploadClientDocumentViaApi } from "@/features/clients/client-document-upload-api";
import {
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  labelForOption,
} from "@/features/clients/constants";
import { DocumentWorkspace } from "@/features/documents";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { CLIENT_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import type { ClientDetail } from "@/types/database";
import type { DocumentFilterAccessors } from "@/features/documents/document-types";

export function ClientDocumentsTab({ client }: { client: ClientDetail }) {
  const config = useMemo(
    () => ({
      entityKind: "client" as const,
      tableId: OPERATIONAL_TABLE_IDS.clientDocuments,
      contextLabel: "Client documents",
      documentTypeOptions: CLIENT_DOCUMENT_TYPE_OPTIONS,
      filterAccessors:
        CLIENT_DOCUMENTS_FILTER_ACCESSORS as DocumentFilterAccessors<
          ClientDetail["documents"][number]
        >,
      entityIdField: "client_id",
      getDownloadUrl: getClientDocumentDownloadUrlAction,
      deleteAction: deleteClientDocumentAction,
      uploadViaApi: uploadClientDocumentViaApi,
      resolveTypeLabel: (documentType: string) =>
        labelForOption(CLIENT_DOCUMENT_TYPE_OPTIONS, documentType),
    }),
    []
  );

  return (
    <DocumentWorkspace
      entityId={client.id}
      documents={client.documents}
      config={config}
    />
  );
}

```

#### `features/clients/components/tabs/client-finance-tab.tsx`

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { DollarSignIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { PlatformV6ToggleRow } from "@/components/platform/platform-v6-layout";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ClientFormField,
  ClientFormGrid,
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  ClientProfileTabShell,
  CLIENT_FORM_FIELD_HINT_CLASS,
  CLIENT_FORM_FIELD_LABEL_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import {
  updateClientFinanceAction,
  type FormActionState,
} from "@/features/clients/actions";
import { PAYMENT_TERMS_OPTIONS } from "@/features/clients/constants";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

function CreditLimitToggleFields({
  creditLimitActive,
  acceptCreditRisk,
  onCreditLimitActiveChange,
  onAcceptCreditRiskChange,
  disabled,
}: {
  creditLimitActive: boolean;
  acceptCreditRisk: boolean;
  onCreditLimitActiveChange: (value: boolean) => void;
  onAcceptCreditRiskChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-toggle-grid">
        <PlatformV6ToggleRow
          id="credit_limit_active"
          title="CL Active"
          description="Enforce credit limit on new campaign creation when a limit is set."
          checked={creditLimitActive}
          onCheckedChange={onCreditLimitActiveChange}
          disabled={disabled}
        />
        <PlatformV6ToggleRow
          id="accept_credit_risk"
          title="Accept risk"
          description="Allow users to acknowledge and proceed when exposure exceeds the limit."
          checked={acceptCreditRisk}
          onCheckedChange={onAcceptCreditRiskChange}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-[18px] rounded-[12px] border border-border bg-muted p-[18px] sm:grid-cols-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className={CLIENT_FORM_FIELD_LABEL_CLASS}>CL Active</p>
          <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
            Enforce credit limit on new campaign creation when a limit is set.
          </p>
        </div>
        <Switch
          id="credit_limit_active"
          checked={creditLimitActive}
          onCheckedChange={onCreditLimitActiveChange}
          disabled={disabled}
        />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className={CLIENT_FORM_FIELD_LABEL_CLASS}>Accept risk</p>
          <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
            Allow users to acknowledge and proceed when exposure exceeds the limit.
          </p>
        </div>
        <Switch
          id="accept_credit_risk"
          checked={acceptCreditRisk}
          onCheckedChange={onAcceptCreditRiskChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function ClientFinanceTab({
  client,
  currencyOptions,
  onCancel,
  shortcutsEnabled = true,
}: {
  client: ClientDetail;
  currencyOptions: { value: string; label: string }[];
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const [currency, setCurrency] = useState(client.currency);
  const [paymentTerms, setPaymentTerms] = useState(client.payment_terms ?? "");
  const [creditLimit, setCreditLimit] = useState(
    client.credit_limit != null ? String(client.credit_limit) : ""
  );
  const [creditLimitActive, setCreditLimitActive] = useState(
    client.credit_limit_active ?? false
  );
  const [acceptCreditRisk, setAcceptCreditRisk] = useState(
    client.accept_credit_risk ?? false
  );
  const [billingEmail, setBillingEmail] = useState(client.billing_email ?? "");
  const [billingPhone, setBillingPhone] = useState(client.billing_phone ?? "");
  const [isDirty, setIsDirty] = useState(false);

  const [state, formAction, isPending] = useActionState(
    updateClientFinanceAction,
    { ok: false } satisfies FormActionState
  );

  function markDirty() {
    setIsDirty(true);
  }

  function discardChanges() {
    setCurrency(client.currency);
    setPaymentTerms(client.payment_terms ?? "");
    setCreditLimit(client.credit_limit != null ? String(client.credit_limit) : "");
    setCreditLimitActive(client.credit_limit_active ?? false);
    setAcceptCreditRisk(client.accept_credit_risk ?? false);
    setBillingEmail(client.billing_email ?? "");
    setBillingPhone(client.billing_phone ?? "");
    setIsDirty(false);
  }

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      setIsDirty(false);
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <>
      <ClientFormKeyboardShortcuts
        formId="client-finance-form"
        enabled={shortcutsEnabled}
        disabled={isPending}
      />
      <ClientProfileTabShell
        title="Finance"
        description="Billing defaults and credit settings for this legal entity."
        onCancel={onCancel}
        saveFormId="client-finance-form"
        saveLabel="Save finance"
        saveDisabled={isPending}
        isSaving={isPending}
        isDirty={isDirty}
        onDiscard={discardChanges}
        discardDisabled={isPending}
      >
        <form id="client-finance-form" action={formAction} className="grid gap-[18px]">
          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="payment_terms" value={paymentTerms} />
          <input
            type="hidden"
            name="credit_limit_active"
            value={creditLimitActive ? "true" : "false"}
          />
          <input
            type="hidden"
            name="accept_credit_risk"
            value={acceptCreditRisk ? "true" : "false"}
          />

          <ClientFormSection
            icon={DollarSignIcon}
            title="Billing defaults"
            description="Currency, payment terms, and credit limit."
          >
            <ClientFormGrid
              columns={platformV6 ? 4 : undefined}
              className={cn(!platformV6 && "lg:grid-cols-3", platformV6 && "mb-5")}
            >
              <ClientFormField label="Currency">
                <Select
                  value={currency}
                  onValueChange={(value) => {
                    setCurrency(value);
                    markDirty();
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClientFormField>
              <ClientFormField label="Payment terms">
                <Select
                  value={paymentTerms}
                  onValueChange={(value) => {
                    setPaymentTerms(value);
                    markDirty();
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ClientFormField>
              <ClientFormField label="Credit limit" htmlFor="credit_limit">
                <Input
                  id="credit_limit"
                  name="credit_limit"
                  type="number"
                  min={0}
                  step="0.01"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={creditLimit}
                  onChange={(e) => {
                    setCreditLimit(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.credit_limit} />
              </ClientFormField>
              {platformV6 ? <div className="hidden md:block" aria-hidden /> : null}
            </ClientFormGrid>

            <CreditLimitToggleFields
              creditLimitActive={creditLimitActive}
              acceptCreditRisk={acceptCreditRisk}
              onCreditLimitActiveChange={(value) => {
                setCreditLimitActive(value);
                markDirty();
              }}
              onAcceptCreditRiskChange={(value) => {
                setAcceptCreditRisk(value);
                markDirty();
              }}
              disabled={isPending}
            />
            {!creditLimitActive ? (
              <p className={cn(CLIENT_FORM_FIELD_HINT_CLASS, "mt-3")}>
                Credit limit not active — finance approval is not required for onboarding.
              </p>
            ) : null}
          </ClientFormSection>

          <ClientFormSection
            icon={MailIcon}
            title="Billing contacts"
            description="Where invoices and payment notices are sent."
          >
            <ClientFormGrid columns={platformV6 ? 3 : undefined}>
              <ClientFormField label="Billing email" htmlFor="billing_email">
                <Input
                  id="billing_email"
                  name="billing_email"
                  type="email"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={billingEmail}
                  onChange={(e) => {
                    setBillingEmail(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </ClientFormField>
              <ClientFormField label="Billing phone" htmlFor="billing_phone">
                <Input
                  id="billing_phone"
                  name="billing_phone"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={billingPhone}
                  onChange={(e) => {
                    setBillingPhone(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </ClientFormField>
              {platformV6 ? <div className="hidden md:block" aria-hidden /> : null}
            </ClientFormGrid>
          </ClientFormSection>
        </form>
      </ClientProfileTabShell>
    </>
  );
}

```

#### `features/clients/components/tabs/client-legal-tab.tsx`

```tsx
"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, ClipboardListIcon, MapPinIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PLATFORM_V6_ICON_AMBER } from "@/components/platform/platform-v6-layout";
import { Input } from "@/components/ui/input";
import {
  ClientFormField,
  ClientFormGrid,
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  ClientProfileTabShell,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/clients/components/client-form-ui";
import {
  ClientInlineDocumentAttach,
  findClientDocumentByType,
} from "@/features/clients/components/client-inline-document-attach";
import {
  updateClientLegalAction,
  type FormActionState,
} from "@/features/clients/actions";
import {
  COUNTRY_OPTIONS,
  getCityOptionsForCountry,
} from "@/features/clients/constants";
import { assessClientLegalReadiness } from "@/lib/clients/legal-readiness";
import { assessClientTaxReadiness } from "@/lib/clients/tax-readiness";
import type { ClientDetail } from "@/types/database";
import { cn } from "@/lib/utils";

function readAddress(
  address: Record<string, unknown>,
  key: string
): string {
  const value = address[key];
  return typeof value === "string" ? value : "";
}

export function ClientLegalTab({
  client,
  onCancel,
  shortcutsEnabled = true,
}: {
  client: ClientDetail;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
}) {
  const router = useRouter();
  const legal = client.legal_address ?? {};
  const [legalCountry, setLegalCountry] = useState(
    readAddress(legal, "country") || client.country || ""
  );
  const [legalCity, setLegalCity] = useState(
    readAddress(legal, "city") || client.city || ""
  );
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState(
    client.trade_license_number ?? ""
  );
  const [tradeLicenseExpiry, setTradeLicenseExpiry] = useState(
    client.trade_license_expiry ?? ""
  );
  const [vatNumber, setVatNumber] = useState(client.vat_number ?? "");
  const [taxId, setTaxId] = useState(client.tax_id ?? "");
  const [addressLine1, setAddressLine1] = useState(readAddress(legal, "line1"));
  const [addressLine2, setAddressLine2] = useState(readAddress(legal, "line2"));
  const [postalCode, setPostalCode] = useState(readAddress(legal, "postal_code"));
  const [isDirty, setIsDirty] = useState(false);

  const cityOptions = useMemo(() => {
    const options = getCityOptionsForCountry(legalCountry);
    if (legalCity && !options.some((option) => option.value === legalCity)) {
      return [{ value: legalCity, label: legalCity }, ...options];
    }
    return options;
  }, [legalCountry, legalCity]);

  const tradeLicenseDoc = findClientDocumentByType(client.documents, "trade_license");
  const vatDoc = findClientDocumentByType(client.documents, "vat_certificate");
  const taxDoc = findClientDocumentByType(client.documents, "tax_certificate");

  const legalReadiness = useMemo(
    () =>
      assessClientLegalReadiness({
        trade_license_number: tradeLicenseNumber,
        trade_license_expiry: tradeLicenseExpiry,
        vat_number: vatNumber,
        legal_address: {
          line1: addressLine1,
          line2: addressLine2,
          city: legalCity,
          country: legalCountry,
          postal_code: postalCode,
        },
        documentTypes: client.documents.map((doc) => doc.document_type),
      }),
    [
      tradeLicenseNumber,
      tradeLicenseExpiry,
      vatNumber,
      addressLine1,
      addressLine2,
      legalCity,
      legalCountry,
      postalCode,
      client.documents,
    ]
  );

  const taxReadiness = useMemo(
    () =>
      assessClientTaxReadiness({
        tax_id: taxId,
        documentTypes: client.documents.map((doc) => doc.document_type),
      }),
    [taxId, client.documents]
  );

  const pendingItems = useMemo(() => {
    const items: string[] = [];
    if (!client.legal_completed_at) {
      items.push(...legalReadiness.missing);
    }
    if (!client.tax_completed_at) {
      items.push(...taxReadiness.missing);
    }
    return items;
  }, [
    client.legal_completed_at,
    client.tax_completed_at,
    legalReadiness.missing,
    taxReadiness.missing,
  ]);

  const showLegalPendingBanner =
    (client.onboarding_status === "legal_pending" && !client.legal_completed_at) ||
    (!client.tax_completed_at && pendingItems.length > 0);

  const [state, formAction, isPending] = useActionState(
    updateClientLegalAction,
    { ok: false } satisfies FormActionState
  );

  function markDirty() {
    setIsDirty(true);
  }

  function discardChanges() {
    setLegalCountry(readAddress(legal, "country") || client.country || "");
    setLegalCity(readAddress(legal, "city") || client.city || "");
    setTradeLicenseNumber(client.trade_license_number ?? "");
    setTradeLicenseExpiry(client.trade_license_expiry ?? "");
    setVatNumber(client.vat_number ?? "");
    setTaxId(client.tax_id ?? "");
    setAddressLine1(readAddress(legal, "line1"));
    setAddressLine2(readAddress(legal, "line2"));
    setPostalCode(readAddress(legal, "postal_code"));
    setIsDirty(false);
  }

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      setIsDirty(false);
      router.refresh();
      return;
    }
    toast.error(state.message);
  }, [state, router]);

  return (
    <>
      <ClientFormKeyboardShortcuts
        formId="client-legal-form"
        enabled={shortcutsEnabled}
        disabled={isPending}
      />
      <ClientProfileTabShell
        title="Legal & compliance"
        description="Registration numbers, certificates, and registered address for this legal entity."
        onCancel={onCancel}
        saveFormId="client-legal-form"
        saveLabel="Save legal"
        saveDisabled={isPending}
        isSaving={isPending}
        isDirty={isDirty}
        onDiscard={discardChanges}
        discardDisabled={isPending}
      >
        <form
          id="client-legal-form"
          action={formAction}
          className="grid gap-[18px]"
          onSubmit={(event) => {
            if (isPending) {
              event.preventDefault();
            }
          }}
        >
          {showLegalPendingBanner ? (
            <div
              className={cn(
                "rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground",
                pendingItems.length === 0 && "border-primary/30 bg-primary/10"
              )}
              role="status"
            >
              <div className="flex items-start gap-2">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">
                    {pendingItems.length === 0
                      ? "All legal and tax requirements are met. Save legal to advance onboarding."
                      : "Complete the items below, then click Save legal."}
                  </p>
                  {pendingItems.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {pendingItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <input type="hidden" name="client_id" value={client.id} />
          <input type="hidden" name="legal_address_country" value={legalCountry} />
          <input type="hidden" name="legal_address_city" value={legalCity} />

          <ClientFormSection
            icon={ClipboardListIcon}
            title="Registration & certificates"
            description="Attach certificates using the controls beside each field."
          >
            <ClientFormGrid columns={4}>
              <ClientFormField label="Trade license / CR" htmlFor="trade_license_number">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <ClientInlineDocumentAttach
                    clientId={client.id}
                    documentType="trade_license"
                    document={tradeLicenseDoc}
                  />
                  <Input
                    id="trade_license_number"
                    name="trade_license_number"
                    className={cn(CLIENT_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                    value={tradeLicenseNumber}
                    onChange={(e) => {
                      setTradeLicenseNumber(e.target.value);
                      markDirty();
                    }}
                    disabled={isPending}
                  />
                </div>
              </ClientFormField>
              <ClientFormField label="Trade license expiry" htmlFor="trade_license_expiry" hint="Required for legal approval">
                <Input
                  id="trade_license_expiry"
                  name="trade_license_expiry"
                  type="date"
                  required
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={tradeLicenseExpiry}
                  onChange={(e) => {
                    setTradeLicenseExpiry(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </ClientFormField>
              <ClientFormField label="VAT number" htmlFor="vat_number">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <ClientInlineDocumentAttach
                    clientId={client.id}
                    documentType="vat_certificate"
                    document={vatDoc}
                  />
                  <Input
                    id="vat_number"
                    name="vat_number"
                    className={cn(CLIENT_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                    value={vatNumber}
                    onChange={(e) => {
                      setVatNumber(e.target.value);
                      markDirty();
                    }}
                    disabled={isPending}
                  />
                </div>
              </ClientFormField>
              <ClientFormField label="Tax ID" htmlFor="tax_id">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <ClientInlineDocumentAttach
                    clientId={client.id}
                    documentType="tax_certificate"
                    document={taxDoc}
                  />
                  <Input
                    id="tax_id"
                    name="tax_id"
                    className={cn(CLIENT_FORM_INPUT_CLASS, "min-w-0 flex-1")}
                    value={taxId}
                    onChange={(e) => {
                      setTaxId(e.target.value);
                      markDirty();
                    }}
                    disabled={isPending}
                  />
                </div>
              </ClientFormField>
            </ClientFormGrid>
          </ClientFormSection>

          <ClientFormSection
            icon={MapPinIcon}
            iconClassName={PLATFORM_V6_ICON_AMBER}
            title="Registered address"
            description="Legal address on file for compliance and invoicing."
          >
            <ClientFormGrid className="sm:grid-cols-2">
              <ClientFormField label="Legal address line 1" htmlFor="legal_address_line1">
                <Input
                  id="legal_address_line1"
                  name="legal_address_line1"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={addressLine1}
                  onChange={(e) => {
                    setAddressLine1(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.legal_address_line1} />
              </ClientFormField>

              <ClientFormField label="Legal address line 2" htmlFor="legal_address_line2">
                <Input
                  id="legal_address_line2"
                  name="legal_address_line2"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={addressLine2}
                  onChange={(e) => {
                    setAddressLine2(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </ClientFormField>
            </ClientFormGrid>

            <ClientFormGrid columns={4} className="mt-4">
              <ClientFormField label="Country">
                <SearchableSelect
                  value={legalCountry}
                  onValueChange={(value) => {
                    setLegalCountry(value);
                    setLegalCity("");
                    markDirty();
                  }}
                  options={COUNTRY_OPTIONS}
                  disabled={isPending}
                  className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
                />
              </ClientFormField>
              <ClientFormField label="City">
                <SearchableSelect
                  value={legalCity}
                  onValueChange={(value) => {
                    setLegalCity(value);
                    markDirty();
                  }}
                  options={cityOptions}
                  disabled={isPending || !legalCountry}
                  placeholder={legalCountry ? "Select city" : "Select country first"}
                  className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
                />
              </ClientFormField>
              <ClientFormField label="Postal code" htmlFor="legal_address_postal">
                <Input
                  id="legal_address_postal"
                  name="legal_address_postal"
                  className={CLIENT_FORM_INPUT_CLASS}
                  value={postalCode}
                  onChange={(e) => {
                    setPostalCode(e.target.value);
                    markDirty();
                  }}
                  disabled={isPending}
                />
              </ClientFormField>
              <div className="hidden md:block" aria-hidden />
            </ClientFormGrid>
          </ClientFormSection>
        </form>
      </ClientProfileTabShell>
    </>
  );
}

```

#### `features/clients/components/tabs/client-overview-tab.tsx`

```tsx
"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseIcon,
  FileTextIcon,
  MapPinIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { ClientCategoryFields } from "@/components/forms/client-category-fields";
import type { ClientCategorySuggestionState } from "@/components/forms/client-category-suggestion";
import { useClientCategoryClassification } from "@/components/forms/use-client-category-classification";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ClientFormField,
  ClientFormGrid,
  ClientFormKeyboardShortcuts,
  ClientFormSection,
  ClientProfileTabShell,
  CLIENT_FORM_FIELD_HINT_CLASS,
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS,
} from "@/features/clients/components/client-form-ui";
import {
  updateClientOverviewAction,
  type ClientOverviewSavePatch,
  type FormActionState,
} from "@/features/clients/actions";
import { ClientIoTermsEditor } from "@/features/io/components/client-io-terms-editor";
import { CLIENT_IO_DEFAULT_TERMS } from "@/lib/io/client-io-default-terms";
import {
  parseTermsText,
  serializeTermsText,
  termsAreEqual,
  type ClientIoTerm,
} from "@/lib/io/client-io-terms";
import {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  COUNTRY_OPTIONS,
  getCityOptionsForCountry,
} from "@/features/clients/constants";
import { assessClientOverviewCommercialReadiness } from "@/lib/clients/client-profile-readiness";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { AgencyOrDirect, ClientDetail, ClientStatus } from "@/types/database";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  PLATFORM_V6_ICON_AMBER,
  PLATFORM_V6_ICON_GREEN,
} from "@/components/platform/platform-v6-layout";

type ClientOverviewTabProps = {
  client: ClientDetail;
  groups: { id: string; name: string; document_number: string }[];
  masterData: MasterDataOptions;
  onCancel?: () => void;
  /** When false, Ctrl+S is not wired to this form (e.g. another profile tab is active). */
  shortcutsEnabled?: boolean;
  onboardingSlot?: ReactNode;
  /** Applies persisted overview fields returned by the save action. */
  onClientPatch?: (patch: ClientOverviewSavePatch) => void;
};

export function ClientOverviewTab({
  client,
  groups,
  masterData,
  onCancel,
  shortcutsEnabled = true,
  onboardingSlot,
  onClientPatch,
}: ClientOverviewTabProps) {
  const router = useRouter();
  const [status, setStatus] = useState(client.status);
  const [groupId, setGroupId] = useState(client.group_id ?? "");
  const [displayName, setDisplayName] = useState(client.name);
  const [country, setCountry] = useState(client.country ?? "");
  const [city, setCity] = useState(client.city ?? "");
  const [categorySlug, setCategorySlug] = useState(client.client_category ?? "");
  const [subcategorySlug, setSubcategorySlug] = useState(
    client.client_subcategory ?? ""
  );
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [classificationMeta, setClassificationMeta] =
    useState<ClientCategorySuggestionState | null>(() => {
      if (
        client.client_category &&
        client.client_subcategory &&
        client.approved_by_user
      ) {
        return {
          categorySlug: client.client_category,
          subcategorySlug: client.client_subcategory,
          confidence: client.classification_confidence ?? 100,
          source:
            (client.classification_source as ClientCategorySuggestionState["source"]) ??
            "approved",
          reason: client.classification_reason ?? undefined,
        };
      }
      return null;
    });
  const [vrRateId, setVrRateId] = useState(client.vr_rate_id ?? "");
  const [agencyOrDirect, setAgencyOrDirect] = useState<AgencyOrDirect>(
    (client.agency_or_direct ?? "agency") as AgencyOrDirect
  );
  const [legalName, setLegalName] = useState(client.legal_name ?? "");
  const [nameAr, setNameAr] = useState(client.name_ar ?? "");
  const [website, setWebsite] = useState(client.website ?? "");
  const [billingEmail, setBillingEmail] = useState(client.billing_email ?? "");
  const [billingPhone, setBillingPhone] = useState(client.billing_phone ?? "");
  const [notes, setNotes] = useState(client.notes ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const cityOptions = useMemo(() => {
    const options = getCityOptionsForCountry(country);
    if (city && !options.some((option) => option.value === city)) {
      return [{ value: city, label: city }, ...options];
    }
    return options;
  }, [country, city]);

  const {
    suggestion,
    resetClassificationRequest,
  } = useClientCategoryClassification({
    companyName: displayName,
    country,
    website: website || undefined,
    clientId: client.id,
    useStoredApproved:
      !categoryManuallySet &&
      Boolean(client.approved_by_user && client.client_category),
    enabled: !categoryManuallySet,
    onClassified: (result) => {
      if (!categoryManuallySet) {
        setCategorySlug(result.categorySlug);
        setSubcategorySlug(result.subcategorySlug);
        setClassificationMeta(result);
      }
    },
  });

  // Silently pre-fill category when classification returns and fields are empty.
  useEffect(() => {
    if (
      !categoryManuallySet &&
      suggestion &&
      !categorySlug &&
      !subcategorySlug
    ) {
      setCategorySlug(suggestion.categorySlug);
      setSubcategorySlug(suggestion.subcategorySlug);
      setClassificationMeta(suggestion);
    }
  }, [categoryManuallySet, suggestion, categorySlug, subcategorySlug]);

  const [ioTerms, setIoTerms] = useState<ClientIoTerm[]>(
    () => parseTermsText(client.client_io_terms_text) ?? CLIENT_IO_DEFAULT_TERMS
  );
  const [usePlatformIoTerms, setUsePlatformIoTerms] = useState(
    () => !parseTermsText(client.client_io_terms_text)
  );

  function markDirty() {
    setIsDirty(true);
  }

  function buildClassificationMetaFromClient(): ClientCategorySuggestionState | null {
    if (
      client.client_category &&
      client.client_subcategory &&
      client.approved_by_user
    ) {
      return {
        categorySlug: client.client_category,
        subcategorySlug: client.client_subcategory,
        confidence: client.classification_confidence ?? 100,
        source:
          (client.classification_source as ClientCategorySuggestionState["source"]) ??
          "approved",
        reason: client.classification_reason ?? undefined,
      };
    }
    return null;
  }

  function discardChanges() {
    setStatus(client.status);
    setGroupId(client.group_id ?? "");
    setDisplayName(client.name);
    setCountry(client.country ?? "");
    setCity(client.city ?? "");
    setCategorySlug(client.client_category ?? "");
    setSubcategorySlug(client.client_subcategory ?? "");
    setCategoryManuallySet(false);
    setClassificationMeta(buildClassificationMetaFromClient());
    setVrRateId(client.vr_rate_id ?? "");
    setAgencyOrDirect((client.agency_or_direct ?? "agency") as AgencyOrDirect);
    setLegalName(client.legal_name ?? "");
    setNameAr(client.name_ar ?? "");
    setWebsite(client.website ?? "");
    setBillingEmail(client.billing_email ?? "");
    setBillingPhone(client.billing_phone ?? "");
    setNotes(client.notes ?? "");
    setIoTerms(
      parseTermsText(client.client_io_terms_text) ?? CLIENT_IO_DEFAULT_TERMS
    );
    setUsePlatformIoTerms(!parseTermsText(client.client_io_terms_text));
    resetClassificationRequest();
    setIsDirty(false);
    setFormKey((key) => key + 1);
  }

  function handleCancel() {
    discardChanges();
    onCancel?.();
  }

  const [state, formAction, isPending] = useActionState(
    updateClientOverviewAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      setIsDirty(false);
      if (state.clientPatch) {
        setGroupId(state.clientPatch.group_id ?? "");
        onClientPatch?.(state.clientPatch);
      }
      router.refresh();
      return;
    }

    const fieldMessages = state.fieldErrors
      ? Object.values(state.fieldErrors).flat().filter(Boolean)
      : [];
    toast.error(fieldMessages.length > 0 ? fieldMessages[0] : state.message);
  }, [state, router, onClientPatch]);

  useEffect(() => {
    if (isDirty) {
      return;
    }
    setGroupId(client.group_id ?? "");
  }, [client.group_id, client.id, isDirty]);

  const groupOptions = groups.map((g) => ({
    value: g.id,
    label: g.name,
  }));

  const commercialReadiness = useMemo(
    () => assessClientOverviewCommercialReadiness(client),
    [client]
  );

  const clientIoTermsPayload =
    usePlatformIoTerms || termsAreEqual(ioTerms, CLIENT_IO_DEFAULT_TERMS)
      ? ""
      : serializeTermsText(ioTerms);

  return (
    <>
    <ClientFormKeyboardShortcuts
      formId="client-overview-form"
      enabled={shortcutsEnabled}
      disabled={isPending}
    />
    <ClientProfileTabShell
      title="Edit legal entity"
      description="Update the client's profile, billing, and default insertion-order terms."
      beforeHeader={onboardingSlot}
      onCancel={handleCancel}
      saveFormId="client-overview-form"
      saveDisabled={isPending}
      isSaving={isPending}
      isDirty={isDirty}
      onDiscard={discardChanges}
      discardDisabled={isPending}
    >
        <form
          key={formKey}
          id="client-overview-form"
          action={formAction}
          className="grid gap-[18px]"
          onSubmit={(event) => {
            if (isPending) {
              event.preventDefault();
            }
          }}
        >
        <input type="hidden" name="client_id" value={client.id} />
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="country" value={country} />
        <input type="hidden" name="city" value={city} />
        <input type="hidden" name="client_category" value={categorySlug} />
        <input type="hidden" name="client_subcategory" value={subcategorySlug} />
        <input
          type="hidden"
          name="classification_source"
          value={classificationMeta?.source ?? ""}
        />
        <input
          type="hidden"
          name="classification_confidence"
          value={classificationMeta?.confidence ?? ""}
        />
        <input
          type="hidden"
          name="classification_reason"
          value={classificationMeta?.reason ?? ""}
        />
        <input
          type="hidden"
          name="suggestion_accepted"
          value={String(
            !categoryManuallySet && Boolean(classificationMeta) ? true : false
          )}
        />
        <input
          type="hidden"
          name="category_manually_set"
          value={String(categoryManuallySet)}
        />
        <input type="hidden" name="vr_rate_id" value={vrRateId} />
        <input type="hidden" name="agency_or_direct" value={agencyOrDirect} />
        <input type="hidden" name="client_io_terms_text" value={clientIoTermsPayload} />

        {state.fieldErrors && !state.ok ? (
          <p className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {Object.entries(state.fieldErrors)
              .flatMap(([field, messages]) =>
                (messages ?? []).map((message) => `${field}: ${message}`)
              )
              .join(" · ")}
          </p>
        ) : null}

        {!groupId ? (
          <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
            <p className="font-medium">No holding group linked</p>
            <p className="mt-1 text-[12px] text-amber-900/80">
              Holding groups are optional. Link one below only if this legal entity belongs
              to a holding group — brands can be added either way.
            </p>
          </div>
        ) : null}

        {!commercialReadiness.complete ? (
          <div className="rounded-[10px] border border-amber-300/80 bg-amber-50 px-4 py-3 text-[12px] text-amber-950">
            <p className="font-medium">Commercial profile incomplete</p>
            <p className="mt-1 text-[12px] text-amber-900/80">
              Complete the fields below. Default VR% is optional and does not affect
              onboarding progress.
            </p>
            <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-amber-900">
              {commercialReadiness.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <ClientFormSection
          icon={UserIcon}
          title="Identity"
          description="Legal entity name and status"
        >
          <ClientFormGrid columns={3}>
            <ClientFormField label="Client name (English)" htmlFor="name">
              <Input
                id="name"
                name="name"
                className={CLIENT_FORM_INPUT_CLASS}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setCategoryManuallySet(false);
                  resetClassificationRequest();
                  markDirty();
                }}
                required
                disabled={isPending}
                placeholder="e.g. Mindshare LTD"
              />
              <FieldError messages={state.fieldErrors?.name} />
            </ClientFormField>
            <ClientFormField label="Client name (Arabic)" htmlFor="name_ar">
              <Input
                id="name_ar"
                name="name_ar"
                className={CLIENT_FORM_INPUT_CLASS}
                value={nameAr}
                onChange={(e) => {
                  setNameAr(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
                placeholder="Optional Arabic legal name"
                dir="rtl"
              />
              <FieldError messages={state.fieldErrors?.name_ar} />
            </ClientFormField>
            <ClientFormField label="Legal name" htmlFor="legal_name">
              <Input
                id="legal_name"
                name="legal_name"
                className={CLIENT_FORM_INPUT_CLASS}
                value={legalName}
                onChange={(e) => {
                  setLegalName(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.legal_name} />
            </ClientFormField>
          </ClientFormGrid>

          <ClientFormGrid columns={3}>
            <ClientFormField label="Status">
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v as ClientStatus);
                  markDirty();
                }}
                disabled={isPending}
              >
                <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ClientFormField>
            <div className="hidden md:block" aria-hidden />
            <div className="hidden md:block" aria-hidden />
          </ClientFormGrid>
        </ClientFormSection>

        <ClientFormSection
          icon={BriefcaseIcon}
          iconClassName={PLATFORM_V6_ICON_GREEN}
          title="Commercial profile"
          description="Classification and rates inherited by brands and campaigns"
        >
          <ClientFormGrid columns={3}>
            <ClientFormField
              label="Holding group (optional)"
              hint="Only if this legal entity belongs to a holding group."
            >
              <SearchableSelect
                value={groupId}
                onValueChange={(value) => {
                  setGroupId(value);
                  markDirty();
                }}
                options={groupOptions}
                disabled={isPending}
                placeholder={
                  groups.length > 0 ? "Select holding group" : "No groups yet"
                }
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <FieldError messages={state.fieldErrors?.group_id} />
              {groups.length === 0 ? (
                <p className={CLIENT_FORM_FIELD_HINT_CLASS}>
                  Create a holding group first if you need group-level reporting.
                </p>
              ) : null}
            </ClientFormField>
            <ClientFormField label="Relationship type">
              <Select
                value={agencyOrDirect}
                onValueChange={(v) => {
                  setAgencyOrDirect(v as AgencyOrDirect);
                  markDirty();
                }}
                disabled={isPending}
              >
                <SelectTrigger className={cn(CLIENT_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_OR_DIRECT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={state.fieldErrors?.agency_or_direct} />
            </ClientFormField>
            <ClientFormField
              label="Default VR%"
              hint="Brands inherit this rate unless they set an explicit VR% override."
            >
              <SearchableSelect
                value={vrRateId}
                onValueChange={(value) => {
                  setVrRateId(value);
                  markDirty();
                }}
                options={masterData.vrRates.map((rate) => ({
                  value: rate.id,
                  label: rate.name,
                }))}
                disabled={isPending}
                placeholder="Select default VR rate"
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <FieldError messages={state.fieldErrors?.vr_rate_id} />
            </ClientFormField>
          </ClientFormGrid>

          <ClientCategoryFields
            categorySlug={categorySlug}
            subcategorySlug={subcategorySlug}
            onCategoryChange={(value) => {
              setCategoryManuallySet(true);
              setCategorySlug(value);
              setClassificationMeta(null);
              markDirty();
            }}
            onSubcategoryChange={(value) => {
              setCategoryManuallySet(true);
              setSubcategorySlug(value);
              setClassificationMeta(null);
              markDirty();
            }}
            disabled={isPending}
            layout="grid"
          />
          <FieldError messages={state.fieldErrors?.client_category} />
          <FieldError messages={state.fieldErrors?.client_subcategory} />

          <ClientFormGrid columns={3}>
            <ClientFormField label="Website" htmlFor="website">
              <Input
                id="website"
                name="website"
                type="url"
                className={CLIENT_FORM_INPUT_CLASS}
                value={website}
                onChange={(e) => {
                  setWebsite(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
                placeholder="https://"
              />
              <FieldError messages={state.fieldErrors?.website} />
            </ClientFormField>
            <div className="hidden md:block" aria-hidden />
            <div className="hidden md:block" aria-hidden />
          </ClientFormGrid>
        </ClientFormSection>

        <ClientFormSection
          icon={MapPinIcon}
          iconClassName={PLATFORM_V6_ICON_AMBER}
          title="Location & billing"
          description="Where invoices are sent"
        >
          <ClientFormGrid columns={3}>
            <ClientFormField label="Country">
              <SearchableSelect
                value={country}
                onValueChange={(value) => {
                  setCountry(value);
                  setCity("");
                  markDirty();
                }}
                options={COUNTRY_OPTIONS}
                disabled={isPending}
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
            </ClientFormField>
            <ClientFormField label="City">
              <SearchableSelect
                value={city}
                onValueChange={(value) => {
                  setCity(value);
                  markDirty();
                }}
                options={cityOptions}
                disabled={isPending || !country}
                placeholder={country ? "Select city" : "Select country first"}
                className={CLIENT_FORM_SELECT_TRIGGER_CLASS}
              />
              <FieldError messages={state.fieldErrors?.city} />
            </ClientFormField>
            <div className="hidden md:block" aria-hidden />
          </ClientFormGrid>

          <ClientFormGrid columns={3}>
            <ClientFormField label="Billing email" htmlFor="billing_email">
              <Input
                id="billing_email"
                name="billing_email"
                type="email"
                className={CLIENT_FORM_INPUT_CLASS}
                value={billingEmail}
                onChange={(e) => {
                  setBillingEmail(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
                placeholder="billing@company.com"
              />
            </ClientFormField>
            <ClientFormField label="Billing phone" htmlFor="billing_phone">
              <Input
                id="billing_phone"
                name="billing_phone"
                className={CLIENT_FORM_INPUT_CLASS}
                value={billingPhone}
                onChange={(e) => {
                  setBillingPhone(e.target.value);
                  markDirty();
                }}
                disabled={isPending}
                placeholder="+20 1XX XXX XXXX"
              />
            </ClientFormField>
            <div className="hidden md:block" aria-hidden />
          </ClientFormGrid>

          <ClientFormField label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              className={CLIENT_FORM_TEXTAREA_CLASS}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                markDirty();
              }}
              disabled={isPending}
              placeholder="Internal notes about this client…"
            />
          </ClientFormField>
        </ClientFormSection>

        <ClientFormSection
          icon={FileTextIcon}
          title="Default Client IO terms"
          description="These become the default for all Client IOs on this legal entity"
        >
          <ClientIoTermsEditor
            terms={ioTerms}
            onChange={(next) => {
              setIoTerms(next);
              setUsePlatformIoTerms(false);
              markDirty();
            }}
            onRecover={() => {
              setIoTerms(CLIENT_IO_DEFAULT_TERMS);
              setUsePlatformIoTerms(true);
              markDirty();
            }}
            disabled={isPending}
          />
        </ClientFormSection>
        </form>
    </ClientProfileTabShell>
    </>
  );
}

```

#### `features/clients/constants.ts`

```ts
import type { ClientStatus } from "@/types/database";
import {
  CLIENT_INDUSTRY_OPTIONS,
} from "@/lib/master-data/constants";
import { getCityOptionsForCountry } from "@/lib/master-data/cities";

export const CLIENTS_PAGE_SIZE = 10;

/** @deprecated Prefer intelligence category/subcategory on clients. */
export const INDUSTRY_OPTIONS = CLIENT_INDUSTRY_OPTIONS;

export const CLIENT_STATUS_OPTIONS: {
  value: ClientStatus;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  CLIENT_INDUSTRY_OPTIONS,
  CLIENT_SUBCATEGORY_BY_CATEGORY,
  COUNTRY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  getClientSubcategoryOptions as getLegacyClientSubcategoryOptions,
  labelForOption,
} from "@/lib/master-data/constants";

export {
  getClientCategoryOptions,
  getClientSubcategoryOptions,
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";

export { getCityOptionsForCountry };

```

#### `features/groups/components/brand-sheet.tsx`

```tsx
"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { useNameAvailability } from "@/components/forms/use-name-availability";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createBrandAction, updateBrandAction } from "@/features/brands/actions";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import type { GroupBrandRow, GroupLegalEntityRow } from "@/features/groups/types";
import { checkBrandNameAvailable } from "@/features/validation/actions";
import { brandVrInheritanceHint } from "@/lib/clients/vr-inheritance";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import type { MasterDataOptions } from "@/lib/master-data/queries";
import type { ClientStatus } from "@/types/database";

type BrandSheetProps = {
  legalEntities: GroupLegalEntityRow[];
  masterData: MasterDataOptions;
  brand: GroupBrandRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, registers the sheet form for Ctrl+S shortcuts on client profile. */
  formId?: string;
};

function resolveBrandFormVrRateId(
  brand: GroupBrandRow | null,
  clientVrRateId: string | null | undefined
): string {
  if (brand?.vr_rate_id) {
    return brand.vr_rate_id;
  }
  return clientVrRateId ?? "";
}

export function BrandSheet({
  legalEntities,
  masterData,
  brand,
  open,
  onOpenChange,
  formId,
}: BrandSheetProps) {
  const currencyOptions = buildCurrencyOptions(masterData.currencies);
  const isEdit = brand !== null;
  const defaultClientId = brand?.client_id ?? legalEntities[0]?.id ?? "";

  const [clientId, setClientId] = useState(defaultClientId);
  const [brandName, setBrandName] = useState(brand?.name ?? "");
  const [vrRateId, setVrRateId] = useState("");
  const [currency, setCurrency] = useState(
    brand?.currency_code ?? DEFAULT_PLATFORM_CURRENCY
  );
  const [status, setStatus] = useState<ClientStatus>(brand?.status ?? "active");

  const selectedClient = useMemo(
    () => legalEntities.find((entity) => entity.id === clientId),
    [legalEntities, clientId]
  );
  const clientVrRateId = selectedClient?.vr_rate_id ?? null;
  const brandHasOverride = Boolean(vrRateId) && vrRateId !== (clientVrRateId ?? "");
  const vrHint = brandVrInheritanceHint(
    selectedClient?.vr_rate_percent ?? null,
    brandHasOverride
  );

  const { checking, message: duplicateMessage, isDuplicate } = useNameAvailability(
    brandName,
    checkBrandNameAvailable,
    isEdit && brand ? [clientId, brand.id] : [clientId],
    open && Boolean(clientId)
  );

  const [createState, createAction, createPending] = useActionState(
    createBrandAction,
    { ok: false }
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateBrandAction,
    { ok: false }
  );

  const state = isEdit ? updateState : createState;
  const formAction = isEdit ? updateAction : createAction;
  const isPending = isEdit ? updatePending : createPending;
  const submitDisabled = isPending || !clientId || isDuplicate || checking;

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) {
      toast.success(state.message);
      onOpenChange(false);
      return;
    }
    toast.error(state.message);
  }, [state, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const nextClientId = brand?.client_id ?? legalEntities[0]?.id ?? "";
    const nextClient = legalEntities.find((entity) => entity.id === nextClientId);
    setClientId(nextClientId);
    setBrandName(brand?.name ?? "");
    setVrRateId(resolveBrandFormVrRateId(brand, nextClient?.vr_rate_id));
    setCurrency(brand?.currency_code ?? DEFAULT_PLATFORM_CURRENCY);
    setStatus(brand?.status ?? "active");
  }, [open, brand, legalEntities]);

  useEffect(() => {
    if (!open || isEdit) return;
    setVrRateId(clientVrRateId ?? "");
  }, [open, isEdit, clientVrRateId]);

  const clientOptions = legalEntities.map((le) => ({
    value: le.id,
    label: le.name,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit brand" : "Create brand"}</SheetTitle>
          <SheetDescription>
            Commercial brand profile — VR% and currency. Category lives on the legal entity overview.
          </SheetDescription>
        </SheetHeader>
        <form
          id={formId}
          action={formAction}
          className="flex flex-1 flex-col gap-4 px-6 pb-6"
        >
          {isEdit ? <input type="hidden" name="brand_id" value={brand.id} /> : null}
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="vr_rate_id" value={vrRateId} />
          <input type="hidden" name="currency_code" value={currency} />
          {isEdit ? <input type="hidden" name="status" value={status} /> : null}

          <div className="grid gap-2">
            <Label htmlFor="brand_name">Brand name</Label>
            <Input
              id="brand_name"
              name="name"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              required
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.name} />
            {duplicateMessage ? (
              <p className="text-xs text-destructive">{duplicateMessage}</p>
            ) : checking ? (
              <p className="text-xs text-muted-foreground">Checking availability…</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Legal entity</Label>
            <SearchableSelect
              value={clientId}
              onValueChange={setClientId}
              options={clientOptions}
              disabled={isPending}
              placeholder="Select legal entity"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>VR%</Label>
              <SearchableSelect
                value={vrRateId}
                onValueChange={setVrRateId}
                options={masterData.vrRates.map((v) => ({
                  value: v.id,
                  label: v.name,
                }))}
                disabled={isPending}
                placeholder="Select VR rate"
              />
              <p className="text-xs text-muted-foreground">{vrHint}</p>
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isEdit ? (
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as ClientStatus)}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <SheetFooter className="px-0">
            <Button type="submit" disabled={submitDisabled}>
              {isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save brand"
                  : "Create brand"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

```

#### `features/io/components/client-io-email-preview.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { EyeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DetailFormSection } from "@/features/campaigns/components/operational-detail-panel";
import { ClientIoEmailViewDialog } from "@/features/io/components/client-io-email-view-dialog";
import type { ClientIoRow } from "@/features/io/types";
import {
  buildClientIoEmailPreview,
  type ClientIoEmailPreview as EmailPreview,
} from "@/lib/email/client-io-email";
import type { ClientIoRecipientEntry } from "@/lib/io/client-io-send-recipients";

type Props = {
  io: ClientIoRow;
  senderName: string | null;
  recipients: ClientIoRecipientEntry[];
  hasDocument: boolean;
};

function formatRecipients(recipients: ClientIoRecipientEntry[]): string {
  const valid = recipients.filter((r) => r.email.trim());
  if (valid.length === 0) return "—";
  return valid
    .map((r) => (r.name.trim() ? `${r.name.trim()} <${r.email.trim()}>` : r.email.trim()))
    .join(", ");
}

export function ClientIoEmailPreviewSection({ io, senderName, recipients, hasDocument }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const preview = useMemo<EmailPreview>(
    () =>
      buildClientIoEmailPreview({
        io,
        senderName,
        isDraftPreview: true,
      }),
    [io, senderName]
  );

  const validRecipients = recipients.filter((r) => r.email.trim());

  return (
    <>
      <DetailFormSection label="Email preview" className="py-3.5">
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          This is the automatic message sent from{" "}
          <strong className="font-medium text-foreground">{preview.fromEmail}</strong> when you click{" "}
          <strong className="font-medium text-foreground">Send Client IO</strong>. The subject and
          body below are generated for you — recipients do not need to draft anything.
        </p>

        <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                From
              </div>
              <div className="mt-0.5 text-foreground">
                {preview.fromName} &lt;{preview.fromEmail}&gt;
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                To
              </div>
              <div className="mt-0.5 text-foreground">{formatRecipients(recipients)}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Subject
            </div>
            <div className="mt-0.5 font-medium text-foreground">{preview.subject}</div>
          </div>

          <div className="rounded-md border border-border/50 bg-background/80 p-3 text-sm leading-relaxed text-muted-foreground">
            <p className="whitespace-pre-wrap text-foreground">{preview.plainText}</p>
          </div>

          {preview.hasPdfAttachment ? (
            <p className="text-xs text-muted-foreground">Includes PDF attachment: Client-IO.pdf</p>
          ) : hasDocument ? null : (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Generate the document before sending so the PDF can be attached.
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setDialogOpen(true)}
          >
            <EyeIcon className="mr-1.5 size-3.5" />
            View full email
          </Button>
        </div>
      </DetailFormSection>

      <ClientIoEmailViewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preview={preview}
        recipients={validRecipients}
        title="Email preview"
      />
    </>
  );
}

```

#### `features/io/components/client-io-email-view-dialog.tsx`

```tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ClientIoEmailPreview } from "@/lib/email/client-io-email";

type RecipientLine = {
  name?: string;
  email: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ClientIoEmailPreview;
  recipients?: RecipientLine[];
  title?: string;
};

export function ClientIoEmailViewDialog({
  open,
  onOpenChange,
  preview,
  recipients = [],
  title = "Client IO email",
}: Props) {
  const toLabel =
    recipients.length > 0
      ? recipients.map((r) => (r.name?.trim() ? `${r.name} <${r.email}>` : r.email)).join(", ")
      : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Automatic outbound message from Thinkway.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b border-border/60 bg-muted/15 px-6 py-4 text-sm">
          <div className="grid gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              From
            </span>
            <span className="text-foreground">
              {preview.fromName} &lt;{preview.fromEmail}&gt;
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              To
            </span>
            <span className="text-foreground">{toLabel}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Subject
            </span>
            <span className="font-medium text-foreground">{preview.subject}</span>
          </div>
          {preview.hasPdfAttachment ? (
            <p className="text-xs text-muted-foreground">Attachment: Client-IO.pdf</p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div
            className="rounded-md border border-border/60 bg-card p-4 text-sm text-foreground"
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

```

#### `features/io/components/client-io-form.tsx`

```tsx
"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailFormSection,
  DetailSheetFooter,
} from "@/features/campaigns/components/operational-detail-panel";
import { updateClientIoAction } from "@/features/io/actions";
import { generateClientIoDocumentAction } from "@/features/io/generate-client-io-document-action";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import { ClientIoViewMenu } from "@/features/io/components/client-io-view-menu";
import { ClientIoEmailPreviewSection } from "@/features/io/components/client-io-email-preview";
import { ClientIoRecipientsEditor } from "@/features/io/components/client-io-recipients-editor";
import { ClientIoSendControls } from "@/features/io/components/client-io-send-controls";
import { ClientIoSendHistory } from "@/features/io/components/client-io-send-history";
import { ClientIoTermsEditorField } from "@/features/io/components/client-io-terms-editor";
import type { ClientIoRow, ClientIoSendHistoryEntry, ClientIoSendRecipient } from "@/features/io/types";
import {
  parseSendRecipientsJson,
  seedRecipientsFromContacts,
  serializeSendRecipients,
  type ClientIoRecipientEntry,
} from "@/lib/io/client-io-send-recipients";
import {
  parseTermsText,
  resolveDefaultTermsForClient,
  serializeTermsText,
  termsAreEqual,
  type ClientIoTerm,
} from "@/lib/io/client-io-terms";

const INITIAL_STATE = { ok: false } as const;

type Props = {
  row: ClientIoRow;
  recipients: ClientIoSendRecipient[];
  sendHistory?: ClientIoSendHistoryEntry[];
  senderName?: string | null;
  clientDefaultTermsText?: string | null;
  brandName?: string | null;
};

function SummaryItem({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value?.trim() || "—"}</dd>
    </div>
  );
}

export function ClientIoForm({
  row,
  recipients,
  sendHistory = [],
  senderName = null,
  clientDefaultTermsText = null,
  brandName = null,
}: Props) {
  const defaultTerms = useMemo(
    () => resolveDefaultTermsForClient(clientDefaultTermsText),
    [clientDefaultTermsText]
  );

  const initialTerms = useMemo(() => {
    return parseTermsText(row.terms_text) ?? defaultTerms;
  }, [row.terms_text, defaultTerms]);

  const [terms, setTerms] = useState<ClientIoTerm[]>(initialTerms);
  const [useDefaultTerms, setUseDefaultTerms] = useState(() => !parseTermsText(row.terms_text));
  const [billingTerms, setBillingTerms] = useState(row.billing_terms ?? "");
  const [attachmentUrl, setAttachmentUrl] = useState(row.attachment_url ?? "");
  const [sendRecipients, setSendRecipients] = useState<ClientIoRecipientEntry[]>(() =>
    seedRecipientsFromContacts(
      parseSendRecipientsJson(row.send_recipients),
      recipients.map((r) => ({ label: r.label, email: r.email }))
    )
  );

  const [saveState, saveAction, saving] = useActionState(updateClientIoAction, INITIAL_STATE);
  const [generateState, generateAction, generating] = useActionState(
    generateClientIoDocumentAction,
    INITIAL_STATE
  );

  useEffect(() => {
    setTerms(parseTermsText(row.terms_text) ?? defaultTerms);
    setUseDefaultTerms(!parseTermsText(row.terms_text));
    setBillingTerms(row.billing_terms ?? "");
    setAttachmentUrl(row.attachment_url ?? "");
    setSendRecipients(parseSendRecipientsJson(row.send_recipients));
  }, [row, defaultTerms]);

  useEffect(() => {
    if (!saveState.message) return;
    if (saveState.ok) toast.success(saveState.message);
    else toast.error(saveState.message);
  }, [saveState]);

  useEffect(() => {
    if (!generateState.message) return;
    if (generateState.ok) toast.success(generateState.message);
    else toast.error(generateState.message);
  }, [generateState]);

  const hasDocument = Boolean(
    row.document_generated_at || row.generated_html_url || row.terms_html
  );

  const sendRecipientsPayload = useMemo(
    () => serializeSendRecipients(sendRecipients),
    [sendRecipients]
  );

  const termsTextPayload = useMemo(() => {
    if (useDefaultTerms || termsAreEqual(terms, defaultTerms)) {
      return "";
    }
    return serializeTermsText(terms);
  }, [terms, defaultTerms, useDefaultTerms]);

  function handleTermsChange(nextTerms: ClientIoTerm[]) {
    setTerms(nextTerms);
    setUseDefaultTerms(false);
  }

  function handleRecoverTerms() {
    setTerms(defaultTerms);
    setUseDefaultTerms(true);
    toast.message("Terms reset to default. Save draft to apply.");
  }

  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      leading={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Client IO · {row.campaign_name}
            {row.document_number ? ` · ${row.document_number}` : null}
          </h2>
          <div className="inline-flex flex-wrap items-center gap-2">
            <IoStatusBadge status={row.status} />
            {hasDocument ? <ClientIoViewMenu clientIoId={row.id} /> : null}
          </div>
        </div>
      }
    >
      <form id="client-io-save" action={saveAction} className="flex flex-col">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
        <input type="hidden" name="status" value={row.status} />
        <input type="hidden" name="terms_text" value={termsTextPayload} />
        <input type="hidden" name="send_recipients" value={sendRecipientsPayload} />

        <div className="px-6 py-4">
          <div className="space-y-1">
            <DetailFormSection label="Document details" className="py-3.5">
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <SummaryItem label="Document number" value={row.document_number} />
                <SummaryItem label="Campaign" value={row.campaign_name} />
                <SummaryItem label="Client" value={row.client_name} />
                <SummaryItem label="Brand" value={brandName} />
                <SummaryItem label="Status" value={row.status} />
                <SummaryItem label="Billing terms" value={billingTerms || row.billing_terms} />
              </dl>
            </DetailFormSection>

            <ClientIoRecipientsEditor
              recipients={sendRecipients}
              onChange={setSendRecipients}
              disabled={saving}
            />

            <ClientIoEmailPreviewSection
              io={row}
              senderName={senderName}
              recipients={sendRecipients}
              hasDocument={hasDocument}
            />

            <ClientIoTermsEditorField
              label="Terms & conditions"
              terms={terms}
              onChange={handleTermsChange}
              onRecover={handleRecoverTerms}
              description="Structured terms injected into Section 8 of the Client IO template. Leave as default or customize per IO."
            />

            <DetailFormSection label="Billing terms" className="py-3.5">
              <Input
                id="billing_terms"
                name="billing_terms"
                value={billingTerms}
                onChange={(e) => setBillingTerms(e.target.value)}
                placeholder="Net 30, invoicing notes..."
                className={DETAIL_FORM_INPUT_CLASS}
              />
            </DetailFormSection>

            <DetailFormSection label="Attachment URL (PO/SOW/PDF)" className="py-3.5">
              <Input
                id="attachment_url"
                name="attachment_url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className={DETAIL_FORM_INPUT_CLASS}
              />
            </DetailFormSection>

            <ClientIoSendHistory history={sendHistory} />
          </div>
        </div>
      </form>

      <form id="client-io-generate" action={generateAction} className="hidden">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="campaign_header_id" value={row.campaign_header_id} />
      </form>

      <DetailSheetFooter>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              form="client-io-generate"
              type="submit"
              variant="outline"
              size="sm"
              disabled={generating}
            >
              {generating
                ? "Generating…"
                : hasDocument
                  ? "Regenerate document"
                  : "Generate document"}
            </Button>
            <ClientIoSendControls
              io={row}
              campaignId={row.campaign_header_id}
              sendRecipientsJson={sendRecipientsPayload}
              recipientCount={sendRecipients.filter((r) => r.email.trim()).length}
              hasDocument={hasDocument}
            />
          </div>
          <Button
            form="client-io-save"
            type="submit"
            variant="outline"
            size="sm"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </DetailSheetFooter>
    </OperationalTableSection>
  );
}

```

#### `features/io/components/client-io-recipients-editor.tsx`

```tsx
"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailFormSection,
} from "@/features/campaigns/components/operational-detail-panel";
import type { ClientIoRecipientEntry } from "@/lib/io/client-io-send-recipients";

type Props = {
  recipients: ClientIoRecipientEntry[];
  onChange: (recipients: ClientIoRecipientEntry[]) => void;
  disabled?: boolean;
};

export function ClientIoRecipientsEditor({ recipients, onChange, disabled }: Props) {
  function updateRecipient(index: number, patch: Partial<ClientIoRecipientEntry>) {
    onChange(recipients.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRecipient(index: number) {
    onChange(recipients.filter((_, i) => i !== index));
  }

  function addRecipient() {
    onChange([...recipients, { name: "", email: "" }]);
  }

  return (
    <DetailFormSection label="IO recipients" className="py-3.5">
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Add one or more client contacts who will receive this Client IO from{" "}
        <strong className="font-medium text-foreground">hello@thinkwaymedia.com</strong>. Save draft
        before sending.
      </p>
      <div className="space-y-2">
        {recipients.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/15 px-3 py-4 text-sm text-muted-foreground">
            No recipients yet. Add a contact or pick from client contacts saved on the legal entity.
          </p>
        ) : (
          recipients.map((recipient, index) => (
            <div
              key={`recipient-${index}`}
              className="grid gap-2 rounded-md border border-border/60 bg-muted/10 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Input
                value={recipient.name}
                onChange={(e) => updateRecipient(index, { name: e.target.value })}
                placeholder="Contact name"
                className={DETAIL_FORM_INPUT_CLASS}
                disabled={disabled}
              />
              <Input
                type="email"
                value={recipient.email}
                onChange={(e) => updateRecipient(index, { email: e.target.value })}
                placeholder="email@client.com"
                className={DETAIL_FORM_INPUT_CLASS}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRecipient(index)}
                disabled={disabled}
                aria-label="Remove recipient"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={addRecipient}
          disabled={disabled}
        >
          <PlusIcon className="mr-1.5 size-3.5" />
          Add recipient
        </Button>
      </div>
    </DetailFormSection>
  );
}

```

#### `features/io/components/client-io-send-controls.tsx`

```tsx
"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sendClientIoAction } from "@/features/io/actions";
import { OPERATIONAL_CHROME_LABEL } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import type { ClientIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

const INITIAL_STATE = { ok: false } as const;

type ClientIoSendControlsProps = {
  io: ClientIoRow;
  campaignId: string;
  sendRecipientsJson: string;
  recipientCount: number;
  hasDocument: boolean;
  compact?: boolean;
  buttonVariant?: "default" | "outline";
};

export function ClientIoSendControls({
  io,
  campaignId,
  sendRecipientsJson,
  recipientCount,
  hasDocument,
  compact = false,
  buttonVariant = "default",
}: ClientIoSendControlsProps) {
  const [sendState, sendAction, sending] = useActionState(sendClientIoAction, INITIAL_STATE);

  useEffect(() => {
    if (!sendState.message) return;
    if (sendState.ok) toast.success(sendState.message);
    else toast.error(sendState.message);
  }, [sendState]);

  const sendLabel =
    io.status === "sent" || io.status === "approved" ? "Resend Client IO" : "Send Client IO";

  if (io.status === "approved") {
    return null;
  }

  const disabled = sending || recipientCount === 0 || !hasDocument;

  return (
    <form action={sendAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={io.id} />
      <input type="hidden" name="campaign_header_id" value={campaignId} />
      <input type="hidden" name="send_recipients" value={sendRecipientsJson} />
      <Button
        type="submit"
        size="sm"
        variant={buttonVariant}
        disabled={disabled}
        className={cn(
          compact && buttonVariant === "default"
            ? cn(OPERATIONAL_CHROME_LABEL, "h-7 px-3 font-semibold text-white shadow-sm hover:opacity-90")
            : compact
              ? cn(OPERATIONAL_CHROME_LABEL, "h-7 px-2")
              : undefined
        )}
      >
        {sending ? "Sending…" : sendLabel}
      </Button>
      {!hasDocument ? (
        <span className="text-[11px] text-muted-foreground">Generate document first</span>
      ) : recipientCount === 0 ? (
        <span className="text-[11px] text-muted-foreground">Add recipients above</span>
      ) : null}
    </form>
  );
}

```

#### `features/io/components/client-io-send-history.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { EyeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DetailFormSection } from "@/features/campaigns/components/operational-detail-panel";
import { ClientIoEmailViewDialog } from "@/features/io/components/client-io-email-view-dialog";
import type { ClientIoSendHistoryEntry } from "@/features/io/types";
import type { ClientIoEmailPreview } from "@/lib/email/client-io-email";
import { getGmailFromEmail } from "@/lib/email/gmail-config";
import { cn } from "@/lib/utils";

type Props = {
  history: ClientIoSendHistoryEntry[];
};

function statusClass(status: string | null): string {
  switch (status) {
    case "sent":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "bg-destructive/10 text-destructive";
    case "queued":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function historyEntryToPreview(entry: ClientIoSendHistoryEntry): ClientIoEmailPreview | null {
  if (!entry.email_html && !entry.email_text) return null;

  return {
    subject: entry.subject ?? "Client Insertion Order",
    fromEmail: entry.sender_email ?? getGmailFromEmail(),
    fromName: entry.sent_by_display_name ?? entry.sent_by_name ?? "Thinkway",
    html:
      entry.email_html ??
      `<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap;">${entry.email_text ?? ""}</pre>`,
    plainText: entry.email_text ?? "",
    hasPdfAttachment: false,
  };
}

export function ClientIoSendHistory({ history }: Props) {
  const [viewEntry, setViewEntry] = useState<ClientIoSendHistoryEntry | null>(null);

  const viewPreview = useMemo(
    () => (viewEntry ? historyEntryToPreview(viewEntry) : null),
    [viewEntry]
  );

  return (
    <>
      <DetailFormSection label="Send history" className="py-3.5">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Client IO emails sent yet for this campaign.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Sent at</th>
                  <th className="px-3 py-2 font-medium">Recipient</th>
                  <th className="px-3 py-2 font-medium">Subject</th>
                  <th className="px-3 py-2 font-medium">From</th>
                  <th className="px-3 py-2 font-medium">By</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const canView = Boolean(entry.email_html || entry.email_text);
                  return (
                    <tr key={entry.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {entry.sent_at
                          ? format(new Date(entry.sent_at), "MMM d, yyyy HH:mm")
                          : format(new Date(entry.created_at), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">
                          {entry.recipient_name?.trim() || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.recipient_email ?? "—"}
                        </div>
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2.5 text-muted-foreground">
                        {entry.subject ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {entry.sender_email ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {entry.sent_by_name ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                            statusClass(entry.delivery_status)
                          )}
                        >
                          {entry.delivery_status ?? "unknown"}
                        </span>
                        {entry.delivery_error ? (
                          <div className="mt-1 text-xs text-destructive">{entry.delivery_error}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        {canView ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setViewEntry(entry)}
                          >
                            <EyeIcon className="mr-1 size-3.5" />
                            View email
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DetailFormSection>

      {viewPreview && viewEntry ? (
        <ClientIoEmailViewDialog
          open={Boolean(viewEntry)}
          onOpenChange={(open) => {
            if (!open) setViewEntry(null);
          }}
          preview={viewPreview}
          recipients={
            viewEntry.recipient_email
              ? [
                  {
                    name: viewEntry.recipient_name ?? undefined,
                    email: viewEntry.recipient_email,
                  },
                ]
              : []
          }
          title="Sent email"
        />
      ) : null}
    </>
  );
}

```

#### `features/io/components/client-io-terms-editor.tsx`

```tsx
"use client";

import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { DetailEditBlock } from "@/features/campaigns/components/operational-detail-panel";
import type { ClientIoTerm } from "@/lib/io/client-io-terms";
import { cn } from "@/lib/utils";

type Props = {
  terms: ClientIoTerm[];
  onChange: (terms: ClientIoTerm[]) => void;
  onRecover?: () => void;
  disabled?: boolean;
  showRecover?: boolean;
  description?: string;
};

export function ClientIoTermsEditor({
  terms,
  onChange,
  onRecover,
  disabled = false,
  showRecover = true,
  description,
}: Props) {
  const platformV6 = useClientProfilePlatformV6();

  function updateTerm(index: number, patch: Partial<ClientIoTerm>) {
    onChange(terms.map((term, i) => (i === index ? { ...term, ...patch } : term)));
  }

  function removeTerm(index: number) {
    onChange(terms.filter((_, i) => i !== index));
  }

  function addTerm() {
    onChange([...terms, { title: "", body: "" }]);
  }

  if (platformV6) {
    return (
      <div>
        {description ? (
          <p className="platform-v6-field-hint mb-3">{description}</p>
        ) : null}

        {terms.map((term, index) => (
          <details key={index} className="platform-v6-io-term" open>
            <summary className="platform-v6-io-term-head">
              <span className="platform-v6-io-term-title">
                Term {index + 1}
                {term.title ? ` — ${term.title}` : ""}
              </span>
              <button
                type="button"
                className="platform-v6-io-term-delete"
                onClick={(event) => {
                  event.preventDefault();
                  removeTerm(index);
                }}
                disabled={disabled || terms.length <= 1}
                aria-label={`Remove term ${index + 1}`}
              >
                <Trash2Icon className="size-3.5" strokeWidth={2} />
              </button>
            </summary>
            <div className="platform-v6-io-term-edit">
              <Input
                value={term.title}
                onChange={(e) => updateTerm(index, { title: e.target.value })}
                placeholder="Term title (e.g. Payment)"
                disabled={disabled}
              />
              <Textarea
                value={term.body}
                onChange={(e) => updateTerm(index, { body: e.target.value })}
                placeholder="Describe this term…"
                rows={3}
                disabled={disabled}
              />
            </div>
          </details>
        ))}

        <div className="platform-v6-io-actions">
          <button
            type="button"
            onClick={addTerm}
            disabled={disabled}
            className="platform-v6-btn platform-v6-btn-sm"
          >
            <PlusIcon className="size-3.5" strokeWidth={2.2} />
            Add term
          </button>
          {showRecover && onRecover ? (
            <button
              type="button"
              onClick={onRecover}
              disabled={disabled}
              className="platform-v6-link inline-flex items-center gap-1 text-[11px]"
            >
              <RotateCcwIcon className="size-3" />
              Restore to default
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}

      <div className="space-y-3">
        {terms.map((term, index) => (
          <div
            key={index}
            className={cn(
              "space-y-2.5 rounded-[12px] border border-border bg-muted p-4",
              "transition-[border-color,box-shadow] focus-within:border-[#0057FF]",
              "focus-within:ring-[3px] focus-within:ring-[#EEF4FF]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Term {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-[30px] rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeTerm(index)}
                disabled={disabled || terms.length <= 1}
                aria-label={`Remove term ${index + 1}`}
              >
                <Trash2Icon className="size-4" strokeWidth={1.8} />
              </Button>
            </div>
            <Input
              value={term.title}
              onChange={(e) => updateTerm(index, { title: e.target.value })}
              placeholder="Term title (e.g. Payment)"
              className={CLIENT_FORM_INPUT_CLASS}
              disabled={disabled}
            />
            <Textarea
              value={term.body}
              onChange={(e) => updateTerm(index, { body: e.target.value })}
              placeholder="Describe this term…"
              rows={3}
              className={cn(CLIENT_FORM_TEXTAREA_CLASS, "min-h-[70px]")}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addTerm}
        disabled={disabled}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--camp-border)]",
          "px-4 py-2.5 text-[13px] font-semibold text-[var(--camp-blue)] transition-colors",
          "hover:border-[var(--camp-blue)] hover:bg-[var(--camp-blue-light)]",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <PlusIcon className="size-[15px]" strokeWidth={2.2} />
        Add term
      </button>

      {showRecover && onRecover ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRecover}
          disabled={disabled}
          className="gap-1.5 text-muted-foreground"
        >
          <RotateCcwIcon className="size-3.5" />
          Recover to default
        </Button>
      ) : null}
    </div>
  );
}

export function ClientIoTermsEditorField({
  label,
  terms,
  onChange,
  onRecover,
  disabled,
  showRecover,
  description,
}: Props & { label: string }) {
  return (
    <DetailEditBlock label={label}>
      <ClientIoTermsEditor
        terms={terms}
        onChange={onChange}
        onRecover={onRecover}
        disabled={disabled}
        showRecover={showRecover}
        description={description}
      />
    </DetailEditBlock>
  );
}

```

#### `features/io/components/client-io-view-menu.tsx`

```tsx
"use client";

import Link from "next/link";
import { ChevronDown, FileText, Layers, LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ClientIoViewMenuProps = {
  clientIoId: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
};

export function ClientIoViewMenu({
  clientIoId,
  label = "View Client IO",
  size = "sm",
  variant = "outline",
}: ClientIoViewMenuProps) {
  const base = `/ios/client/${clientIoId}/preview`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5">
          {label}
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Client IO layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`${base}?layout=detailed`} className="flex cursor-pointer items-start gap-2">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Detailed</span>
              <span className="block text-xs text-muted-foreground">
                Pricing per assignment line
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}?layout=package`} className="flex cursor-pointer items-start gap-2">
            <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Package</span>
              <span className="block text-xs text-muted-foreground">
                Single campaign total
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`${base}?layout=package_main`}
            className="flex cursor-pointer items-start gap-2"
          >
            <LayoutList className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Package main</span>
              <span className="block text-xs text-muted-foreground">
                Package totals with main assignment lines only
              </span>
            </span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

```

#### `features/io/components/client-ios-table.tsx`

```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import { IoStatusBadge } from "@/features/io/components/io-status-badge";
import type { ClientIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

type ClientIosTableContext = {
  onView: (ioId: string) => void;
  isNavigating: boolean;
  showClientColumn: boolean;
  platformV6: boolean;
};

type Props = {
  rows: ClientIoRow[];
  selectedId?: string | null;
  onView: (ioId: string) => void;
  isNavigating?: boolean;
  /** Hide client column when scoped to a single client workspace. */
  showClientColumn?: boolean;
  platformV6?: boolean;
};

function renderClientIoStatusBadge(
  status: ClientIoRow["status"],
  platformV6: boolean
) {
  if (platformV6 && status === "draft") {
    return (
      <span className={platformV6BadgeClass("gray")}>Draft</span>
    );
  }
  return <IoStatusBadge status={status} />;
}

function buildClientIosColumns(
  context: ClientIosTableContext
): OperationalConfigurableColumnDef<ClientIoRow>[] {
  const { onView, isNavigating, showClientColumn, platformV6 } = context;
  const columns: OperationalConfigurableColumnDef<ClientIoRow>[] = [
    {
      id: "io_number",
      label: "IO #",
      monoCell: true,
      renderCell: (row) => (
        <span className={cn(platformV6 && "tabular-nums text-[var(--tw-text-2)]")}>
          <DocumentNumber value={row.document_number} />
        </span>
      ),
    },
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (row) => (
        <Link
          href={`/campaigns/${row.campaign_header_id}`}
          className={
            platformV6
              ? "platform-v6-link"
              : "text-[11px] text-foreground/90 hover:underline"
          }
        >
          <DocumentNumber value={row.campaign_document_number} /> · {row.campaign_name}
        </Link>
      ),
    },
  ];

  if (showClientColumn) {
    columns.push({
      id: "client",
      label: "Client",
      renderCell: (row) => row.client_name,
    });
  }

  columns.push(
    {
      id: "status",
      label: "Status",
      renderCell: (row) => renderClientIoStatusBadge(row.status, platformV6),
    },
    {
      id: "sent",
      label: "Sent",
      cellClassName: platformV6 ? "text-[var(--tw-text-3)]" : "text-muted-foreground",
      renderCell: (row) =>
        row.sent_at ? new Date(row.sent_at).toLocaleString() : "—",
    },
    {
      id: "approved",
      label: "Approved",
      cellClassName: platformV6 ? "text-[var(--tw-text-3)]" : "text-muted-foreground",
      renderCell: (row) =>
        row.approved_at ? new Date(row.approved_at).toLocaleString() : "—",
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: platformV6 ? undefined : "text-right",
      cellClassName: platformV6 ? undefined : "text-right",
      renderCell: (row) => {
        const sendHref = `/campaigns/${row.campaign_header_id}?tab=client-io`;
        const sendLabel =
          row.status === "sent" || row.status === "approved" ? "Resend" : "Send";

        if (platformV6) {
          return (
            <div className="platform-v6-row-actions !justify-start">
              <button
                type="button"
                className="platform-v6-link"
                onClick={() => onView(row.id)}
                disabled={isNavigating}
              >
                View
              </button>
              <Link href={sendHref} className="platform-v6-link">
                {sendLabel}
              </Link>
            </div>
          );
        }

        return (
          <div className="inline-flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onView(row.id)}
              disabled={isNavigating}
            >
              View
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={sendHref}>{sendLabel}</Link>
            </Button>
          </div>
        );
      },
    }
  );

  return columns;
}

export const CLIENT_IOS_TABLE_COLUMNS = buildClientIosColumns({
  onView: () => {},
  isNavigating: false,
  showClientColumn: true,
  platformV6: false,
});

export const CLIENT_IOS_TABLE_COLUMN_METAS =
  getOperationalTableColumnMetas(CLIENT_IOS_TABLE_COLUMNS);

export function ClientIosTable({
  rows,
  selectedId = null,
  onView,
  isNavigating = false,
  showClientColumn = true,
  platformV6 = false,
}: Props) {
  const columns = useMemo(
    () =>
      buildClientIosColumns({
        onView,
        isNavigating,
        showClientColumn,
        platformV6,
      }),
    [onView, isNavigating, showClientColumn, platformV6]
  );

  if (rows.length === 0) {
    return (
      <p className="px-4 py-8 text-[11px] text-muted-foreground">
        No client IO records found.
      </p>
    );
  }

  return (
    <OperationalConfigurableTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      className={platformV6 ? "platform-v6-data-table" : undefined}
      rowClassName={(row) =>
        cn(!platformV6 && selectedId === row.id && "bg-muted/50")
      }
    />
  );
}

```

#### `features/io/components/io-status-badge.tsx`

```tsx
"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";

import type { ClientIoStatus, VendorIoStatus } from "@/features/io/types";

type Props = {
  status: ClientIoStatus | VendorIoStatus;
  className?: string;
};

export function IoStatusBadge({ status, className }: Props) {
  const label = status === "cancelled" ? "Cancelled" : status;
  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("io", status)}
      appearance="pill"
      className={className}
    />
  );
}

```

## Route `/vendors/[id]`

Vendor / creator operational workspace.

**Page file:** `app/(dashboard)/vendors/[id]/page.tsx`

**Page-family shared used:** `components/platform/platform-v6-layout.tsx`, `components/platform/platform-v6-kpi-strip.tsx`

### Mock / sample / fallback data

_No dedicated mock/fixture modules for this route._ UI renders with **live Supabase data** (see data loaders below). Empty arrays are used only on error fallbacks in `page.tsx`.

**Data loaders (live; not expanded as UI):**

- `features/vendors/actions.ts`
- `features/vendors/queries.ts`

### `page.tsx`

#### `app/(dashboard)/vendors/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VendorPortalAccessCard } from "@/features/vendors/components/vendor-portal-access-card";
import { VendorWorkspaceView } from "@/features/vendors/components/vendor-workspace";
import { getVendorWorkspace } from "@/features/vendors/queries";
import { buildCurrencyOptions } from "@/lib/master-data/currency-options";
import { getMasterDataOptions } from "@/lib/master-data/queries";

type VendorProfilePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function VendorProfilePage({
  params,
  searchParams,
}: VendorProfilePageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

  let workspace;
  let currencyOptions: { value: string; label: string }[] = [];
  let errorMessage: string | null = null;

  try {
    const [workspaceResult, masterDataResult] = await Promise.allSettled([
      getVendorWorkspace(id),
      getMasterDataOptions(),
    ]);

    if (workspaceResult.status === "fulfilled") {
      workspace = workspaceResult.value;
    } else {
      errorMessage =
        workspaceResult.reason instanceof Error
          ? workspaceResult.reason.message
          : "Failed to load vendor.";
    }

    if (masterDataResult.status === "fulfilled") {
      currencyOptions = buildCurrencyOptions(masterDataResult.value.currencies);
    }
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load vendor.";
  }

  if (!workspace && !errorMessage) {
    notFound();
  }

  return (
    <DashboardShell
      title="Creator workspace"
      hidePageHeader
      platformV6
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {errorMessage ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {errorMessage}
        </div>
      ) : workspace ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <VendorWorkspaceView
            workspace={workspace}
            defaultTab={tab ?? "overview"}
            currencyOptions={currencyOptions}
            portalAccessPanel={
              <VendorPortalAccessCard
                influencerId={workspace.id}
                profileId={workspace.profile_id}
              />
            }
          />
        </div>
      ) : null}
    </DashboardShell>
  );
}

```
### Page-specific components

#### `features/campaigns/components/assignment-hierarchy/operational-table-typography.ts`

```ts
import { cn } from "@/lib/utils";

/** Assignment operational grid — matches reference: light sans, tabular numbers, no mono. */
export const OPERATIONAL_TABLE_FONT = "font-sans";

/** Data sheet surface (token-based for light/dark). */
export const OPERATIONAL_TABLE_SURFACE = "bg-card";

/** Scoped CSS in `.thinkway-campaign-workspace` owns header strip styling. */
export const OPERATIONAL_TABLE_HEADER_SURFACE = "";

export const OPERATIONAL_TABLE_HEADER_ROW = "";

export const OPERATIONAL_TABLE_HEADER_CELL = "";

export const OPERATIONAL_AMOUNT_TABULAR =
  "text-[11px] tabular-nums tracking-normal";

/** Default money cells — neutral foreground. */
export const OPERATIONAL_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/90"
);

/** Child money cells match parent row exactly. */
export const OPERATIONAL_CHILD_AMOUNT_CLASS = OPERATIONAL_AMOUNT_CLASS;

/** Billable revenue — login blue primary. */
export const OPERATIONAL_REVENUE_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-medium text-primary"
);

/** Cost columns — subdued foreground. */
export const OPERATIONAL_COST_AMOUNT_CLASS = cn(
  OPERATIONAL_AMOUNT_TABULAR,
  "font-normal text-foreground/80"
);

export type OperationalAmountVariant =
  | "default"
  | "revenue"
  | "cost"
  | "gp"
  | "margin"
  | "muted";

export function operationalGpAmountClass(value: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    "font-medium",
    value > 0 && "text-brand-product",
    value < 0 && "text-destructive",
    value === 0 && "text-foreground/90"
  );
}

export function operationalMarginAmountClass(percent: number): string {
  return cn(
    OPERATIONAL_AMOUNT_TABULAR,
    percent < 15 ? "text-warning" : "text-muted-foreground"
  );
}

export function operationalAmountVariantClass(
  variant: OperationalAmountVariant,
  value?: number
): string {
  switch (variant) {
    case "revenue":
      return OPERATIONAL_REVENUE_AMOUNT_CLASS;
    case "cost":
      return OPERATIONAL_COST_AMOUNT_CLASS;
    case "gp":
      return operationalGpAmountClass(value ?? 0);
    case "margin":
      return operationalMarginAmountClass(value ?? 0);
    case "muted":
      return cn(OPERATIONAL_AMOUNT_TABULAR, "text-muted-foreground");
    default:
      return OPERATIONAL_AMOUNT_CLASS;
  }
}

export type OperationalKpiValueSemantic =
  | "revenue"
  | "gp"
  | "cost"
  | "margin"
  | "count";

export function operationalKpiValueClass(
  semantic: OperationalKpiValueSemantic | undefined,
  value?: number
): string | undefined {
  if (!semantic) return undefined;
  switch (semantic) {
    case "revenue":
      return "text-primary";
    case "cost":
      return "text-foreground/80";
    case "gp":
      if (value == null) return "text-brand-product";
      if (value < 0) return "text-destructive";
      if (value > 0) return "text-brand-product";
      return undefined;
    case "margin":
      if (value != null && value < 15) return "text-warning";
      return "text-muted-foreground";
    case "count":
      return "text-foreground";
    default:
      return undefined;
  }
}

/** Campaign workspace chrome — sans family; sizes match pre-operational header scale. */
export const OPERATIONAL_CHROME_TITLE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
);

export const OPERATIONAL_CHROME_META = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal text-muted-foreground"
);

export const OPERATIONAL_CHROME_LABEL = OPERATIONAL_CHROME_META;

/** Status / IO badges in workspace header (default badge scale). */
export const OPERATIONAL_CHROME_STATUS_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-xs font-medium"
);

export const OPERATIONAL_CHROME_BADGE = cn(
  OPERATIONAL_TABLE_FONT,
  "text-[11px] font-normal"
);

```

#### `features/campaigns/components/assignment-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { ASSIGNMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { CampaignLineAssignmentStatus } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

type AssignmentStatusBadgeProps = {
  status: CampaignLineAssignmentStatus;
  className?: string;
};

export function AssignmentStatusBadge({ status, className }: AssignmentStatusBadgeProps) {
  return (
    <StatusBadge
      label={ASSIGNMENT_STATUS_LABELS[status] ?? status}
      tone={resolveStatusTone("campaignAssignment", status)}
      appearance="outline"
      className={cn("font-normal capitalize", className)}
    />
  );
}

```

#### `features/campaigns/components/campaign-flat-section.tsx`

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CampaignFlatSectionProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** info-card = overview grid cards; section-card = full-width sections */
  variant?: "section-card" | "info-card";
  /** Tables / activity lists flush to card edges (no section-body padding). */
  flushBody?: boolean;
};

/** Section shell — matches thinkway-campaign_2.html section-card / info-card. */
export function CampaignFlatSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  variant = "section-card",
  flushBody = false,
}: CampaignFlatSectionProps) {
  if (variant === "info-card") {
    return (
      <section className={cn("thinkway-campaign-info-card flex h-full min-w-0 flex-col", className)}>
        <h3>{title}</h3>
        {children}
      </section>
    );
  }

  return (
    <section className={cn("thinkway-campaign-section-card flex min-w-0 flex-col", className)}>
      <div className="thinkway-campaign-section-head">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? (
              <Icon className="size-3.5 shrink-0 text-[var(--camp-text-3)]" aria-hidden />
            ) : null}
            <h2>{title}</h2>
          </div>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
        ) : null}
      </div>
      {flushBody ? children : <div className="thinkway-campaign-section-body">{children}</div>}
    </section>
  );
}

```

#### `features/campaigns/components/campaign-operational-section-header.tsx`

```tsx
"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CampaignOperationalSectionHeaderProps = {
  title: string;
  /** Muted suffix after title, e.g. "14 of 14" (reference: Deliverables · N of N). */
  countLabel?: string;
  description?: string;
  titleClassName?: string;
  actions?: ReactNode;
};

/** Matches reference section-head / tab toolbar title row. */
export function CampaignOperationalSectionHeader({
  title,
  countLabel,
  description,
  titleClassName,
  actions,
}: CampaignOperationalSectionHeaderProps) {
  return (
    <div className="flex w-full flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2
          className={cn(
            "text-[13px] font-bold text-[var(--camp-text)]",
            titleClassName
          )}
        >
          {title}
          {countLabel ? (
            <span className="font-normal text-[var(--camp-text-3)]"> · {countLabel}</span>
          ) : null}
        </h2>
        {description ? (
          <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-[var(--camp-text-3)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="thinkway-campaign-section-actions">{actions}</div>
      ) : null}
    </div>
  );
}

```

#### `features/campaigns/components/operational-detail-panel.tsx`

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { APP_MAIN_HALF_PANEL_WIDTH } from "@/lib/layout/app-sidebar-width";
import { initialsFromName } from "@/lib/campaigns/assignment-detail-presenters";
import { cn } from "@/lib/utils";

export const OPERATIONAL_DETAIL_SHEET_STYLE: CSSProperties = {
  width: APP_MAIN_HALF_PANEL_WIDTH,
  maxWidth: APP_MAIN_HALF_PANEL_WIDTH,
};

export const OPERATIONAL_DETAIL_SHEET_CLASS = cn(
  "flex flex-col gap-0 overflow-hidden border-y border-l border-border/60 bg-card p-0",
  "transition-[width,max-width] duration-200 ease-out",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none rounded-l-[1.75rem] rounded-r-none shadow-[-12px_0_40px_-8px_rgba(0,0,0,0.12)]"
);

type OperationalDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

export function OperationalDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: OperationalDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        showCloseButton
        showOverlay={false}
        style={OPERATIONAL_DETAIL_SHEET_STYLE}
        className={OPERATIONAL_DETAIL_SHEET_CLASS}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {description ? (
          <SheetDescription className="sr-only">{description}</SheetDescription>
        ) : null}
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function DetailField({
  label,
  children,
  valueClassName,
  onLabelClick,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
  /** Navigate to a workspace tab or section when the label is clicked. */
  onLabelClick?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/40 py-3.5 last:border-b-0">
      {onLabelClick ? (
        <button
          type="button"
          onClick={onLabelClick}
          className={cn(
            DETAIL_FIELD_LABEL_CLASS,
            "text-left transition-colors hover:text-primary hover:underline"
          )}
        >
          {label}
        </button>
      ) : (
        <span className={DETAIL_FIELD_LABEL_CLASS}>{label}</span>
      )}
      <div className={cn("min-w-0 text-right text-sm text-foreground", valueClassName)}>
        {children}
      </div>
    </div>
  );
}

export function DetailPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}

export function TeamMemberValue({
  name,
  email,
}: {
  name: string | null | undefined;
  email?: string | null;
}) {
  const display = name?.trim() || email?.trim() || "—";
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {initialsFromName(display)}
      </span>
      <span>{display}</span>
    </span>
  );
}

export function ClientApprovalPill({ status }: { status: string | null }) {
  const normalized = (status ?? "draft").toLowerCase();
  if (normalized === "approved") {
    return (
      <DetailPill className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
        Accepted ✓
      </DetailPill>
    );
  }
  if (normalized === "sent") {
    return (
      <DetailPill className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
        Pending approval
      </DetailPill>
    );
  }
  if (normalized === "rejected") {
    return (
      <DetailPill className="border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200">
        Rejected
      </DetailPill>
    );
  }
  if (normalized === "cancelled") {
    return (
      <DetailPill className="border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200">
        Cancelled
      </DetailPill>
    );
  }
  return <DetailPill>Draft</DetailPill>;
}

export function DetailTabList({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-b border-border/60 px-6">{children}</div>
  );
}

export const DETAIL_TAB_TRIGGER_CLASS =
  "rounded-none px-0 pb-3 pt-4 text-xs data-[state=active]:font-semibold";

export const DETAIL_FIELD_LABEL_CLASS =
  "shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground";

/** Compact inputs aligned with operational detail field rows. */
export const DETAIL_FIELD_INPUT_CLASS =
  "h-8 w-full border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

export const DETAIL_FIELD_SELECT_TRIGGER_CLASS = cn(
  DETAIL_FIELD_INPUT_CLASS,
  "text-left data-[size=default]:h-8"
);

/** Edit row — same rhythm as DetailField, with a control on the right. */
export function DetailEditField({
  label,
  children,
  valueClassName,
  align = "end",
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
  align?: "start" | "end";
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/40 py-3.5 last:border-b-0">
      <span className={DETAIL_FIELD_LABEL_CLASS}>{label}</span>
      <div
        className={cn(
          "min-w-0 w-full max-w-[min(100%,18rem)] flex-1",
          align === "end" ? "text-right" : "text-left",
          valueClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Multiline edit block inside detail panels. */
export function DetailEditBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-border/40 py-3.5 last:border-b-0">
      <p className={DETAIL_FIELD_LABEL_CLASS}>{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function DetailSheetFooter({
  hint,
  children,
}: {
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="shrink-0 border-t border-border/60 px-6 py-4">
      {hint ? (
        <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  );
}

/** Full-width form controls inside operational edit drawers. */
export const DETAIL_FORM_INPUT_CLASS =
  "h-9 w-full border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

export const DETAIL_FORM_SELECT_TRIGGER_CLASS = cn(DETAIL_FORM_INPUT_CLASS, "text-left");

/** Portaled select menus must stack above operational sheets (z-[100]). */
export const DETAIL_SHEET_SELECT_CONTENT_PROPS = {
  position: "popper" as const,
  className: "z-[110]",
};

export function OperationalEditPanelHeader({
  title,
  description,
  badges,
}: {
  title: ReactNode;
  description?: string;
  badges?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-border/60 px-6 pb-4 pt-5">
      <div className="pr-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {badges ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>
        ) : null}
      </div>
    </div>
  );
}

export function DetailFormScrollBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-4", className)}>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** Section label rhythm matching read-only DetailField rows. */
export function DetailFormSection({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className={DETAIL_FIELD_LABEL_CLASS}>{label}</p>
      {children}
      {hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function DetailPanelHeader({
  breadcrumb,
  actions,
  avatarInitials,
  avatarUrl,
  avatarPlatform,
  avatarUsername,
  profileUrl,
  profileTooltip,
  title,
  subtitle,
  badges,
}: {
  breadcrumb: ReactNode;
  actions?: ReactNode;
  avatarInitials: string;
  avatarUrl?: string | null;
  avatarPlatform?: string | null;
  avatarUsername?: string | null;
  profileUrl?: string | null;
  profileTooltip?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
}) {
  const avatarNode = avatarUrl?.trim() ? (
    <CreatorAvatarImage avatarUrl={avatarUrl} size="lg" sizeClassName="size-14" />
  ) : (
    <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/40 text-base font-semibold text-foreground">
      {avatarInitials}
    </span>
  );

  return (
    <div className="shrink-0 border-b border-border/60 px-6 pb-4 pt-5">
      <div className="flex items-start justify-between gap-3 pr-10">
        <p className="text-xs text-muted-foreground">{breadcrumb}</p>
        {actions}
      </div>
      <div className="mt-4 flex items-center gap-3">
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={profileTooltip ?? "Open social profile"}
            title={profileTooltip ?? "Open social profile"}
            className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {avatarNode}
          </a>
        ) : (
          avatarNode
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle}
          </div>
          {badges ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{badges}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

```

#### `features/campaigns/constants.ts`

```ts
/** @deprecated Import from `@/lib/campaigns/constants` — re-export for UI backward compat. */
export * from "@/lib/campaigns/constants";

```

#### `features/clients/components/client-form-ui.tsx`

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { SaveIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, type ReactNode } from "react";

import { PlatformV6PageSectionHeader, PlatformV6WideFormBlock } from "@/components/platform/platform-v6-layout";
import { Label } from "@/components/ui/label";
import { useRegisterShortcut } from "@/lib/productivity/keyboard-shortcuts";
import { cn } from "@/lib/utils";

const ClientProfilePlatformContext = createContext(false);

export function ClientProfilePlatformProvider({
  platformV6,
  children,
}: {
  platformV6?: boolean;
  children: ReactNode;
}) {
  return (
    <ClientProfilePlatformContext.Provider value={Boolean(platformV6)}>
      {children}
    </ClientProfilePlatformContext.Provider>
  );
}

export function useClientProfilePlatformV6() {
  return useContext(ClientProfilePlatformContext);
}

/** Marks a form as the Ctrl+S / Cmd+S save target (see KeyboardShortcutsProvider). */
export const CLIENT_FORM_SHORTCUT_SAVE_ATTR = "data-shortcut-save";

/**
 * Footer hint for client profile tab forms that register `useClientFormSaveShortcut`.
 *
 * Wired forms (when their tab is active):
 * - Overview: `#client-overview-form`
 * - Brands: add-brand dialog (`#client-add-brand-form` when open)
 * - Legal: `#client-legal-form`
 * - Finance: `#client-finance-form`
 */
export const CLIENT_FORM_SAVE_SHORTCUT_HINT = "Ctrl+S to save";

/** Registers Ctrl+S / Cmd+S to submit a form when `enabled` (e.g. active tab or open dialog). */
export function useClientFormSaveShortcut({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useRegisterShortcut(
    enabled
      ? {
          id: `client-form-save-${formId}`,
          keys: "ctrl+s",
          label: "Save form",
          group: "Forms",
          global: true,
          handler: () => {
            if (disabled) return;
            const form = document.getElementById(formId);
            if (form instanceof HTMLFormElement) {
              form.requestSubmit();
            }
          },
        }
      : null
  );
}

export function ClientFormKeyboardShortcuts({
  formId,
  enabled = true,
  disabled = false,
}: {
  formId: string;
  enabled?: boolean;
  disabled?: boolean;
}) {
  useClientFormSaveShortcut({ formId, enabled, disabled });
  return null;
}

/** Form controls — Thinkway client form reference (Form_4: blue brand, neutral surfaces). */
export const CLIENT_FORM_MAX_WIDTH = "max-w-[880px]";

export const CLIENT_FORM_INPUT_CLASS = cn(
  "h-auto min-h-9 w-full rounded-[10px] border-border bg-muted px-[13px] py-[11px] text-[13.5px] text-foreground shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-primary focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-primary/20"
);

export const CLIENT_FORM_SELECT_TRIGGER_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "justify-between text-left font-normal"
);

export const CLIENT_FORM_TEXTAREA_CLASS = cn(
  CLIENT_FORM_INPUT_CLASS,
  "min-h-[90px] resize-y leading-relaxed"
);

export const CLIENT_FORM_FIELD_LABEL_CLASS =
  "text-[12.5px] font-semibold text-foreground";

export const CLIENT_FORM_FIELD_HINT_CLASS =
  "text-[11.5px] leading-relaxed text-muted-foreground";

export const CLIENT_FORM_PRIMARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent px-4 py-2.5",
  "bg-[linear-gradient(135deg,#0057FF_0%,#2E74FF_55%,#1A6FFF_100%)]",
  "text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,87,255,0.3)]",
  "transition-[transform,box-shadow] active:scale-[0.97]",
  "hover:shadow-[0_6px_20px_rgba(0,87,255,0.42)]",
  "disabled:pointer-events-none disabled:opacity-50"
);

/** Form_4 primary submit for client profile tabs (Brands, Legal, Finance). */
export function ClientProfileTabSaveButton({
  formId,
  label,
  pendingLabel = "Saving…",
  isPending = false,
  disabled = false,
  showSaveIcon = true,
}: {
  formId: string;
  label: string;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  showSaveIcon?: boolean;
}) {
  return (
    <button
      type="submit"
      form={formId}
      className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
      disabled={disabled || isPending}
    >
      {showSaveIcon ? (
        <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
      ) : null}
      {isPending ? pendingLabel : label}
    </button>
  );
}

export const CLIENT_FORM_SECONDARY_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-1.5",
  "text-xs font-semibold text-foreground transition-[border-color,background-color,transform]",
  "hover:border-border/80 active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export const CLIENT_FORM_GHOST_BUTTON_CLASS = cn(
  "inline-flex h-auto items-center gap-1.5 rounded-[10px] border-transparent bg-transparent px-4 py-2.5",
  "text-[13px] font-semibold text-muted-foreground transition-colors",
  "hover:bg-muted hover:text-foreground active:scale-[0.97]",
  "disabled:pointer-events-none disabled:opacity-50"
);

export function ClientFormPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-[25px] font-extrabold tracking-[-0.035em] text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="mt-[5px] text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

export type ClientFormBreadcrumb = {
  label: string;
  href?: string;
};

/** Top bar — Form_4 breadcrumbs + Cancel / Save actions. */
export function ClientFormTopbar({
  breadcrumbs,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
}: {
  breadcrumbs: ClientFormBreadcrumb[];
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
}) {
  return (
    <div className="z-15 flex h-[62px] shrink-0 items-center gap-4 border-b border-border bg-background/70 px-[26px] backdrop-blur-md">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[13.5px]">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-muted-foreground opacity-50" aria-hidden>
                  /
                </span>
              ) : null}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {onCancel ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onCancel}
            disabled={saveDisabled}
          >
            Cancel
          </button>
        ) : null}
        {saveFormId ? (
          <button
            type="submit"
            form={saveFormId}
            className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
            disabled={saveDisabled}
          >
            <SaveIcon className="size-[15px]" strokeWidth={2.2} aria-hidden />
            {isSaving ? "Saving…" : saveLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Scrollable form body + pinned footer (Form_4 save bar pattern). */
export function ClientFormLayout({
  children,
  footer,
  topbar,
}: {
  children: ReactNode;
  footer?: ReactNode;
  topbar?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {topbar}
      <div className="h-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        {children}
      </div>
      {footer}
    </div>
  );
}

export const CLIENT_FORM_SCROLL_PADDING_CLASS = "px-[26px] pt-7 pb-[120px]";

export function ClientFormSection({
  icon: Icon,
  title,
  description,
  children,
  className,
  iconClassName,
  toolbar,
  bodyClassName,
  footer,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  iconClassName?: string;
  toolbar?: ReactNode;
  bodyClassName?: string;
  footer?: ReactNode;
  /** Tighter padding for dialogs and constrained viewports. */
  compact?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <PlatformV6WideFormBlock
        icon={Icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
        toolbar={toolbar}
        bodyClassName={bodyClassName}
        footer={footer}
        className={className}
      >
        {children}
      </PlatformV6WideFormBlock>
    );
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[var(--card-shadow)]",
        compact ? "overflow-visible" : "overflow-hidden",
        className
      )}
    >
      <header
        className={cn(
          "flex items-center gap-3 border-b border-border",
          compact ? "px-4 py-3" : "px-[22px] py-[18px]"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary",
            compact ? "size-8" : "size-[34px]"
          )}
        >
          <Icon
            className={compact ? "size-4" : "size-[18px]"}
            strokeWidth={1.8}
            aria-hidden
          />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15.5px] font-bold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-px text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div
        className={cn(
          compact ? "space-y-3.5 p-4" : "space-y-[18px] p-[22px]",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function ClientFormGrid({
  children,
  className,
  columns,
}: {
  children: ReactNode;
  className?: string;
  /** Override column layout when platform v6 is active. */
  columns?: 3 | 4;
}) {
  const platformV6 = useClientProfilePlatformV6();
  const v6GridClass =
    columns === 4 ? "platform-v6-form-grid-4" : "platform-v6-form-grid";

  return (
    <div
      className={cn(
        platformV6
          ? v6GridClass
          : "grid gap-[18px] sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ClientFormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const platformV6 = useClientProfilePlatformV6();

  return (
    <div className={cn("grid gap-[7px]", className)}>
      <Label
        htmlFor={htmlFor}
        className={
          platformV6 ? "platform-v6-field-label" : CLIENT_FORM_FIELD_LABEL_CLASS
        }
      >
        {label}
      </Label>
      {children}
      {hint ? (
        typeof hint === "string" ? (
          <p
            className={
              platformV6 ? "platform-v6-field-hint" : CLIENT_FORM_FIELD_HINT_CLASS
            }
          >
            {hint}
          </p>
        ) : (
          hint
        )
      ) : null}
    </div>
  );
}

export function ClientFormSaveBar({
  children,
  status,
  onDiscard,
  discardLabel = "Discard",
  discardDisabled,
}: {
  children: ReactNode;
  status?: ReactNode;
  onDiscard?: () => void;
  discardLabel?: string;
  discardDisabled?: boolean;
}) {
  return (
    <div className="z-10 flex shrink-0 flex-wrap items-center gap-3.5 border-t border-border bg-background/90 px-[26px] py-3.5 backdrop-blur-[14px]">
      {status ? (
        <div className="flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
          {status}
        </div>
      ) : null}
      <div className="ml-auto flex flex-wrap gap-2.5">
        {onDiscard ? (
          <button
            type="button"
            className={CLIENT_FORM_GHOST_BUTTON_CLASS}
            onClick={onDiscard}
            disabled={discardDisabled}
          >
            {discardLabel}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function ClientFormUnsavedStatus() {
  return (
    <>
      <span
        className="size-[7px] shrink-0 rounded-full bg-amber-600 shadow-[0_0_6px_#C2740B]"
        aria-hidden
      />
      Unsaved changes
    </>
  );
}

export const CLIENT_PROFILE_BREADCRUMBS: ClientFormBreadcrumb[] = [
  { label: "Clients", href: "/clients" },
  { label: "Legal Entities", href: "/clients" },
  { label: "Edit" },
];

/** Shared Form_4 shell for client profile tabs (topbar, scroll body, optional dirty footer). */
export function ClientProfileTabShell({
  title,
  description,
  children,
  beforeHeader,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
  isDirty,
  onDiscard,
  discardDisabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** Renders above the page title (e.g. onboarding progress strip). */
  beforeHeader?: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-epanel-inner">
        {beforeHeader}
        <PlatformV6PageSectionHeader title={title} description={description} />
        {children}
      </div>
    );
  }

  return (
    <ClientFormLayout
      topbar={
        <ClientFormTopbar
          breadcrumbs={CLIENT_PROFILE_BREADCRUMBS}
          onCancel={onCancel}
          saveFormId={saveFormId}
          saveLabel={saveLabel}
          saveDisabled={saveDisabled}
          isSaving={isSaving}
        />
      }
      footer={
        isDirty ? (
          <ClientFormSaveBar
            status={<ClientFormUnsavedStatus />}
            onDiscard={onDiscard}
            discardDisabled={discardDisabled}
          >
            {saveFormId ? (
              <button
                type="submit"
                form={saveFormId}
                className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
                disabled={saveDisabled}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            ) : null}
          </ClientFormSaveBar>
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          CLIENT_FORM_MAX_WIDTH,
          CLIENT_FORM_SCROLL_PADDING_CLASS
        )}
      >
        <ClientFormPageHeader title={title} description={description} />
        {children}
      </div>
    </ClientFormLayout>
  );
}

```

#### `features/clients/components/client-list-status-cell.tsx`

```tsx
"use client";

import { platformV6BadgeClass } from "@/components/platform/platform-v6-layout";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { CLIENT_STATUS_OPTIONS } from "@/features/clients/constants";
import {
  ONBOARDING_STATUS_LABELS,
  isClientOnboardingStatus,
  resolveClientListStatusBadges,
} from "@/lib/clients/onboarding-status";
import type { ClientStatus } from "@/types/database";
import { cn } from "@/lib/utils";

import { ClientStatusBadge } from "./client-status-badge";
import { OnboardingStatusBadge } from "./onboarding-status-badge";

type ClientListStatusCellProps = {
  status: ClientStatus;
  onboardingStatus: string | null | undefined;
  className?: string;
  /** Use thinkway-platform_6.html badge styling on list pages. */
  platformV6?: boolean;
};

function resolveV6BadgeClass(
  kind: "operational" | "onboarding",
  status: string
): string {
  if (kind === "operational") {
    if (status === "active") return platformV6BadgeClass("outline-green");
    return platformV6BadgeClass("gray");
  }
  if (status === "active") return platformV6BadgeClass("outline-green");
  if (status === "legal_pending") return platformV6BadgeClass("outline-amber");
  return platformV6BadgeClass("gray");
}

export function ClientListStatusCell({
  status,
  onboardingStatus,
  className,
  platformV6 = true,
}: ClientListStatusCellProps) {
  const badges = resolveClientListStatusBadges({ status, onboardingStatus });

  if (platformV6) {
    const operationalLabel =
      CLIENT_STATUS_OPTIONS.find((option) => option.value === badges.operationalStatus)
        ?.label ?? badges.operationalStatus;

    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <span className={resolveV6BadgeClass("operational", badges.operationalStatus)}>
          {operationalLabel}
        </span>
        {badges.onboardingStatus &&
        isClientOnboardingStatus(badges.onboardingStatus) ? (
          <span className={resolveV6BadgeClass("onboarding", badges.onboardingStatus)}>
            {ONBOARDING_STATUS_LABELS[badges.onboardingStatus]}
          </span>
        ) : null}
      </div>
    );
  }

  const badgeClassName = cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-medium");

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <ClientStatusBadge status={badges.operationalStatus} className={badgeClassName} />
      {badges.onboardingStatus ? (
        <OnboardingStatusBadge
          status={badges.onboardingStatus}
          className={badgeClassName}
        />
      ) : null}
    </div>
  );
}

```

#### `features/clients/components/client-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/types/database";

import { CLIENT_STATUS_OPTIONS } from "../constants";
import { resolveStatusTone } from "@/components/shared/status/status-utils";

type ClientStatusBadgeProps = {
  status: ClientStatus;
  className?: string;
};

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  const label =
    CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("client", status)}
      className={cn("font-medium", className)}
    />
  );
}

```

#### `features/clients/components/onboarding-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import {
  ONBOARDING_STATUS_LABELS,
  ONBOARDING_STATUS_TONE,
  type ClientOnboardingStatus,
} from "@/lib/clients/onboarding-status";
import { cn } from "@/lib/utils";

type OnboardingStatusBadgeProps = {
  status: ClientOnboardingStatus;
  className?: string;
};

export function OnboardingStatusBadge({ status, className }: OnboardingStatusBadgeProps) {
  return (
    <StatusBadge
      label={ONBOARDING_STATUS_LABELS[status]}
      tone={ONBOARDING_STATUS_TONE[status]}
      className={cn("font-medium", className)}
    />
  );
}

```

#### `features/clients/constants.ts`

```ts
import type { ClientStatus } from "@/types/database";
import {
  CLIENT_INDUSTRY_OPTIONS,
} from "@/lib/master-data/constants";
import { getCityOptionsForCountry } from "@/lib/master-data/cities";

export const CLIENTS_PAGE_SIZE = 10;

/** @deprecated Prefer intelligence category/subcategory on clients. */
export const INDUSTRY_OPTIONS = CLIENT_INDUSTRY_OPTIONS;

export const CLIENT_STATUS_OPTIONS: {
  value: ClientStatus;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export {
  AGENCY_OR_DIRECT_OPTIONS,
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  CLIENT_INDUSTRY_OPTIONS,
  CLIENT_SUBCATEGORY_BY_CATEGORY,
  COUNTRY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  getClientSubcategoryOptions as getLegacyClientSubcategoryOptions,
  labelForOption,
} from "@/lib/master-data/constants";

export {
  getClientCategoryOptions,
  getClientSubcategoryOptions,
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";

export { getCityOptionsForCountry };

```

#### `features/vendors/components/platform-accounts-editor.tsx`

```tsx
"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { EnrichmentStatusBadge } from "@/components/forms/enrichment-status-badge";
import { FieldError } from "@/components/forms/field-error";
import { PlatformMetricsSection } from "@/components/forms/platform-metrics-section";
import {
  ProfileUrlEnrichInput,
  type ProfileEnrichmentPayload,
} from "@/components/forms/profile-url-enrich-input";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  savePlatformAccountsAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { COUNTRY_OPTIONS, PLATFORM_OPTIONS } from "@/features/vendors/constants";
import { applyProfileEnrichment } from "@/lib/social/apply-profile-enrichment";
import {
  metricValueToInput,
  type MetricsSource,
} from "@/lib/social/enrichment/metrics-status";
import { PLATFORM_LABELS, type SocialPlatform } from "@/lib/social/platforms";
import type { InfluencerPlatformAccountRow, VendorDetail } from "@/types/database";

type EditableAccount = {
  key: string;
  id?: string;
  platform: string;
  username: string;
  profile_url: string;
  profile_display_name: string;
  profile_bio: string;
  profile_picture_url: string;
  follower_count: string;
  following_count: string;
  engagement_rate: string;
  avg_views: string;
  audience_country: string;
  audience_male_pct: string;
  audience_female_pct: string;
  is_verified: boolean;
  is_primary: boolean;
  sync_status: string;
  sync_source: string;
  sync_error: string;
  last_synced_at: string;
  metrics_source: MetricsSource;
  metrics_last_synced_at: string;
  metrics_is_manual_override: boolean;
  metric_field_sources: {
    followers: MetricsSource;
    engagement: MetricsSource;
    avg_views: MetricsSource;
  };
  duplicate_warning: string;
};

function readGenderSplit(
  split: Record<string, unknown> | null | undefined,
  key: string
): string {
  const value = split?.[key];
  if (typeof value === "number") {
    return String(value);
  }
  return "";
}

function resolveFieldSources(
  account: InfluencerPlatformAccountRow
): EditableAccount["metric_field_sources"] {
  const base = account.metrics_source ?? "unavailable";
  const manual = account.metrics_is_manual_override;

  return {
    followers:
      account.follower_count != null
        ? manual
          ? "manual"
          : "synced"
        : base,
    engagement:
      account.engagement_rate != null
        ? manual
          ? "manual"
          : "synced"
        : base,
    avg_views:
      account.avg_views != null ? (manual ? "manual" : "synced") : base,
  };
}

function toEditable(account: InfluencerPlatformAccountRow): EditableAccount {
  const split = account.audience_gender_split ?? {};
  const metricsSource = account.metrics_source ?? "unavailable";
  const manualOverride = account.metrics_is_manual_override ?? false;

  return {
    key: account.id,
    id: account.id,
    platform: account.platform,
    username: account.username ?? account.handle,
    profile_url: account.profile_url ?? "",
    profile_display_name: account.profile_display_name ?? "",
    profile_bio: account.profile_bio ?? "",
    profile_picture_url: account.profile_picture_url ?? "",
    follower_count: metricValueToInput(
      account.follower_count,
      metricsSource,
      manualOverride
    ),
    following_count: metricValueToInput(
      account.following_count,
      metricsSource,
      manualOverride
    ),
    engagement_rate:
      account.engagement_rate != null ? String(account.engagement_rate) : "",
    avg_views: metricValueToInput(account.avg_views, metricsSource, manualOverride),
    audience_country: account.audience_country ?? "",
    audience_male_pct: readGenderSplit(split, "male"),
    audience_female_pct: readGenderSplit(split, "female"),
    is_verified: account.is_verified,
    is_primary: account.is_primary,
    sync_status: account.sync_status ?? "manual",
    sync_source: account.sync_source ?? "",
    sync_error: account.sync_error ?? "",
    last_synced_at: account.last_synced_at ?? "",
    metrics_source: metricsSource,
    metrics_last_synced_at: account.metrics_last_synced_at ?? "",
    metrics_is_manual_override: manualOverride,
    metric_field_sources: resolveFieldSources(account),
    duplicate_warning: "",
  };
}

let newAccountCounter = 0;

function emptyAccount(): EditableAccount {
  newAccountCounter += 1;
  return {
    key: `new-${newAccountCounter}`,
    platform: "instagram",
    username: "",
    profile_url: "",
    profile_display_name: "",
    profile_bio: "",
    profile_picture_url: "",
    follower_count: "",
    following_count: "",
    engagement_rate: "",
    avg_views: "",
    audience_country: "",
    audience_male_pct: "",
    audience_female_pct: "",
    is_verified: false,
    is_primary: false,
    sync_status: "manual",
    sync_source: "",
    sync_error: "",
    last_synced_at: "",
    metrics_source: "unavailable",
    metrics_last_synced_at: "",
    metrics_is_manual_override: false,
    metric_field_sources: {
      followers: "unavailable",
      engagement: "unavailable",
      avg_views: "unavailable",
    },
    duplicate_warning: "",
  };
}

function markMetricManual(
  account: EditableAccount,
  field: keyof EditableAccount["metric_field_sources"],
  value: string
): EditableAccount {
  return {
    ...account,
    metrics_is_manual_override: true,
    metrics_source: "manual",
    metric_field_sources: {
      ...account.metric_field_sources,
      [field]: value.trim() ? "manual" : account.metric_field_sources[field],
    },
  };
}

type PlatformAccountsEditorProps = {
  vendor: VendorDetail;
};

export function PlatformAccountsEditor({ vendor }: PlatformAccountsEditorProps) {
  const initial = useMemo(
    () =>
      vendor.platform_accounts.length > 0
        ? vendor.platform_accounts.map(toEditable)
        : [emptyAccount()],
    [vendor.platform_accounts]
  );

  const [accounts, setAccounts] = useState<EditableAccount[]>(initial);

  const [state, formAction, isPending] = useActionState(
    savePlatformAccountsAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const handleEnriched = useCallback(
    (key: string) => (payload: ProfileEnrichmentPayload) => {
      setAccounts((prev) =>
        prev.map((row) =>
          row.key === key ? applyProfileEnrichment(row, payload) : row
        )
      );
    },
    []
  );

  const handleRefreshEnrichment = useCallback(
    (key: string) => (payload: ProfileEnrichmentPayload) => {
      setAccounts((prev) =>
        prev.map((row) =>
          row.key === key
            ? applyProfileEnrichment(row, payload, {
                preserveManualMetrics: row.metrics_is_manual_override,
              })
            : row
        )
      );
    },
    []
  );

  const accountsJson = JSON.stringify(
    accounts.map((account) => ({
      id: account.id,
      platform: account.platform,
      username: account.username,
      profile_url: account.profile_url,
      profile_display_name: account.profile_display_name,
      profile_bio: account.profile_bio,
      profile_picture_url: account.profile_picture_url,
      follower_count: account.follower_count,
      following_count: account.following_count,
      engagement_rate: account.engagement_rate,
      avg_views: account.avg_views,
      audience_country: account.audience_country,
      audience_male_pct: account.audience_male_pct,
      audience_female_pct: account.audience_female_pct,
      is_verified: account.is_verified,
      is_primary: account.is_primary,
      sync_status: account.sync_status,
      sync_source: account.sync_source,
      sync_error: account.sync_error,
      last_synced_at: account.last_synced_at,
      metrics_source: account.metrics_source,
      metrics_last_synced_at: account.metrics_last_synced_at,
      metrics_is_manual_override: account.metrics_is_manual_override,
    }))
  );

  return (
    <OperationalFormSection
      title="Platform accounts"
      description="Paste a profile URL to auto-detect platform and public stats. Empty metrics mean data was unavailable — not zero followers."
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAccounts((prev) => [...prev, emptyAccount()])}
        >
          <PlusIcon data-icon="inline-start" />
          Add platform
        </Button>
      }
      footer={
        <Button type="submit" form="platform-accounts-form" disabled={isPending}>
          {isPending ? "Saving…" : "Save platforms"}
        </Button>
      }
    >
        <form id="platform-accounts-form" action={formAction} className="space-y-4">
          <input type="hidden" name="influencer_id" value={vendor.id} />
          <input type="hidden" name="accounts_json" value={accountsJson} />

          {accounts.map((account, index) => (
            <div
              key={account.key}
              className="space-y-4 rounded-3xl border border-border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Platform {index + 1}</p>
                  {account.platform ? (
                    <Badge variant="secondary">
                      {PLATFORM_LABELS[account.platform as SocialPlatform] ??
                        account.platform}
                    </Badge>
                  ) : null}
                  <EnrichmentStatusBadge status={account.sync_status} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={account.is_primary}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAccounts((prev) =>
                          prev.map((row) => ({
                            ...row,
                            is_primary:
                              row.key === account.key
                                ? checked
                                : checked
                                  ? false
                                  : row.is_primary,
                          }))
                        );
                      }}
                    />
                    Primary
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={accounts.length <= 1}
                    onClick={() =>
                      setAccounts((prev) =>
                        prev.filter((row) => row.key !== account.key)
                      )
                    }
                  >
                    <Trash2Icon className="size-4" />
                    <span className="sr-only">Remove platform</span>
                  </Button>
                </div>
              </div>

              {(account.profile_picture_url ||
                account.profile_display_name ||
                account.profile_bio) && (
                <div className="flex gap-3 rounded-2xl bg-muted/40 p-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                    {account.profile_picture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={account.profile_picture_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {account.username.slice(0, 2).toUpperCase() || "CR"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    {account.profile_display_name ? (
                      <p className="truncate text-sm font-medium">
                        {account.profile_display_name}
                        {account.is_verified ? (
                          <span className="ml-1 text-xs text-blue-500">✓</span>
                        ) : null}
                      </p>
                    ) : null}
                    {account.profile_bio ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {account.profile_bio}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              <ProfileUrlEnrichInput
                id={`profile-url-${account.key}`}
                value={account.profile_url}
                platformHint={account.platform as SocialPlatform}
                influencerId={vendor.id}
                accountId={account.id}
                onValueChange={(value) =>
                  setAccounts((prev) =>
                    prev.map((row) =>
                      row.key === account.key
                        ? { ...row, profile_url: value, duplicate_warning: "" }
                        : row
                    )
                  )
                }
                onEnriched={handleEnriched(account.key)}
              />

              {account.duplicate_warning ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {account.duplicate_warning}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Platform</Label>
                  <Select
                    value={account.platform}
                    onValueChange={(value) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, platform: value }
                            : row
                        )
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Username</Label>
                  <Input
                    value={account.username}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, username: e.target.value }
                            : row
                        )
                      )
                    }
                    placeholder="@creator"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Display name</Label>
                  <Input
                    value={account.profile_display_name}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, profile_display_name: e.target.value }
                            : row
                        )
                      )
                    }
                    placeholder="Public display name"
                  />
                </div>
              </div>

              <PlatformMetricsSection
                platform={account.platform}
                profileUrl={account.profile_url}
                influencerId={vendor.id}
                accountId={account.id}
                followerCount={account.follower_count}
                engagementRate={account.engagement_rate}
                avgViews={account.avg_views}
                metricsSource={account.metrics_source}
                metricsIsManualOverride={account.metrics_is_manual_override}
                metricFieldSources={account.metric_field_sources}
                fieldIdPrefix={account.key}
                onFollowersChange={(value) =>
                  setAccounts((prev) =>
                    prev.map((row) =>
                      row.key === account.key
                        ? {
                            ...markMetricManual(row, "followers", value),
                            follower_count: value,
                          }
                        : row
                    )
                  )
                }
                onEngagementChange={(value) =>
                  setAccounts((prev) =>
                    prev.map((row) =>
                      row.key === account.key
                        ? {
                            ...markMetricManual(row, "engagement", value),
                            engagement_rate: value,
                          }
                        : row
                    )
                  )
                }
                onAvgViewsChange={(value) =>
                  setAccounts((prev) =>
                    prev.map((row) =>
                      row.key === account.key
                        ? {
                            ...markMetricManual(row, "avg_views", value),
                            avg_views: value,
                          }
                        : row
                    )
                  )
                }
                onRefreshEnrichment={handleRefreshEnrichment(account.key)}
              />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Following</Label>
                  <Input
                    type="number"
                    min={0}
                    value={account.following_count}
                    placeholder="Not available"
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, following_count: e.target.value }
                            : row
                        )
                      )
                    }
                    className="border-dashed"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Audience country</Label>
                  <SearchableSelect
                    value={account.audience_country}
                    onValueChange={(value) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, audience_country: value }
                            : row
                        )
                      )
                    }
                    options={COUNTRY_OPTIONS}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Audience male %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={account.audience_male_pct}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? { ...row, audience_male_pct: e.target.value }
                            : row
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Audience female %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={account.audience_female_pct}
                    onChange={(e) =>
                      setAccounts((prev) =>
                        prev.map((row) =>
                          row.key === account.key
                            ? {
                                ...row,
                                audience_female_pct: e.target.value,
                              }
                            : row
                        )
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          <FieldError messages={state.fieldErrors?.accounts_json} />

        </form>
    </OperationalFormSection>
  );
}

```

#### `features/vendors/components/tabs/vendor-activity-tab.tsx`

```tsx
"use client";

import { format } from "date-fns";
import { HistoryIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { VENDOR_DELIVERABLES_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type DeliverableRow = VendorWorkspace["deliverables"][number];

const VENDOR_DELIVERABLES_COLUMNS: OperationalConfigurableColumnDef<DeliverableRow>[] = [
  {
    id: "deliverable",
    label: "Deliverable",
    renderCell: (deliverable) => (
      <>
        <span className="font-medium text-foreground">{deliverable.title}</span>
        {deliverable.document_number ? (
          <p className="text-[10px] text-muted-foreground">
            <DocumentNumber value={deliverable.document_number} />
          </p>
        ) : null}
      </>
    ),
  },
  {
    id: "campaign",
    label: "Campaign",
    cellClassName: "text-muted-foreground",
    renderCell: (deliverable) => deliverable.campaign_name ?? "—",
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize text-muted-foreground",
    renderCell: (deliverable) => deliverable.status.replace(/_/g, " "),
  },
];

export function VendorActivityTab({
  workspace,
  onCancel,
}: {
  workspace: VendorWorkspace;
  onCancel?: () => void;
}) {
  const recentDeliverables = workspace.deliverables.slice(0, 10);

  return (
    <VendorProfileTabShell
      title="Activity & Audit"
      description="Profile edits, assignments, and operational changes."
      onCancel={onCancel}
    >
      <div className="grid gap-[18px] xl:grid-cols-2">
        <VendorFormSection
          icon={HistoryIcon}
          title="Activity log"
          description="Recent profile and operational events."
        >
          {workspace.activity.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No activity recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {workspace.activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-[13px] font-medium capitalize text-foreground">
                      {item.summary}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.actor?.full_name ?? item.actor?.email ?? "System"}
                    </p>
                  </div>
                  <time className="shrink-0 text-[11px] text-muted-foreground">
                    {format(new Date(item.created_at), "MMM d, yyyy HH:mm")}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </VendorFormSection>

        <VendorFormSection
          icon={HistoryIcon}
          title="Recent deliverables"
          description="Latest deliverables across campaign assignments."
        >
          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.vendorDeliverablesActivity}
            columns={VENDOR_DELIVERABLES_COLUMNS}
            rows={recentDeliverables}
            filterAccessors={VENDOR_DELIVERABLES_FILTER_ACCESSORS}
          >
            <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
              <OperationalTableControlsSlot contextLabel="Vendor deliverables" />
            </div>
            {workspace.deliverables.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">
                No deliverables.
              </p>
            ) : (
              <OperationalConfigurableTable
                columns={VENDOR_DELIVERABLES_COLUMNS}
                rows={recentDeliverables}
                rowKey={(deliverable) => deliverable.id}
              />
            )}
          </OperationalTableSuiteProvider>
        </VendorFormSection>
      </div>
    </VendorProfileTabShell>
  );
}

```

#### `features/vendors/components/tabs/vendor-assignments-tab.tsx`

```tsx
"use client";

import { BriefcaseIcon } from "lucide-react";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { DocumentNumber } from "@/components/ui/document-number";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { AssignmentStatusBadge } from "@/features/campaigns/components/assignment-status-badge";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { LINE_BILLING_STATUS_LABELS, VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";
import { VENDOR_ASSIGNMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type AssignmentRow = VendorWorkspace["assignments"][number];

function buildVendorAssignmentsColumns(
  currency: string
): OperationalConfigurableColumnDef<AssignmentRow>[] {
  return [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (assignment) => (
        <>
          {assignment.campaign_id ? (
            <Link
              href={`/campaigns/${assignment.campaign_id}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
            >
              {assignment.campaign_name}
            </Link>
          ) : (
            "—"
          )}
          {assignment.campaign_document_number ? (
            <p className="text-[10px] text-muted-foreground">
              <DocumentNumber value={assignment.campaign_document_number} />
            </p>
          ) : null}
        </>
      ),
    },
    {
      id: "assignment_line",
      label: "Assignment line",
      renderCell: (assignment) => (
        <>
          <span className="font-medium text-foreground">{assignment.line_name ?? "—"}</span>
          {assignment.line_document_number ? (
            <p className="text-[10px] text-muted-foreground">
              <DocumentNumber value={assignment.line_document_number} />
            </p>
          ) : null}
        </>
      ),
    },
    {
      id: "ops_status",
      label: "Ops status",
      renderCell: (assignment) =>
        assignment.assignment_status ? (
          <AssignmentStatusBadge
            status={
              assignment.assignment_status as import("@/features/campaigns/types").CampaignLineAssignmentStatus
            }
          />
        ) : (
          "—"
        ),
    },
    {
      id: "billing",
      label: "Billing",
      renderCell: (assignment) => (
        <Badge
          variant="outline"
          className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
        >
          {assignment.billing_status
            ? LINE_BILLING_STATUS_LABELS[assignment.billing_status]
            : "—"}
        </Badge>
      ),
    },
    {
      id: "revenue",
      label: "Revenue",
      amountCell: true,
      amountVariant: "revenue",
      renderCell: (assignment) =>
        formatMoney(assignment.revenue, assignment.currency || currency),
    },
    {
      id: "cost",
      label: "Cost",
      amountCell: true,
      amountVariant: "cost",
      renderCell: (assignment) =>
        formatMoney(assignment.cost, assignment.currency || currency),
    },
    {
      id: "gp",
      label: "GP",
      amountCell: true,
      amountVariant: "gp",
      amountValue: (assignment) => assignment.gp,
      renderCell: (assignment) =>
        formatMoney(assignment.gp, assignment.currency || currency),
    },
    {
      id: "payout",
      label: "Payout",
      renderCell: (assignment) =>
        assignment.vendor_payment_status ? (
          <Badge
            variant="secondary"
            className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
          >
            {VENDOR_PAYMENT_STATUS_LABELS[assignment.vendor_payment_status]}
          </Badge>
        ) : (
          "—"
        ),
    },
  ];
}

export function VendorAssignmentsTab({
  workspace,
  onCancel,
}: {
  workspace: VendorWorkspace;
  onCancel?: () => void;
}) {
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";
  const columns = useMemo(
    () => buildVendorAssignmentsColumns(currency),
    [currency]
  );

  return (
    <VendorProfileTabShell
      title="Assignments"
      description="Campaign lines, deliverables, commercial terms, and operational status."
      onCancel={onCancel}
    >
      <div className="grid gap-[18px]">
        <VendorFormSection
          icon={BriefcaseIcon}
          title="Assignment history"
          description="All campaign assignments linked to this creator."
        >
          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.vendorAssignments}
            columns={columns}
            rows={workspace.assignments}
            filterAccessors={VENDOR_ASSIGNMENTS_FILTER_ACCESSORS}
          >
            <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
              <OperationalTableControlsSlot contextLabel="Vendor assignments" />
            </div>
            {workspace.assignments.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">
                No campaign assignments yet.
              </p>
            ) : (
              <OperationalConfigurableTable
                columns={columns}
                rows={workspace.assignments}
                rowKey={(assignment) => assignment.id}
              />
            )}
          </OperationalTableSuiteProvider>
        </VendorFormSection>

        <VendorFormSection
          icon={BriefcaseIcon}
          title="Platform performance summary"
          description="Aggregate GP contribution across assignments."
        >
          <p className="text-[13px] leading-relaxed text-[#5B6575]">
            GP contribution: {formatMoney(workspace.financials.total_gp, currency)} (
            {formatPercent(workspace.financials.margin_percent)} margin) across{" "}
            {workspace.counts.assignments} assignment(s).
          </p>
        </VendorFormSection>
      </div>
    </VendorProfileTabShell>
  );
}

```

#### `features/vendors/components/tabs/vendor-bank-details-section.tsx`

```tsx
"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useFormActionWithToast } from "@/hooks/use-form-action-with-toast";

import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { DocumentUploadForm } from "@/components/forms/document-upload-form";
import { FieldError } from "@/components/forms/field-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DETAIL_FORM_INPUT_CLASS,
  DETAIL_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/campaigns/components/operational-detail-panel";
import { DocumentDownloadButton } from "@/features/documents";
import {
  getInfluencerDocumentDownloadUrlAction,
  updateVendorBankDetailsAction,
  uploadInfluencerDocumentAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { PAYMENT_TERMS_OPTIONS } from "@/features/vendors/constants";
import type { VendorWorkspace } from "@/features/vendors/types";
import {
  hasVendorBankDetails,
  parseVendorPaymentDetails,
} from "@/features/vendors/utils";
import {
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  VENDOR_PAYMENT_METHOD_OPTIONS,
} from "@/lib/master-data/constants";
import { cn } from "@/lib/utils";

const INITIAL_STATE: FormActionState = { ok: false };

const BANK_LETTER_OPTIONS = INFLUENCER_DOCUMENT_TYPE_OPTIONS.filter(
  (option) => option.value === "bank_letter"
);

type VendorBankDetailsSectionProps = {
  workspace: VendorWorkspace;
};

export function VendorBankDetailsSection({ workspace }: VendorBankDetailsSectionProps) {
  const paymentDetails = useMemo(
    () => parseVendorPaymentDetails(workspace.payment_details),
    [workspace.payment_details]
  );
  const bankConfigured = useMemo(
    () => hasVendorBankDetails(workspace.payment_details),
    [workspace.payment_details]
  );
  const [paymentTerms, setPaymentTerms] = useState<string>(
    workspace.payment_terms ?? "net_30"
  );
  const [paymentMethod, setPaymentMethod] = useState(paymentDetails.payment_method);

  const [state, formAction, isPending] = useFormActionWithToast(
    updateVendorBankDetailsAction,
    INITIAL_STATE
  );

  const bankLetters = useMemo(
    () =>
      workspace.documents.filter((document) => document.document_type === "bank_letter"),
    [workspace.documents]
  );
  const latestBankLetter = bankLetters[0] ?? null;

  useEffect(() => {
    setPaymentTerms(workspace.payment_terms ?? "net_30");
    setPaymentMethod(paymentDetails.payment_method);
  }, [workspace.payment_terms, workspace.updated_at, paymentDetails.payment_method]);

  return (
    <div className="space-y-4 px-4 md:px-5">
      <CampaignFlatSection
        title="Vendor payout bank details"
        description="Saved here on Billing & Payments and rendered live on Vendor IO Section 6 (Vendor Payment Details)."
        actions={
          bankConfigured ? (
            <Badge variant="secondary" className="font-normal">
              Linked to Vendor IO
            </Badge>
          ) : (
            <Badge variant="outline" className="font-normal">
              Required for IO payout block
            </Badge>
          )
        }
      >
        <form id="vendor-bank-details-form" action={formAction} className="grid gap-4">
          <input type="hidden" name="influencer_id" value={workspace.id} />
          <input type="hidden" name="payment_terms" value={paymentTerms} />
          <input type="hidden" name="payment_method" value={paymentMethod} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label>Payment terms</Label>
              <Select
                value={paymentTerms}
                onValueChange={setPaymentTerms}
                disabled={isPending}
              >
                <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue placeholder="Select terms" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                disabled={isPending}
              >
                <SelectTrigger className={cn(DETAIL_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="beneficiary_name">Beneficiary name</Label>
              <Input
                id="beneficiary_name"
                name="beneficiary_name"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={
                  paymentDetails.beneficiary_name ||
                  workspace.legal_name ||
                  workspace.display_name
                }
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.beneficiary_name} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bank_name">Bank name</Label>
              <Input
                id="bank_name"
                name="bank_name"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.bank_name}
                placeholder="e.g. Arab African International Bank"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.bank_name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank_branch">Branch</Label>
              <Input
                id="bank_branch"
                name="bank_branch"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.bank_branch}
                placeholder="e.g. Park Street Branch"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="account_number">Account number</Label>
              <Input
                id="account_number"
                name="account_number"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.account_number}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.account_number} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="swift">SWIFT / BIC</Label>
              <Input
                id="swift"
                name="swift"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.swift}
                disabled={isPending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                name="iban"
                className={DETAIL_FORM_INPUT_CLASS}
                defaultValue={paymentDetails.iban}
                placeholder="EG00…"
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.iban} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4">
            <p className="text-[11px] text-muted-foreground">
              Updates apply immediately to{" "}
              <Link href="/ios/vendor" className="text-foreground hover:underline">
                Vendor IO
              </Link>{" "}
              preview and HTML export.
            </p>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save bank details"}
            </Button>
          </div>
        </form>
      </CampaignFlatSection>

      <CampaignFlatSection
        title="Bank letter"
        description="Upload the vendor's official bank confirmation letter for treasury verification."
      >
        {latestBankLetter ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">{latestBankLetter.file_name}</p>
              <p className="text-xs text-muted-foreground">
                Uploaded {format(new Date(latestBankLetter.created_at), "MMM d, yyyy")}
              </p>
            </div>
            <DocumentDownloadButton
              documentId={latestBankLetter.id}
              entityId={workspace.id}
              getDownloadUrl={getInfluencerDocumentDownloadUrlAction}
            />
          </div>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground">
            No bank letter on file yet.
          </p>
        )}

        <DocumentUploadForm
          entityId={workspace.id}
          documentTypeOptions={BANK_LETTER_OPTIONS}
          defaultDocumentType="bank_letter"
          action={uploadBankLetterWrapper}
        />
      </CampaignFlatSection>
    </div>
  );
}

async function uploadBankLetterWrapper(
  prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const mapped = new FormData();
  mapped.set("influencer_id", String(formData.get("entity_id") ?? ""));
  mapped.set("document_type", "bank_letter");
  mapped.set("expires_at", String(formData.get("expires_at") ?? ""));
  const file = formData.get("file");
  if (file) {
    mapped.set("file", file);
  }
  return uploadInfluencerDocumentAction(prev, mapped);
}

```

#### `features/vendors/components/tabs/vendor-billing-tab.tsx`

```tsx
"use client";

import {
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import { OPERATIONAL_CHROME_STATUS_BADGE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { VendorBankDetailsSection } from "@/features/vendors/components/tabs/vendor-bank-details-section";
import { VendorFinanceTab } from "@/features/vendors/components/tabs/vendor-finance-tab";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, hasVendorBankDetails } from "@/features/vendors/utils";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { cn } from "@/lib/utils";
import { VENDOR_PAYMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import { VENDOR_PAYOUTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type PayoutRow = VendorWorkspace["payouts"][number];

const VENDOR_BILLING_COLUMNS: OperationalConfigurableColumnDef<PayoutRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    cellClassName: "text-muted-foreground",
    renderCell: (payout) => payout.campaign_name ?? "—",
  },
  {
    id: "amount",
    label: "Amount",
    amountCell: true,
    renderCell: (payout) => formatMoney(payout.amount, payout.currency),
  },
  {
    id: "status",
    label: "Status",
    renderCell: (payout) => (
      <Badge
        variant="outline"
        className={cn(OPERATIONAL_CHROME_STATUS_BADGE, "font-normal")}
      >
        {VENDOR_PAYMENT_STATUS_LABELS[payout.status] ?? payout.status}
      </Badge>
    ),
  },
];

export function VendorBillingTab({
  workspace,
  currencyOptions = [],
  onCancel,
}: {
  workspace: VendorWorkspace;
  currencyOptions?: { value: string; label: string }[];
  onCancel?: () => void;
}) {
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";
  const { financials } = workspace;

  const summaryItems: KpiCarouselItem[] = [
    {
      id: "revenue",
      label: "Assignment revenue",
      value: formatMoney(financials.total_revenue, currency),
      icon: TrendingUpIcon,
      accentKey: "purple",
    },
    {
      id: "cost",
      label: "Creator cost",
      value: formatMoney(financials.total_cost, currency),
      icon: WalletIcon,
      accentKey: "pink",
    },
    {
      id: "gp",
      label: "GP contribution",
      value: formatMoney(financials.total_gp, currency),
      icon: TrendingUpIcon,
      accentKey: "green",
    },
    {
      id: "invoiced",
      label: "Invoiced",
      value: formatMoney(financials.invoiced_amount, currency),
      icon: ReceiptIcon,
      accentKey: "blue",
    },
    {
      id: "paid",
      label: "Paid out",
      value: formatMoney(financials.paid_out, currency),
      icon: WalletIcon,
      accentKey: "green",
    },
    {
      id: "pending",
      label: "Pending payout",
      value: formatMoney(financials.pending_payout, currency),
      icon: ReceiptIcon,
      accentKey: "pink",
    },
  ];

  const bankConfigured = hasVendorBankDetails(workspace.payment_details);

  return (
    <VendorProfileTabShell
      title="Billing & Payments"
      description={
        bankConfigured
          ? "Vendor payout bank details are on file and linked to Vendor IO Section 6."
          : "Add vendor bank details below — they flow into Vendor IO payment terms automatically."
      }
      onCancel={onCancel}
    >
      <div className="grid gap-[18px]">
        <VendorBankDetailsSection workspace={workspace} />

        <VendorFinanceTab
          vendor={workspace}
          currencyOptions={currencyOptions}
          hidePaymentTerms
          embedded
          quotationPriceReference={workspace.quotation_price_reference}
        />

        <KpiStrip items={summaryItems} showNavigation={false} />

        <VendorFormSection
          icon={ReceiptIcon}
          title="Payout history"
          description="Creator payouts linked to campaign assignments and payment batches."
        >
          <OperationalTableSuiteProvider
            tableId={OPERATIONAL_TABLE_IDS.vendorBilling}
            columns={VENDOR_BILLING_COLUMNS}
            rows={workspace.payouts}
            filterAccessors={VENDOR_PAYOUTS_FILTER_ACCESSORS}
          >
            <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
              <OperationalTableControlsSlot contextLabel="Vendor billing" />
            </div>
            {workspace.payouts.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">
                No payout records.
              </p>
            ) : (
              <OperationalConfigurableTable
                columns={VENDOR_BILLING_COLUMNS}
                rows={workspace.payouts}
                rowKey={(payout) => payout.id}
              />
            )}
          </OperationalTableSuiteProvider>
        </VendorFormSection>
      </div>
    </VendorProfileTabShell>
  );
}

```

#### `features/vendors/components/tabs/vendor-campaigns-tab.tsx`

```tsx
"use client";

import Link from "next/link";
import { HistoryIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VENDOR_CAMPAIGNS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  VendorFormSection,
  VendorProfileTabShell,
} from "@/features/vendors/components/vendor-form-ui";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { VendorDetail } from "@/types/database";

type AssignmentRow = VendorDetail["campaign_assignments"][number];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const VENDOR_CAMPAIGNS_COLUMNS: OperationalConfigurableColumnDef<AssignmentRow>[] = [
  {
    id: "campaign",
    label: "Campaign",
    renderCell: (assignment) =>
      assignment.campaign ? (
        <Link
          href={`/campaigns/${assignment.campaign.id}`}
          className="font-medium hover:text-primary"
        >
          {assignment.campaign.name}
        </Link>
      ) : (
        "—"
      ),
  },
  {
    id: "campaign_number",
    label: "Campaign #",
    monoCell: true,
    renderCell: (assignment) => (
      <DocumentNumber value={assignment.campaign?.document_number} />
    ),
  },
  {
    id: "status",
    label: "Status",
    cellClassName: "capitalize",
    renderCell: (assignment) => assignment.status.replace(/_/g, " "),
  },
  {
    id: "agreed_fee",
    label: "Agreed fee",
    amountCell: true,
    renderCell: (assignment) =>
      formatMoney(Number(assignment.agreed_fee), assignment.currency),
  },
];

export const VENDOR_CAMPAIGNS_TABLE_COLUMNS = VENDOR_CAMPAIGNS_COLUMNS;

export function VendorCampaignsTab({
  vendor,
  onCancel,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
}) {
  return (
    <VendorProfileTabShell
      title="Campaign history"
      description="Campaign assignments for this creator."
      onCancel={onCancel}
    >
      <VendorFormSection
        icon={HistoryIcon}
        title="Assignments"
        description="Historical campaign links and agreed fees."
      >
        <OperationalTableSuiteProvider
          tableId={OPERATIONAL_TABLE_IDS.vendorCampaigns}
          columns={VENDOR_CAMPAIGNS_TABLE_COLUMNS}
          rows={vendor.campaign_assignments}
          filterAccessors={VENDOR_CAMPAIGNS_FILTER_ACCESSORS}
        >
          <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
            <OperationalTableControlsSlot contextLabel="Vendor campaigns" />
          </div>
          {vendor.campaign_assignments.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              Not assigned to any campaigns yet.
            </p>
          ) : (
            <OperationalConfigurableTable
              columns={VENDOR_CAMPAIGNS_COLUMNS}
              rows={vendor.campaign_assignments}
              rowKey={(assignment) => assignment.id}
            />
          )}
        </OperationalTableSuiteProvider>
      </VendorFormSection>
    </VendorProfileTabShell>
  );
}

```

#### `features/vendors/components/tabs/vendor-contracts-tab.tsx`

```tsx
"use client";

import { VendorLegalTab } from "@/features/vendors/components/tabs/vendor-legal-tab";
import type { VendorWorkspace } from "@/features/vendors/types";

export function VendorContractsTab({
  vendor,
  onCancel,
  shortcutsEnabled = true,
}: {
  vendor: VendorWorkspace;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
}) {
  return (
    <VendorLegalTab
      vendor={vendor}
      onCancel={onCancel}
      shortcutsEnabled={shortcutsEnabled}
    />
  );
}

```

#### `features/vendors/components/tabs/vendor-documents-tab.tsx`

```tsx
"use client";

import { useMemo } from "react";

import { DocumentWorkspace } from "@/features/documents";
import {
  deleteInfluencerDocumentAction,
  getInfluencerDocumentDownloadUrlAction,
  uploadInfluencerDocumentAction,
} from "@/features/vendors/actions";
import {
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  labelForOption,
} from "@/features/vendors/constants";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { VENDOR_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import type { VendorDetail } from "@/types/database";
import type { DocumentFilterAccessors } from "@/features/documents/document-types";

export function VendorDocumentsTab({
  vendor,
  onCancel,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
}) {
  const config = useMemo(
    () => ({
      entityKind: "vendor" as const,
      tableId: OPERATIONAL_TABLE_IDS.vendorDocuments,
      contextLabel: "Vendor documents",
      documentTypeOptions: INFLUENCER_DOCUMENT_TYPE_OPTIONS,
      filterAccessors:
        VENDOR_DOCUMENTS_FILTER_ACCESSORS as DocumentFilterAccessors<
          VendorDetail["documents"][number]
        >,
      entityIdField: "influencer_id",
      getDownloadUrl: getInfluencerDocumentDownloadUrlAction,
      deleteAction: deleteInfluencerDocumentAction,
      uploadAction: uploadInfluencerDocumentAction,
      resolveTypeLabel: (documentType: string) =>
        labelForOption(INFLUENCER_DOCUMENT_TYPE_OPTIONS, documentType),
    }),
    []
  );

  return (
    <DocumentWorkspace
      entityId={vendor.id}
      documents={vendor.documents}
      config={config}
      layout="vendor"
      uploadDescription="Attach trade licenses, IDs, and other vendor files."
      onCancel={onCancel}
    />
  );
}

```

#### `features/vendors/components/tabs/vendor-finance-tab.tsx`

```tsx
"use client";

import { useState } from "react";
import { DollarSignIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/forms/field-error";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormActionWithToast } from "@/hooks/use-form-action-with-toast";
import {
  updateVendorFinanceAction,
  type FormActionState,
} from "@/features/vendors/actions";
import { PAYMENT_TERMS_OPTIONS } from "@/features/vendors/constants";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormSection,
  VendorProfileTabShell,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import { parseRateCard } from "@/features/vendors/utils";
import type { VendorDetail } from "@/types/database";
import { cn } from "@/lib/utils";
import { CreatorQuotationPriceReferencePanel } from "@/components/creator/creator-quotation-price-reference-panel";
import type { CreatorQuotationPriceReference } from "@/lib/creators/quotation-price-reference";

export function VendorFinanceTab({
  vendor,
  currencyOptions = [],
  sectionTitle = "Rate card & tax",
  hidePaymentTerms = false,
  embedded = false,
  quotationPriceReference = null,
  onCancel,
}: {
  vendor: VendorDetail;
  currencyOptions?: { value: string; label: string }[];
  sectionTitle?: string;
  /** Billing tab already edits payment terms via bank details. */
  hidePaymentTerms?: boolean;
  embedded?: boolean;
  quotationPriceReference?: CreatorQuotationPriceReference | null;
  onCancel?: () => void;
}) {
  const rate = parseRateCard(vendor.rate_card);
  const [paymentTerms, setPaymentTerms] = useState(vendor.payment_terms ?? "");
  const [currency, setCurrency] = useState(rate.currency ?? "USD");
  const [vatRegistered, setVatRegistered] = useState(
    (vendor as { vat_registered?: boolean }).vat_registered ?? false
  );

  const [state, formAction, isPending] = useFormActionWithToast(
    updateVendorFinanceAction,
    { ok: false } satisfies FormActionState
  );

  const form = (
    <form action={formAction} className="grid gap-[18px]">
      <input type="hidden" name="influencer_id" value={vendor.id} />
      <input type="hidden" name="payment_terms" value={paymentTerms} />
      <input type="hidden" name="pricing_currency" value={currency} />

      <VendorFormSection
        icon={DollarSignIcon}
        title={sectionTitle}
        description="Base rates, currency, and tax registration."
      >
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {vatRegistered ? (
            <Badge variant="secondary">VAT Registered</Badge>
          ) : (
            <Badge variant="outline">Non-VAT</Badge>
          )}
        </div>

        <VendorFormGrid className="lg:grid-cols-3">
          {hidePaymentTerms ? null : (
            <VendorFormField label="Payment terms">
              <Select
                value={paymentTerms}
                onValueChange={setPaymentTerms}
                disabled={isPending}
              >
                <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                  <SelectValue placeholder="Select terms" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </VendorFormField>
          )}
          <VendorFormField label="Rate card currency">
            <Select value={currency} onValueChange={setCurrency} disabled={isPending}>
              <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </VendorFormField>
          <VendorFormField label="Base rate" htmlFor="pricing_amount">
            <Input
              id="pricing_amount"
              name="pricing_amount"
              type="number"
              min={0}
              step="0.01"
              className={VENDOR_FORM_INPUT_CLASS}
              defaultValue={rate.base_rate != null ? String(rate.base_rate) : ""}
              disabled={isPending}
            />
            <FieldError messages={state.fieldErrors?.pricing_amount} />
          </VendorFormField>
        </VendorFormGrid>

        <VendorFormGrid className="lg:grid-cols-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input
              type="checkbox"
              checked={vatRegistered}
              onChange={(e) => setVatRegistered(e.target.checked)}
              disabled={isPending}
              className="size-4 rounded border border-input"
            />
            VAT registered vendor
          </label>
          <input type="hidden" name="vat_registered" value={vatRegistered ? "1" : "0"} />
          <VendorFormField label="Default VAT %" htmlFor="default_vat_percent">
            <Input
              id="default_vat_percent"
              name="default_vat_percent"
              type="number"
              min={0}
              max={100}
              step="0.001"
              className={VENDOR_FORM_INPUT_CLASS}
              defaultValue={String(
                (vendor as { default_vat_percent?: number }).default_vat_percent ?? 0
              )}
              disabled={isPending || !vatRegistered}
            />
          </VendorFormField>
          <VendorFormField
            label="Tax registration number"
            htmlFor="tax_registration_number"
            className="sm:col-span-2"
          >
            <Input
              id="tax_registration_number"
              name="tax_registration_number"
              className={VENDOR_FORM_INPUT_CLASS}
              defaultValue={
                (vendor as { tax_registration_number?: string | null })
                  .tax_registration_number ?? ""
              }
              disabled={isPending || !vatRegistered}
            />
          </VendorFormField>
        </VendorFormGrid>

        {!embedded ? (
          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="submit"
              className="inline-flex h-auto items-center rounded-[10px] border-transparent bg-[linear-gradient(135deg,#0057FF_0%,#2E74FF_55%,#1A6FFF_100%)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(0,87,255,0.3)] disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save rate card"}
            </button>
          </div>
        ) : null}
      </VendorFormSection>

      <VendorFormSection
        icon={DollarSignIcon}
        title="Quotation price reference"
        description="Average creator cost from quotation lines — used in studio and influencer selection."
      >
        <CreatorQuotationPriceReferencePanel reference={quotationPriceReference} />
      </VendorFormSection>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <VendorProfileTabShell
      title="Finance"
      description="Rate card, currency, and tax registration for this creator."
      onCancel={onCancel}
    >
      {form}
    </VendorProfileTabShell>
  );
}

```

#### `features/vendors/components/tabs/vendor-legal-tab.tsx`

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { ScaleIcon } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateVendorLegalAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
} from "@/features/vendors/constants";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormKeyboardShortcuts,
  VendorFormSection,
  VendorProfileTabShell,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_SELECT_TRIGGER_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import type {
  ContractStatus,
  ExclusivityType,
  VendorDetail,
} from "@/types/database";
import { cn } from "@/lib/utils";

export function VendorLegalTab({
  vendor,
  onCancel,
  shortcutsEnabled = true,
  embedded = false,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
  /** When true, render form only (parent provides shell). */
  embedded?: boolean;
}) {
  const [contractStatus, setContractStatus] = useState(
    vendor.contract_status ?? "none"
  );
  const [exclusivity, setExclusivity] = useState(vendor.exclusivity ?? "none");

  const [state, formAction, isPending] = useActionState(
    updateVendorLegalAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  const form = (
    <form id="vendor-legal-form" action={formAction} className="grid gap-[18px]">
      <input type="hidden" name="influencer_id" value={vendor.id} />
      <input type="hidden" name="contract_status" value={contractStatus} />
      <input type="hidden" name="exclusivity" value={exclusivity} />

      <VendorFormSection
        icon={ScaleIcon}
        title="Legal & contract"
        description="Contract status, expiry, and exclusivity terms."
      >
        <VendorFormGrid className="lg:grid-cols-3">
          <VendorFormField label="Contract status">
            <Select
              value={contractStatus}
              onValueChange={(v) => setContractStatus(v as ContractStatus)}
              disabled={isPending}
            >
              <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </VendorFormField>
          <VendorFormField label="Contract expiry" htmlFor="contract_expiry">
            <Input
              id="contract_expiry"
              name="contract_expiry"
              type="date"
              className={VENDOR_FORM_INPUT_CLASS}
              defaultValue={vendor.contract_expiry ?? ""}
              disabled={isPending}
            />
          </VendorFormField>
          <VendorFormField label="Exclusivity">
            <Select
              value={exclusivity}
              onValueChange={(v) => setExclusivity(v as ExclusivityType)}
              disabled={isPending}
            >
              <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXCLUSIVITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </VendorFormField>
        </VendorFormGrid>
      </VendorFormSection>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <>
      <VendorFormKeyboardShortcuts
        formId="vendor-legal-form"
        enabled={shortcutsEnabled}
        disabled={isPending}
      />
      <VendorProfileTabShell
        title="Legal & contract"
        description="Contract status, expiry, and exclusivity for this creator."
        onCancel={onCancel}
        saveFormId="vendor-legal-form"
        saveLabel="Save legal"
        saveDisabled={isPending}
        isSaving={isPending}
      >
        {form}
      </VendorProfileTabShell>
    </>
  );
}

```

#### `features/vendors/components/tabs/vendor-overview-tab.tsx`

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { UserIcon } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/forms/field-error";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  updateVendorOverviewAction,
  type FormActionState,
} from "@/features/vendors/actions";
import {
  COUNTRY_OPTIONS,
  GENDER_OPTIONS,
  NATIONALITY_OPTIONS,
  VENDOR_STATUS_OPTIONS,
} from "@/features/vendors/constants";
import {
  VendorFormField,
  VendorFormGrid,
  VendorFormKeyboardShortcuts,
  VendorFormSection,
  VendorProfileTabShell,
  VENDOR_FORM_INPUT_CLASS,
  VENDOR_FORM_SELECT_TRIGGER_CLASS,
  VENDOR_FORM_TEXTAREA_CLASS,
} from "@/features/vendors/components/vendor-form-ui";
import type { InfluencerStatus, VendorDetail } from "@/types/database";
import { cn } from "@/lib/utils";

export function VendorOverviewTab({
  vendor,
  portalAccessPanel,
  onCancel,
  shortcutsEnabled = true,
}: {
  vendor: VendorDetail;
  portalAccessPanel?: React.ReactNode;
  onCancel?: () => void;
  shortcutsEnabled?: boolean;
}) {
  const [status, setStatus] = useState(vendor.status);
  const [country, setCountry] = useState(vendor.country_code ?? "");
  const [nationality, setNationality] = useState(vendor.nationality ?? "");
  const [gender, setGender] = useState(vendor.gender ?? "");

  const [state, formAction, isPending] = useActionState(
    updateVendorOverviewAction,
    { ok: false } satisfies FormActionState
  );

  useEffect(() => {
    if (!state.message) {
      return;
    }
    if (state.ok) {
      toast.success(state.message);
      return;
    }
    toast.error(state.message);
  }, [state]);

  return (
    <>
      <VendorFormKeyboardShortcuts
        formId="vendor-overview-form"
        enabled={shortcutsEnabled}
        disabled={isPending}
      />
      <VendorProfileTabShell
        title="Creator overview"
        description="Profile details, contact information, and operational status."
        onCancel={onCancel}
        saveFormId="vendor-overview-form"
        saveLabel="Save overview"
        saveDisabled={isPending}
        isSaving={isPending}
      >
        {portalAccessPanel ? <div className="mb-[18px]">{portalAccessPanel}</div> : null}
        <form id="vendor-overview-form" action={formAction} className="grid gap-[18px]">
          <input type="hidden" name="influencer_id" value={vendor.id} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="country_code" value={country} />
          <input type="hidden" name="nationality" value={nationality} />
          <input type="hidden" name="gender" value={gender} />

          <VendorFormSection
            icon={UserIcon}
            title="Profile"
            description="Core creator identity and contact details."
          >
            <VendorFormGrid>
              <VendorFormField label="Creator name" htmlFor="display_name">
                <Input
                  id="display_name"
                  name="display_name"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.display_name}
                  required
                  disabled={isPending}
                />
                <FieldError messages={state.fieldErrors?.display_name} />
              </VendorFormField>
              <VendorFormField label="Management agency" htmlFor="legal_name">
                <Input
                  id="legal_name"
                  name="legal_name"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.legal_name ?? ""}
                  disabled={isPending}
                />
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormGrid className="lg:grid-cols-3">
              <VendorFormField label="Status">
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as InfluencerStatus)}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </VendorFormField>
              <VendorFormField label="Gender">
                <Select
                  value={gender}
                  onValueChange={setGender}
                  disabled={isPending}
                >
                  <SelectTrigger className={cn(VENDOR_FORM_SELECT_TRIGGER_CLASS, "w-full")}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </VendorFormField>
              <VendorFormField label="City" htmlFor="city">
                <Input
                  id="city"
                  name="city"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.city ?? ""}
                  disabled={isPending}
                />
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormGrid>
              <VendorFormField label="Country">
                <SearchableSelect
                  value={country}
                  onValueChange={setCountry}
                  options={COUNTRY_OPTIONS}
                  disabled={isPending}
                />
              </VendorFormField>
              <VendorFormField label="Nationality">
                <SearchableSelect
                  value={nationality}
                  onValueChange={setNationality}
                  options={NATIONALITY_OPTIONS}
                  disabled={isPending}
                />
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormGrid>
              <VendorFormField label="Email" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.email ?? ""}
                  disabled={isPending}
                />
              </VendorFormField>
              <VendorFormField label="Phone" htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.phone ?? ""}
                  disabled={isPending}
                />
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormField label="Portfolio / URL" htmlFor="influencer_url">
              <Input
                id="influencer_url"
                name="influencer_url"
                type="url"
                className={VENDOR_FORM_INPUT_CLASS}
                defaultValue={vendor.influencer_url ?? ""}
                disabled={isPending}
              />
              <FieldError messages={state.fieldErrors?.influencer_url} />
            </VendorFormField>

            <VendorFormField label="Agency contact name" htmlFor="management_agency">
              <Input
                id="management_agency"
                name="management_agency"
                className={VENDOR_FORM_INPUT_CLASS}
                defaultValue={vendor.management_agency ?? ""}
                disabled={isPending}
              />
            </VendorFormField>

            <VendorFormGrid>
              <VendorFormField label="Categories / niche" htmlFor="categories">
                <Input
                  id="categories"
                  name="categories"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.categories?.join(", ") ?? ""}
                  placeholder="beauty, lifestyle"
                  disabled={isPending}
                />
                <p className="text-[11.5px] text-muted-foreground">Comma-separated</p>
              </VendorFormField>
              <VendorFormField label="Languages" htmlFor="languages">
                <Input
                  id="languages"
                  name="languages"
                  className={VENDOR_FORM_INPUT_CLASS}
                  defaultValue={vendor.languages?.join(", ") ?? ""}
                  placeholder="en, ar"
                  disabled={isPending}
                />
                <p className="text-[11.5px] text-muted-foreground">
                  Comma-separated language codes (e.g. en, ar)
                </p>
              </VendorFormField>
            </VendorFormGrid>

            <VendorFormField label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                className={VENDOR_FORM_TEXTAREA_CLASS}
                defaultValue={vendor.notes ?? ""}
                disabled={isPending}
              />
            </VendorFormField>
          </VendorFormSection>
        </form>
      </VendorProfileTabShell>
    </>
  );
}

```

#### `features/vendors/components/tabs/vendor-platforms-tab.tsx`

```tsx
"use client";

import { PlatformAccountsEditor } from "@/features/vendors/components/platform-accounts-editor";
import { VendorProfileTabShell } from "@/features/vendors/components/vendor-form-ui";
import type { VendorDetail } from "@/types/database";

export function VendorPlatformsTab({
  vendor,
  onCancel,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
}) {
  return (
    <VendorProfileTabShell
      title="Platforms"
      description="Social accounts, metrics, and enrichment for this creator."
      onCancel={onCancel}
    >
      <PlatformAccountsEditor vendor={vendor} />
    </VendorProfileTabShell>
  );
}

```

#### `features/vendors/components/vendor-dependency-dialog.tsx`

```tsx
"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { AlertTriangleIcon, ArchiveIcon, ArrowRightLeftIcon } from "lucide-react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
  getOperationalTableColumnMetas,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VENDOR_ASSIGNMENT_DEPS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import { Button } from "@/components/ui/button";
import { DocumentNumber } from "@/components/ui/document-number";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getVendorDependenciesAction } from "@/features/vendors/actions";
import { formatMoney } from "@/features/vendors/utils";
import type { VendorLinkedAssignment } from "@/lib/operations/vendor-dependencies";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

const VENDOR_ASSIGNMENT_DEPS_COLUMNS: OperationalConfigurableColumnDef<VendorLinkedAssignment>[] =
  [
    {
      id: "campaign",
      label: "Campaign",
      renderCell: (assignment) => (
        <div>
          <span className="font-medium">{assignment.campaign_name}</span>
          <p className="text-xs text-muted-foreground">
            <DocumentNumber value={assignment.campaign_document_number} />
          </p>
        </div>
      ),
    },
    {
      id: "line",
      label: "Line",
      cellClassName: "text-xs",
      monoCell: true,
      renderCell: (assignment) => <DocumentNumber value={assignment.line_document_number} />,
    },
    {
      id: "billing",
      label: "Billing",
      cellClassName: "capitalize",
      renderCell: (assignment) => assignment.billing_status?.replace(/_/g, " ") ?? "—",
    },
    {
      id: "fee",
      label: "Fee",
      headerClassName: "text-right",
      amountCell: true,
      renderCell: (assignment) => formatMoney(assignment.agreed_fee, assignment.currency),
    },
  ];

const VENDOR_ASSIGNMENT_DEPS_COLUMN_METAS = getOperationalTableColumnMetas(
  VENDOR_ASSIGNMENT_DEPS_COLUMNS
);

type VendorDependencyDialogProps = {
  vendorId: string;
  vendorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: () => void;
};

export function VendorDependencyDialog({
  vendorId,
  vendorName,
  open,
  onOpenChange,
  onArchive,
}: VendorDependencyDialogProps) {
  const [state, formAction, pending] = useActionState(getVendorDependenciesAction, {
    ok: false,
  });

  useEffect(() => {
    if (!open) return;
    const fd = new FormData();
    fd.set("vendor_id", vendorId);
    formAction(fd);
  }, [open, vendorId, formAction]);

  const deps = state.dependencies;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-amber-500" />
            Operational dependencies
          </DialogTitle>
          <DialogDescription>
            {vendorName} — assignments, billing, and audit linkage before archive or delete.
          </DialogDescription>
        </DialogHeader>

        {pending && !deps ? (
          <p className="text-sm text-muted-foreground">Checking dependencies…</p>
        ) : deps ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Assignments", deps.assignments],
                ["Campaigns", deps.campaigns],
                ["Deliverables", deps.deliverables],
                ["Invoices", deps.invoices],
                ["Billing lines", deps.billing_lines],
                ["Payments", deps.payments],
                ["Collections", deps.collections],
                ["Approvals", deps.approvals],
                ["Audit records", deps.audit_records],
              ].map(([label, count]) => (
                <div key={label as string} className="rounded-2xl border p-3">
                  <p className="text-xs text-muted-foreground">{label as string}</p>
                  <p className="text-xl font-semibold">{count as number}</p>
                </div>
              ))}
            </div>

            {deps.linked_assignments.length > 0 ? (
              <OperationalTableSuiteProvider
                tableId={OPERATIONAL_TABLE_IDS.dialogVendorAssignmentDeps}
                columns={VENDOR_ASSIGNMENT_DEPS_COLUMNS}
                rows={deps.linked_assignments}
                filterAccessors={VENDOR_ASSIGNMENT_DEPS_FILTER_ACCESSORS}
              >
                <div className="flex justify-end pb-2">
                  <OperationalTableControlsSlot contextLabel="Linked assignments" />
                </div>
                <OperationalConfigurableTable
                  columns={VENDOR_ASSIGNMENT_DEPS_COLUMNS}
                  rows={deps.linked_assignments}
                  rowKey={(assignment) => assignment.id}
                />
              </OperationalTableSuiteProvider>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {deps.can_permanently_delete
                ? "No operational linkage — permanent delete may be allowed."
                : "Hard delete blocked — reassign or archive instead."}
            </p>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/operations/move?vendor=${vendorId}`}>
              <ArrowRightLeftIcon className="size-4" />
              Reassign via Move
            </Link>
          </Button>
          {onArchive && deps?.can_archive ? (
            <Button variant="secondary" onClick={onArchive}>
              <ArchiveIcon className="size-4" />
              Archive vendor
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

#### `features/vendors/components/vendor-form-ui.tsx`

```tsx
"use client";

import type { ReactNode } from "react";

import {
  ClientFormLayout,
  ClientFormPageHeader,
  ClientFormSaveBar,
  ClientFormTopbar,
  ClientFormUnsavedStatus,
  CLIENT_FORM_MAX_WIDTH,
  CLIENT_FORM_PRIMARY_BUTTON_CLASS,
  CLIENT_FORM_SCROLL_PADDING_CLASS,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { PlatformV6PageSectionHeader } from "@/components/platform/platform-v6-layout";
import { cn } from "@/lib/utils";

export {
  ClientFormField as VendorFormField,
  ClientFormGrid as VendorFormGrid,
  ClientFormSection as VendorFormSection,
  ClientFormKeyboardShortcuts as VendorFormKeyboardShortcuts,
  CLIENT_FORM_INPUT_CLASS as VENDOR_FORM_INPUT_CLASS,
  CLIENT_FORM_SELECT_TRIGGER_CLASS as VENDOR_FORM_SELECT_TRIGGER_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS as VENDOR_FORM_TEXTAREA_CLASS,
  CLIENT_FORM_FIELD_LABEL_CLASS as VENDOR_FORM_FIELD_LABEL_CLASS,
} from "@/features/clients/components/client-form-ui";

export const VENDOR_PROFILE_BREADCRUMBS = [
  { label: "Vendors", href: "/vendors" },
  { label: "Creator workspace" },
] as const;

/** Form shell for vendor profile tabs — matches client profile tab layout. */
export function VendorProfileTabShell({
  title,
  description,
  children,
  onCancel,
  saveFormId,
  saveLabel = "Save changes",
  saveDisabled,
  isSaving,
  isDirty,
  onDiscard,
  discardDisabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onCancel?: () => void;
  saveFormId?: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
  isDirty?: boolean;
  onDiscard?: () => void;
  discardDisabled?: boolean;
}) {
  const platformV6 = useClientProfilePlatformV6();

  if (platformV6) {
    return (
      <div className="platform-v6-epanel-inner">
        <PlatformV6PageSectionHeader title={title} description={description} />
        {children}
      </div>
    );
  }

  return (
    <ClientFormLayout
      topbar={
        <ClientFormTopbar
          breadcrumbs={[...VENDOR_PROFILE_BREADCRUMBS]}
          onCancel={onCancel}
          saveFormId={saveFormId}
          saveLabel={saveLabel}
          saveDisabled={saveDisabled}
          isSaving={isSaving}
        />
      }
      footer={
        isDirty ? (
          <ClientFormSaveBar
            status={<ClientFormUnsavedStatus />}
            onDiscard={onDiscard}
            discardDisabled={discardDisabled}
          >
            {saveFormId ? (
              <button
                type="submit"
                form={saveFormId}
                className={CLIENT_FORM_PRIMARY_BUTTON_CLASS}
                disabled={saveDisabled}
              >
                {isSaving ? "Saving…" : saveLabel}
              </button>
            ) : null}
          </ClientFormSaveBar>
        ) : null
      }
    >
      <div
        className={cn(
          "mx-auto w-full",
          CLIENT_FORM_MAX_WIDTH,
          CLIENT_FORM_SCROLL_PADDING_CLASS
        )}
      >
        <ClientFormPageHeader title={title} description={description} />
        {children}
      </div>
    </ClientFormLayout>
  );
}

```

#### `features/vendors/components/vendor-kpi-strip.tsx`

```tsx
"use client";

import {
  FileTextIcon,
  LayersIcon,
  MegaphoneIcon,
  PercentIcon,
  Share2Icon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { PlatformV6KpiStrip } from "@/components/platform/platform-v6-kpi-strip";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";
import { cn } from "@/lib/utils";

type VendorKpiStripProps = {
  workspace: VendorWorkspace;
  className?: string;
};

export function VendorKpiStrip({ workspace, className }: VendorKpiStripProps) {
  const { counts, financials } = workspace;
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";

  return (
    <PlatformV6KpiStrip
      className={cn("platform-v6-kpi-strip--executive mb-0", className)}
      items={[
        {
          id: "assignments",
          label: "Assignments",
          value: String(counts.assignments),
          icon: UsersIcon,
          iconStroke: "#2563eb",
          iconBg: "#eff6ff",
        },
        {
          id: "campaigns",
          label: "Campaigns",
          value: String(counts.campaigns),
          icon: MegaphoneIcon,
          iconStroke: "#10b981",
          iconBg: "#ecfdf5",
        },
        {
          id: "deliverables",
          label: "Deliverables",
          value: String(counts.deliverables),
          icon: LayersIcon,
          iconStroke: "#a855f7",
          iconBg: "#faf5ff",
        },
        {
          id: "platforms",
          label: "Platforms",
          value: String(counts.platforms),
          icon: Share2Icon,
          iconStroke: "#10b981",
          iconBg: "#ecfdf5",
        },
        {
          id: "revenue",
          label: "Revenue",
          value: formatMoney(financials.total_revenue, currency),
          icon: TrendingUpIcon,
          iconStroke: "#2563eb",
          iconBg: "#eff6ff",
          valueClassName: "platform-v6-c-blue !text-[12px]",
        },
        {
          id: "gp",
          label: "GP",
          value: formatMoney(financials.total_gp, currency),
          icon: WalletIcon,
          iconStroke: "#10b981",
          iconBg: "#ecfdf5",
          valueClassName: "platform-v6-c-green !text-[12px]",
        },
        {
          id: "margin",
          label: "Margin",
          value: formatPercent(financials.margin_percent),
          icon: PercentIcon,
          iconStroke: "#f59e0b",
          iconBg: "#fffbeb",
        },
        {
          id: "payout",
          label: "Pending payout",
          value: formatMoney(financials.pending_payout, currency),
          icon: FileTextIcon,
          iconStroke: "#ec4899",
          iconBg: "#fdf2f8",
          valueClassName: "!text-[12px]",
        },
      ]}
    />
  );
}

```

#### `features/vendors/components/vendor-portal-access-card.tsx`

```tsx
import { VendorPortalAccessForm } from "@/features/vendors/components/vendor-portal-access-form";
import { getLinkableCreatorProfiles } from "@/features/vendors/queries";

type Props = {
  influencerId: string;
  profileId: string | null;
};

export async function VendorPortalAccessCard({ influencerId, profileId }: Props) {
  const profiles = await getLinkableCreatorProfiles(influencerId);

  return (
    <VendorPortalAccessForm
      influencerId={influencerId}
      currentProfileId={profileId}
      profiles={profiles}
    />
  );
}

```

#### `features/vendors/components/vendor-portal-access-form.tsx`

```tsx
"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CampaignFlatSection } from "@/features/campaigns/components/campaign-flat-section";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setInfluencerProfileLinkAction,
  type FormActionState,
} from "@/features/vendors/actions";

const INITIAL: FormActionState = { ok: false };

type ProfileOption = { id: string; full_name: string | null; email: string };

type Props = {
  influencerId: string;
  currentProfileId: string | null;
  profiles: ProfileOption[];
};

export function VendorPortalAccessForm({
  influencerId,
  currentProfileId,
  profiles,
}: Props) {
  const [profileId, setProfileId] = useState(currentProfileId ?? "");
  const [state, action, pending] = useActionState(setInfluencerProfileLinkAction, INITIAL);

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <CampaignFlatSection
      title="Creator portal login"
      description="Links this vendor to a user with the influencer role so they can sign in to the creator portal."
    >
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="influencer_id" value={influencerId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <div className="grid gap-2 min-w-[240px]">
            <Label>Linked user</Label>
            <Select
              value={profileId || "__none__"}
              onValueChange={(v) => setProfileId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select portal user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not linked</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name ?? profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save link"}
          </Button>
        </form>
    </CampaignFlatSection>
  );
}

```

#### `features/vendors/components/vendor-profile.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
  type OperationalWorkspaceTabDef,
} from "@/components/workspace/operational-workspace-ui";
import { useWorkspaceTabOrder } from "@/hooks/use-workspace-tab-order";
import {
  VENDOR_PROFILE_TAB_ORDER,
  VENDOR_PROFILE_TAB_STORAGE_KEY,
  isVendorProfileTabId,
  type VendorProfileTabId,
} from "@/lib/workspace/platform-workspace-tabs";
import type { VendorDetail } from "@/types/database";
import { cn } from "@/lib/utils";

import { VendorCampaignsTab } from "./tabs/vendor-campaigns-tab";
import { VendorDocumentsTab } from "./tabs/vendor-documents-tab";
import { VendorFinanceTab } from "./tabs/vendor-finance-tab";
import { VendorLegalTab } from "./tabs/vendor-legal-tab";
import { VendorOverviewTab } from "./tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "./tabs/vendor-platforms-tab";

type VendorProfileProps = {
  vendor: VendorDetail;
};

export function VendorProfile({ vendor }: VendorProfileProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<VendorProfileTabId>("overview");
  const { tabOrder } = useWorkspaceTabOrder({
    storageKey: VENDOR_PROFILE_TAB_STORAGE_KEY,
    defaultOrder: VENDOR_PROFILE_TAB_ORDER,
    isValidId: isVendorProfileTabId,
  });

  const handleCancel = () => router.push("/vendors");

  const tabsById = useMemo(
    (): Record<VendorProfileTabId, OperationalWorkspaceTabDef> => ({
      overview: { value: "overview", label: "Overview" },
      legal: { value: "legal", label: "Legal" },
      finance: { value: "finance", label: "Finance" },
      documents: { value: "documents", label: "Documents" },
      platforms: { value: "platforms", label: "Platforms" },
      campaigns: {
        value: "campaigns",
        label: "Campaign history",
        count: vendor.campaign_assignments.length,
      },
    }),
    [vendor.campaign_assignments.length]
  );

  const tabPanelClassName =
    "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isVendorProfileTabId(value)) {
            setActiveTab(value);
          }
        }}
        className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
      >
        <nav
          aria-label="Creator workspace sections"
          className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-[26px] py-2.5"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Also view
          </span>
          {tabOrder.map((tabId) => {
            const tab = tabsById[tabId];
            const isActive = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                onClick={() => setActiveTab(tabId)}
                className={cn(
                  "text-[13px] font-medium transition-colors",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-muted-foreground hover:text-primary"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
                {tab.count != null ? ` (${tab.count})` : ""}
              </button>
            );
          })}
        </nav>

        <OperationalWorkspaceTabContent value="overview" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorOverviewTab
              vendor={vendor}
              onCancel={handleCancel}
              shortcutsEnabled={activeTab === "overview"}
            />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="legal" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorLegalTab
              vendor={vendor}
              onCancel={handleCancel}
              shortcutsEnabled={activeTab === "legal"}
            />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="finance" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorFinanceTab vendor={vendor} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="documents" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorDocumentsTab vendor={vendor} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="platforms" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorPlatformsTab vendor={vendor} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
        <OperationalWorkspaceTabContent value="campaigns" className={tabPanelClassName}>
          <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <VendorCampaignsTab vendor={vendor} onCancel={handleCancel} />
          </OperationalWorkspaceTabPanel>
        </OperationalWorkspaceTabContent>
      </Tabs>
    </div>
  );
}

```

#### `features/vendors/components/vendor-status-badge.tsx`

```tsx
import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { cn } from "@/lib/utils";
import type { InfluencerStatus } from "@/types/database";

import { VENDOR_STATUS_OPTIONS } from "../constants";

type VendorStatusBadgeProps = {
  status: InfluencerStatus;
  className?: string;
};

export function VendorStatusBadge({ status, className }: VendorStatusBadgeProps) {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("vendor", status)}
      className={cn("font-medium", className)}
    />
  );
}

```

#### `features/vendors/components/vendor-workspace-tabs.tsx`

```tsx
"use client";

import type { ReactNode } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export type VendorWorkspaceTabDef = {
  value: string;
  label: string;
  count?: number;
};

export function VendorWorkspaceTabTrigger({ value, label, count }: VendorWorkspaceTabDef) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      data-slot="vendor-workspace-tab"
      className={cn(
        "group/vendor-tab relative inline-flex shrink-0 cursor-pointer items-center gap-2",
        "rounded-t-lg border border-transparent px-3 py-2 text-[13px] font-medium transition-all",
        "bg-muted/50 text-muted-foreground",
        "hover:bg-muted/80 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[state=active]:z-[2] data-[state=active]:-mb-px data-[state=active]:border-border/80",
        "data-[state=active]:border-b-background data-[state=active]:bg-card",
        "data-[state=active]:px-4 data-[state=active]:font-semibold data-[state=active]:text-foreground",
        "data-[state=active]:before:absolute data-[state=active]:before:inset-x-2 data-[state=active]:before:top-0",
        "data-[state=active]:before:h-0.5 data-[state=active]:before:rounded-full data-[state=active]:before:bg-[var(--brand-product)]"
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      {count != null ? (
        <span
          className={cn(
            "inline-flex min-w-[1.25rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            "bg-background/80 text-muted-foreground ring-1 ring-border/50",
            "group-data-[state=active]/vendor-tab:bg-muted group-data-[state=active]/vendor-tab:text-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export function VendorWorkspaceTabsBar({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-t-xl bg-muted/40 px-2 pt-2" data-sticky="vendor-workspace-tabs">
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-foreground">
        Creator workspace
      </p>
      <TabsPrimitive.List
        data-slot="vendor-workspace-tabs"
        className={cn(
          "flex min-w-0 items-end gap-2 overflow-x-auto pb-0.5",
          "scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {children}
      </TabsPrimitive.List>
    </div>
  );
}

export function VendorWorkspaceTabPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 bg-background", className)}>{children}</div>;
}

```

#### `features/vendors/components/vendor-workspace.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageBackButton } from "@/components/navigation/page-back-button";
import {
  CreatorIdentityCell,
  creatorProfileSourceFromAccounts,
} from "@/components/creator/creator-profile-link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import {
  PlatformV6EntityBreadcrumb,
  platformV6BadgeClass,
} from "@/components/platform/platform-v6-layout";
import { ClientProfilePlatformProvider } from "@/features/clients/components/client-form-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs } from "@/components/ui/tabs";
import {
  OperationalWorkspaceTabContent,
  OperationalWorkspaceTabPanel,
} from "@/components/workspace/operational-workspace-ui";
import { VENDOR_STATUS_OPTIONS } from "@/features/vendors/constants";
import { VendorDependencyDialog } from "@/features/vendors/components/vendor-dependency-dialog";
import { VendorKpiStrip } from "@/features/vendors/components/vendor-kpi-strip";
import { VendorActivityTab } from "@/features/vendors/components/tabs/vendor-activity-tab";
import { VendorAssignmentsTab } from "@/features/vendors/components/tabs/vendor-assignments-tab";
import { VendorBillingTab } from "@/features/vendors/components/tabs/vendor-billing-tab";
import { VendorContractsTab } from "@/features/vendors/components/tabs/vendor-contracts-tab";
import { VendorDocumentsTab } from "@/features/vendors/components/tabs/vendor-documents-tab";
import { VendorOverviewTab } from "@/features/vendors/components/tabs/vendor-overview-tab";
import { VendorPlatformsTab } from "@/features/vendors/components/tabs/vendor-platforms-tab";
import { DocumentNumber } from "@/components/ui/document-number";
import type { VendorWorkspace } from "@/features/vendors/types";
import type { InfluencerStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type VendorWorkspaceViewProps = {
  workspace: VendorWorkspace;
  defaultTab?: string;
  portalAccessPanel?: React.ReactNode;
  currencyOptions?: { value: string; label: string }[];
};

const VENDOR_WORKSPACE_TAB_IDS = [
  "overview",
  "platforms",
  "assignments",
  "billing",
  "documents",
  "contracts",
  "activity",
] as const;

type VendorWorkspaceTabId = (typeof VENDOR_WORKSPACE_TAB_IDS)[number];

function isVendorWorkspaceTabId(value: string): value is VendorWorkspaceTabId {
  return (VENDOR_WORKSPACE_TAB_IDS as readonly string[]).includes(value);
}

const TAB_SAVE_LABELS: Record<VendorWorkspaceTabId, string> = {
  overview: "Save overview",
  platforms: "Save platforms",
  assignments: "Save",
  billing: "Save billing",
  documents: "Save",
  contracts: "Save legal",
  activity: "Save",
};

const TAB_FORM_IDS: Partial<Record<VendorWorkspaceTabId, string>> = {
  overview: "vendor-overview-form",
  platforms: "platform-accounts-form",
  billing: "vendor-bank-details-form",
  contracts: "vendor-legal-form",
};

function resolveEntityStatusBadge(status: InfluencerStatus): {
  label: string;
  className: string;
} {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;

  if (status === "active") {
    return { label, className: platformV6BadgeClass("outline-green") };
  }
  if (status === "blacklisted") {
    return { label, className: platformV6BadgeClass("red") };
  }
  if (status === "prospect") {
    return { label, className: platformV6BadgeClass("blue") };
  }
  return { label, className: platformV6BadgeClass("gray") };
}

const tabPanelClassName =
  "mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:outline-none";

export function VendorWorkspaceView({
  workspace,
  defaultTab = "overview",
  portalAccessPanel,
  currencyOptions = [],
}: VendorWorkspaceViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [depOpen, setDepOpen] = useState(false);
  const initialTab = isVendorWorkspaceTabId(defaultTab) ? defaultTab : "overview";
  const [activeTab, setActiveTab] = useState<VendorWorkspaceTabId>(initialTab);

  useEffect(() => {
    setActiveTab(isVendorWorkspaceTabId(defaultTab) ? defaultTab : "overview");
  }, [defaultTab]);

  const handleCancel = useCallback(() => {
    router.push("/vendors");
  }, [router]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isVendorWorkspaceTabId(value)) {
        return;
      }
      setActiveTab(value);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const tabCounts = useMemo(
    () => ({
      platforms: workspace.counts.platforms,
      assignments: workspace.counts.assignments,
      documents: workspace.documents.length,
      activity: workspace.activity.length,
    }),
    [
      workspace.counts.platforms,
      workspace.counts.assignments,
      workspace.documents.length,
      workspace.activity.length,
    ]
  );

  const tabs = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview" },
        { id: "platforms" as const, label: "Platforms", count: tabCounts.platforms },
        {
          id: "assignments" as const,
          label: "Assignments",
          count: tabCounts.assignments,
        },
        { id: "billing" as const, label: "Billing & Payments" },
        { id: "documents" as const, label: "Documents", count: tabCounts.documents },
        { id: "contracts" as const, label: "Contracts" },
        {
          id: "activity" as const,
          label: "Activity & Audit",
          count: tabCounts.activity,
        },
      ] satisfies Array<{
        id: VendorWorkspaceTabId;
        label: string;
        count?: number;
      }>,
    [tabCounts]
  );

  const entityBadge = resolveEntityStatusBadge(workspace.status);
  const saveFormId = TAB_FORM_IDS[activeTab];

  return (
    <ClientProfilePlatformProvider platformV6>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="mt-0 flex min-h-0 flex-1 flex-col gap-0 overflow-hidden"
        >
          <div className="platform-v6-entity-nav-bar shrink-0">
            <div className="flex items-start justify-between gap-3 px-5 pb-2.5 pt-3.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <PageBackButton fallbackHref="/vendors" label="Back to vendors" />
                <CreatorIdentityCell
                  source={creatorProfileSourceFromAccounts(
                    workspace.display_name,
                    workspace.platform_accounts
                  )}
                  size="md"
                  showHandle={false}
                  stopPropagation
                />
                <span className={entityBadge.className}>{entityBadge.label}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="platform-v6-btn platform-v6-btn-sm shrink-0"
                  >
                    <MoreHorizontalIcon className="size-3.5" aria-hidden />
                    Actions
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDepOpen(true)}>
                    View dependencies
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/operations/move?vendor=${workspace.id}`}>
                      Reassign via Move
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="px-5 pb-2.5 text-[11px] text-muted-foreground">
              <DocumentNumber value={workspace.document_number} />
              {workspace.country_code ? ` · ${workspace.country_code}` : null}
            </p>

            <div className="border-b border-border px-5 pb-2.5">
              <VendorKpiStrip workspace={workspace} />
            </div>

            <div className="flex items-center px-5">
              <span className="platform-v6-also-view">Also view</span>
              <div className="platform-v6-entity-tabs-row flex-1" role="tablist">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleTabChange(tab.id)}
                      className={cn("platform-v6-etab", isActive && "active")}
                    >
                      {tab.label}
                      {tab.count != null ? ` (${tab.count})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <PlatformV6EntityBreadcrumb
            crumbs={[
              { label: "Vendors", href: "/vendors" },
              { label: "Creator workspace" },
            ]}
            actions={
              <>
                <button
                  type="button"
                  className="platform-v6-btn platform-v6-btn-sm"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                {saveFormId ? (
                  <button
                    type="submit"
                    form={saveFormId}
                    className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm"
                  >
                    {TAB_SAVE_LABELS[activeTab]}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="platform-v6-btn platform-v6-btn-primary platform-v6-btn-sm"
                  >
                    {TAB_SAVE_LABELS[activeTab]}
                  </button>
                )}
              </>
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <OperationalWorkspaceTabContent value="overview" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorOverviewTab
                  vendor={workspace}
                  portalAccessPanel={portalAccessPanel}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "overview"}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="platforms" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorPlatformsTab vendor={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="assignments" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorAssignmentsTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="billing" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {activeTab === "billing" ? (
                  <VendorBillingTab
                    workspace={workspace}
                    currencyOptions={currencyOptions}
                    onCancel={handleCancel}
                  />
                ) : null}
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="documents" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorDocumentsTab vendor={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="contracts" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorContractsTab
                  vendor={workspace}
                  onCancel={handleCancel}
                  shortcutsEnabled={activeTab === "contracts"}
                />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
            <OperationalWorkspaceTabContent value="activity" className={tabPanelClassName}>
              <OperationalWorkspaceTabPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <VendorActivityTab workspace={workspace} onCancel={handleCancel} />
              </OperationalWorkspaceTabPanel>
            </OperationalWorkspaceTabContent>
          </div>
        </Tabs>

        <VendorDependencyDialog
          vendorId={workspace.id}
          vendorName={workspace.display_name}
          open={depOpen}
          onOpenChange={setDepOpen}
          onArchive={
            workspace.counts.assignments === 0 ? () => setDepOpen(false) : undefined
          }
        />
      </div>
    </ClientProfilePlatformProvider>
  );
}

```

#### `features/vendors/constants.ts`

```ts
import type { InfluencerStatus } from "@/types/database";
import {
  COUNTRY_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
  GENDER_OPTIONS,
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  NATIONALITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  SOCIAL_PLATFORM_OPTIONS,
  labelForOption,
} from "@/lib/master-data/constants";

export const VENDORS_PAGE_SIZE = 10;

export const VENDOR_STATUS_OPTIONS: {
  value: InfluencerStatus;
  label: string;
}[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
  { value: "archived", label: "Archived" },
];

export const PLATFORM_OPTIONS = SOCIAL_PLATFORM_OPTIONS;

export {
  COUNTRY_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  EXCLUSIVITY_OPTIONS,
  GENDER_OPTIONS,
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  NATIONALITY_OPTIONS,
  PAYMENT_TERMS_OPTIONS,
  labelForOption,
};

```

---

## Data reality summary (BATCH 1)

| Route | Mock / fixture data? | Notes |
|-------|----------------------|-------|
| `/` | None | Fully live from Supabase (no mock dataset) |
| `/dashboard` | None | Fully live from Supabase (no mock dataset) |
| `/campaigns` | No demo mocks | Empty fallback only (`EMPTY_CAMPAIGN_FORM_OPTIONS`); list/KPIs are live Supabase |
| `/clients` | None | Fully live from Supabase (no mock dataset) |
| `/vendors` | None | Fully live from Supabase (no mock dataset) |
| `/studio` | No demo mocks | Live Supabase picker data; `seed-adapters` normalize live campaign objects (not demo fixtures) |
| `/clients/[id]` | None | Fully live from Supabase (no mock dataset) |
| `/vendors/[id]` | None | Fully live from Supabase (no mock dataset) |

---

## Package contents

- This markdown: `docs/redesign-handoff/BATCH_1_PLATFORM_V6.md`
- Zip mirror of sources: `docs/redesign-handoff/BATCH_1_PLATFORM_V6.zip`
