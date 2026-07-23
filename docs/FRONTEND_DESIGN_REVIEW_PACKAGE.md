# Thinkway — Frontend Design Review Package

> Generated for an external design reviewer. Self-contained chrome + tokens; full sources embedded for shared shells and key patterns.
>
> **Generated:** 2026-07-17  
> **Product:** Thinkway · Prefix: TW · Product accent: `#1D9E75`  
> **Companion folder (full large CSS):** [`docs/frontend-design-review-package/`](./frontend-design-review-package/)

## How to read this package

1. **Route inventory** — every `page.tsx` mapped to its URL and which shell wraps it.
2. **Shared layout/shell sources** — full file contents for wrappers used across 2+ pages.
3. **Design tokens / theme** — canonical token CSS + theme variables from `globals.css` (+ full CSS files in companion folder).
4. **Repeated UI patterns** — one representative file each (table chrome, status pill, button, Discovery chips) plus a path inventory of other shared pieces.

**Stack context:** Next.js App Router · Tailwind CSS v4 (CSS-first, no `tailwind.config.*`) · shadcn/ui · Supabase.

**Layout hierarchy (dashboard):**

```
app/layout.tsx (root fonts + AppProviders + globals.css)
  └─ app/(dashboard)/layout.tsx → DashboardProviders
       └─ page → DashboardShell / DiscoveryPageShell
            └─ CollapsibleAppSidebar + topbar + <main>
```

---

## 1. Route inventory

Total pages: **99**. Route groups `(dashboard)`, `(client-portal)`, `(creator-portal)` do not appear in the URL.

### DiscoveryPageShell → DashboardShell → CollapsibleAppSidebar

| Route | File | Notes |
|---|---|---|
| `/discovery/campaign-match` | `app/(dashboard)/discovery/campaign-match/page.tsx` | Uses Discovery sub-nav + lavender/workspace/flush variants |
| `/discovery/import` | `app/(dashboard)/discovery/import/page.tsx` | Uses Discovery sub-nav + lavender/workspace/flush variants |
| `/discovery/intelligence/library` | `app/(dashboard)/discovery/intelligence/library/page.tsx` | Uses Discovery sub-nav + lavender/workspace/flush variants |
| `/discovery/quotations` | `app/(dashboard)/discovery/quotations/page.tsx` | Uses Discovery sub-nav + lavender/workspace/flush variants |
| `/discovery/quotations/[id]` | `app/(dashboard)/discovery/quotations/[id]/page.tsx` | Uses Discovery sub-nav + lavender/workspace/flush variants |
| `/discovery/search` | `app/(dashboard)/discovery/search/page.tsx` | Uses Discovery sub-nav + lavender/workspace/flush variants |
| `/discovery/shortlists` | `app/(dashboard)/discovery/shortlists/page.tsx` | Uses Discovery sub-nav + lavender/workspace/flush variants |
| `/discovery/shortlists/[id]` | `app/(dashboard)/discovery/shortlists/[id]/page.tsx` | Uses Discovery sub-nav + lavender/workspace/flush variants |

### DashboardShell + PlatformV6Page

| Route | File | Notes |
|---|---|---|
| `/campaigns` | `app/(dashboard)/campaigns/page.tsx` | platformV6 list chrome |
| `/clients` | `app/(dashboard)/clients/page.tsx` | platformV6 list chrome |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | platformV6 list chrome |
| `/vendors` | `app/(dashboard)/vendors/page.tsx` | platformV6 list chrome |

### DashboardShell → CollapsibleAppSidebar

| Route | File | Notes |
|---|---|---|
| `/` | `app/(dashboard)/page.tsx` | platformV6 prop |
| `/ai` | `app/(dashboard)/ai/page.tsx` | standard / workspace variants via shell props |
| `/ai/[conversationId]` | `app/(dashboard)/ai/[conversationId]/page.tsx` | standard / workspace variants via shell props |
| `/ai/[conversationId]/decisions` | `app/(dashboard)/ai/[conversationId]/decisions/page.tsx` | CampaignIntelligenceShell content |
| `/billing` | `app/(dashboard)/billing/page.tsx` | standard / workspace variants via shell props |
| `/billing/invoices/[id]` | `app/(dashboard)/billing/invoices/[id]/page.tsx` | standard / workspace variants via shell props |
| `/billing/invoices/[id]/preview` | `app/(dashboard)/billing/invoices/[id]/preview/page.tsx` | standard / workspace variants via shell props |
| `/brands` | `app/(dashboard)/brands/page.tsx` | standard / workspace variants via shell props |
| `/campaigns/[id]` | `app/(dashboard)/campaigns/[id]/page.tsx` | standard / workspace variants via shell props |
| `/campaigns/[id]/performance/preview` | `app/(dashboard)/campaigns/[id]/performance/preview/page.tsx` | standard / workspace variants via shell props |
| `/clients/[id]` | `app/(dashboard)/clients/[id]/page.tsx` | platformV6 prop |
| `/collections` | `app/(dashboard)/collections/page.tsx` | standard / workspace variants via shell props |
| `/discovery` | `app/(dashboard)/discovery/page.tsx` | standard / workspace variants via shell props |
| `/discovery/compare` | `app/(dashboard)/discovery/compare/page.tsx` | standard / workspace variants via shell props |
| `/discovery/quotations/[id]/preview` | `app/(dashboard)/discovery/quotations/[id]/preview/page.tsx` | standard / workspace variants via shell props |
| `/discovery/shortlists/[id]/preview` | `app/(dashboard)/discovery/shortlists/[id]/preview/page.tsx` | standard / workspace variants via shell props |
| `/finance/aging` | `app/(dashboard)/finance/aging/page.tsx` | standard / workspace variants via shell props |
| `/finance/client-credit-notes` | `app/(dashboard)/finance/client-credit-notes/page.tsx` | AdjustmentModuleShell content |
| `/finance/client-debit-notes` | `app/(dashboard)/finance/client-debit-notes/page.tsx` | AdjustmentModuleShell content |
| `/finance/credit-limit` | `app/(dashboard)/finance/credit-limit/page.tsx` | standard / workspace variants via shell props |
| `/finance/exchange-rates` | `app/(dashboard)/finance/exchange-rates/page.tsx` | standard / workspace variants via shell props |
| `/finance/invoices` | `app/(dashboard)/finance/invoices/page.tsx` | standard / workspace variants via shell props |
| `/finance/periods` | `app/(dashboard)/finance/periods/page.tsx` | standard / workspace variants via shell props |
| `/finance/po-tracker` | `app/(dashboard)/finance/po-tracker/page.tsx` | standard / workspace variants via shell props |
| `/finance/posting-center` | `app/(dashboard)/finance/posting-center/page.tsx` | standard / workspace variants via shell props |
| `/finance/vat` | `app/(dashboard)/finance/vat/page.tsx` | standard / workspace variants via shell props |
| `/finance/vendor-credit-notes` | `app/(dashboard)/finance/vendor-credit-notes/page.tsx` | AdjustmentModuleShell content |
| `/finance/vendor-debit-notes` | `app/(dashboard)/finance/vendor-debit-notes/page.tsx` | AdjustmentModuleShell content |
| `/groups` | `app/(dashboard)/groups/page.tsx` | standard / workspace variants via shell props |
| `/groups/[id]` | `app/(dashboard)/groups/[id]/page.tsx` | standard / workspace variants via shell props |
| `/intelligence` | `app/(dashboard)/intelligence/page.tsx` | standard / workspace variants via shell props |
| `/ios/client` | `app/(dashboard)/ios/client/page.tsx` | standard / workspace variants via shell props |
| `/ios/client/[id]/preview` | `app/(dashboard)/ios/client/[id]/preview/page.tsx` | standard / workspace variants via shell props |
| `/ios/vendor` | `app/(dashboard)/ios/vendor/page.tsx` | standard / workspace variants via shell props |
| `/ios/vendor/[id]/preview` | `app/(dashboard)/ios/vendor/[id]/preview/page.tsx` | standard / workspace variants via shell props |
| `/links` | `app/(dashboard)/links/page.tsx` | standard / workspace variants via shell props |
| `/operations/move` | `app/(dashboard)/operations/move/page.tsx` | standard / workspace variants via shell props |
| `/operations/reassignment` | `app/(dashboard)/operations/reassignment/page.tsx` | standard / workspace variants via shell props |
| `/planning` | `app/(dashboard)/planning/page.tsx` | standard / workspace variants via shell props |
| `/reports` | `app/(dashboard)/reports/page.tsx` | standard / workspace variants via shell props |
| `/reports/client-profitability` | `app/(dashboard)/reports/client-profitability/page.tsx` | standard / workspace variants via shell props |
| `/reports/daily` | `app/(dashboard)/reports/daily/page.tsx` | standard / workspace variants via shell props |
| `/reports/pnl` | `app/(dashboard)/reports/pnl/page.tsx` | standard / workspace variants via shell props |
| `/reports/revenue-by-function` | `app/(dashboard)/reports/revenue-by-function/page.tsx` | standard / workspace variants via shell props |
| `/reports/spending-by-category` | `app/(dashboard)/reports/spending-by-category/page.tsx` | standard / workspace variants via shell props |
| `/reports/statements` | `app/(dashboard)/reports/statements/page.tsx` | standard / workspace variants via shell props |
| `/reports/statements/client/[id]` | `app/(dashboard)/reports/statements/client/[id]/page.tsx` | standard / workspace variants via shell props |
| `/reports/statements/vendor/[id]` | `app/(dashboard)/reports/statements/vendor/[id]/page.tsx` | standard / workspace variants via shell props |
| `/reports/top-clients` | `app/(dashboard)/reports/top-clients/page.tsx` | standard / workspace variants via shell props |
| `/reports/top-influencers` | `app/(dashboard)/reports/top-influencers/page.tsx` | standard / workspace variants via shell props |
| `/reports/unsettled` | `app/(dashboard)/reports/unsettled/page.tsx` | standard / workspace variants via shell props |
| `/reports/unsettled/client/[id]` | `app/(dashboard)/reports/unsettled/client/[id]/page.tsx` | standard / workspace variants via shell props |
| `/reports/vr` | `app/(dashboard)/reports/vr/page.tsx` | standard / workspace variants via shell props |
| `/settings/access-control` | `app/(dashboard)/settings/access-control/page.tsx` | standard / workspace variants via shell props |
| `/settings/client-access` | `app/(dashboard)/settings/client-access/page.tsx` | standard / workspace variants via shell props |
| `/settings/client-classification-review` | `app/(dashboard)/settings/client-classification-review/page.tsx` | standard / workspace variants via shell props |
| `/settings/discovery-diagnostics` | `app/(dashboard)/settings/discovery-diagnostics/page.tsx` | standard / workspace variants via shell props |
| `/settings/discovery-engine` | `app/(dashboard)/settings/discovery-engine/page.tsx` | standard / workspace variants via shell props |
| `/settings/email` | `app/(dashboard)/settings/email/page.tsx` | standard / workspace variants via shell props |
| `/settings/permissions` | `app/(dashboard)/settings/permissions/page.tsx` | standard / workspace variants via shell props |
| `/settings/roles` | `app/(dashboard)/settings/roles/page.tsx` | standard / workspace variants via shell props |
| `/settings/users` | `app/(dashboard)/settings/users/page.tsx` | standard / workspace variants via shell props |
| `/studio` | `app/(dashboard)/studio/page.tsx` | platformV6 prop |
| `/system/health` | `app/(dashboard)/system/health/page.tsx` | standard / workspace variants via shell props |
| `/treasury` | `app/(dashboard)/treasury/page.tsx` | standard / workspace variants via shell props |
| `/vendors/[id]` | `app/(dashboard)/vendors/[id]/page.tsx` | platformV6 prop |

### PortalShell (route-group layout)

| Route | File | Notes |
|---|---|---|
| `/client-portal` | `app/(client-portal)/client-portal/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/client-portal/approvals` | `app/(client-portal)/client-portal/approvals/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/client-portal/campaigns` | `app/(client-portal)/client-portal/campaigns/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/client-portal/client-io` | `app/(client-portal)/client-portal/client-io/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/client-portal/invoices` | `app/(client-portal)/client-portal/invoices/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/client-portal/notifications` | `app/(client-portal)/client-portal/notifications/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/client-portal/publications` | `app/(client-portal)/client-portal/publications/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/client-portal/reports` | `app/(client-portal)/client-portal/reports/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal` | `app/(creator-portal)/creator-portal/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal/campaigns` | `app/(creator-portal)/creator-portal/campaigns/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal/campaigns/[id]` | `app/(creator-portal)/creator-portal/campaigns/[id]/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal/deliverables` | `app/(creator-portal)/creator-portal/deliverables/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal/notifications` | `app/(creator-portal)/creator-portal/notifications/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal/payments` | `app/(creator-portal)/creator-portal/payments/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal/profile` | `app/(creator-portal)/creator-portal/profile/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal/publications` | `app/(creator-portal)/creator-portal/publications/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |
| `/creator-portal/vendor-ios` | `app/(creator-portal)/creator-portal/vendor-ios/page.tsx` | Shell applied in app/(client-portal)/layout.tsx or app/(creator-portal)/layout.tsx |

### Login (no app chrome)

| Route | File | Notes |
|---|---|---|
| `/login` | `app/login/page.tsx` | LoginScreen via app/login/layout.tsx passthrough |

### Standalone (no shared shell)

| Route | File | Notes |
|---|---|---|
| `/io-approval/client` | `app/io-approval/client/page.tsx` | Token approval pages — Card UI only |
| `/io-approval/vendor` | `app/io-approval/vendor/page.tsx` | Token approval pages — Card UI only |

### Redirect only

| Route | File | Notes |
|---|---|---|
| `/discovery/intelligence` | `app/(dashboard)/discovery/intelligence/page.tsx` | redirects to /discovery/intelligence/library |

### Shell notes / ambiguities

| Route | Situation |
|---|---|
| `/discovery` | Uses **DashboardShell** directly (legacy discovery crawler workspace), **not** `DiscoveryPageShell`. Still shows `DiscoveryDatabaseStatsBar` (standalone variant). |
| `/discovery/compare` | Uses **DashboardShell** with a **custom mini nav** (Search / Compare / Discovery links) — not the shared Discovery tab SubNav. |
| `/discovery/intelligence` | Redirect-only page → `/discovery/intelligence/library` (which uses DiscoveryPageShell). |
| `/discovery/*` preview routes (`quotations/[id]/preview`, `shortlists/[id]/preview`) | **DashboardShell** only (document preview chrome), not DiscoveryPageShell. |
| `/studio` | **DashboardShell** with `platformV6` / `containedMain` — no separate StudioShell component shared across routes. Feature CSS lives under `features/campaign-studio/styles/`. |
| `/ai/[conversationId]/decisions` | DashboardShell + feature `CampaignIntelligenceShell` (single-page workspace, not a multi-route layout shell). |
| Finance CN/DN routes | DashboardShell + feature `AdjustmentModuleShell` (module content wrapper, not app chrome). |
| Portal pages | Page files do **not** import a shell; `PortalShell` comes from the route-group `layout.tsx`. |
| `AppSidebar` vs `CollapsibleAppSidebar` | Live shell uses **CollapsibleAppSidebar**. `AppSidebar` appears to be an older/alternate nav tree still in the repo. |

---

## 2. Shared layout / shell component sources (full)

These wrappers define app chrome used across multiple routes. Embedded in full.

### 2.1 App route layouts

#### `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeHeadScript } from "@/lib/theme/theme-head-script";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thinkway Platform",
  description: "Enterprise influencer marketing operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased font-sans",
        geistSans.variable,
        geistMono.variable
      )}
    >
      <head>
        <ThemeHeadScript />
      </head>
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-background text-foreground"
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

```

#### `app/(dashboard)/layout.tsx`

```tsx
import { DashboardProviders } from "@/components/layout/dashboard-providers";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardProviders>{children}</DashboardProviders>;
}

```

#### `app/(client-portal)/layout.tsx`

```tsx
import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getClientUnreadNotificationCount } from "@/features/portals/queries";
import { requireClientScope } from "@/features/portals/scope";
import type { PortalNavItem } from "@/components/layout/portal-nav";

const clientNavItems = [
  { href: "/client-portal", label: "Dashboard" },
  { href: "/client-portal/campaigns", label: "Campaigns" },
  { href: "/client-portal/publications", label: "Publications" },
  { href: "/client-portal/approvals", label: "Approvals" },
  { href: "/client-portal/invoices", label: "Invoices" },
  { href: "/client-portal/reports", label: "Reports" },
  { href: "/client-portal/notifications", label: "Notifications" },
  { href: "/client-portal/client-io", label: "Client IO" },
] as const;

export default async function ClientPortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/client-portal");
  }

  let userLabel = user.email ?? "Client";
  try {
    const { supabase: scopedSupabase, scope } = await requireClientScope("client_portal.read");
    if (scope.primaryClientId) {
      const { data } = await scopedSupabase
        .from("clients")
        .select("name")
        .eq("id", scope.primaryClientId)
        .maybeSingle();
      if (data?.name) {
        userLabel = data.name;
      }
    }
  } catch {
    redirect("/");
  }

  const unreadCount = await getClientUnreadNotificationCount();
  const navItems: PortalNavItem[] = clientNavItems.map((item) =>
    item.href === "/client-portal/notifications"
      ? { ...item, badge: unreadCount }
      : { ...item }
  );

  return (
    <PortalShell
      title="Client Portal"
      description="Operational campaign visibility with approvals, invoices, reports, and client IO."
      userLabel={userLabel}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}

```

#### `app/(creator-portal)/layout.tsx`

```tsx
import { redirect } from "next/navigation";

import { PortalShell } from "@/components/layout/portal-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCreatorUnreadNotificationCount } from "@/features/portals/queries";
import { requireCreatorScope } from "@/features/portals/scope";
import type { PortalNavItem } from "@/components/layout/portal-nav";

const creatorNavItems = [
  { href: "/creator-portal", label: "Dashboard" },
  { href: "/creator-portal/campaigns", label: "Campaigns" },
  { href: "/creator-portal/deliverables", label: "Deliverables" },
  { href: "/creator-portal/publications", label: "Publications" },
  { href: "/creator-portal/payments", label: "Payments" },
  { href: "/creator-portal/vendor-ios", label: "Vendor IOs" },
  { href: "/creator-portal/notifications", label: "Notifications" },
  { href: "/creator-portal/profile", label: "Profile" },
] as const;

export default async function CreatorPortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/creator-portal");
  }

  let creatorName = user.email ?? "Creator";
  try {
    const { scope } = await requireCreatorScope("creator_portal.read");
    creatorName = scope.influencerName;
  } catch {
    redirect("/");
  }

  const unreadCount = await getCreatorUnreadNotificationCount();
  const navItems: PortalNavItem[] = creatorNavItems.map((item) =>
    item.href === "/creator-portal/notifications"
      ? { ...item, badge: unreadCount }
      : { ...item }
  );

  return (
    <PortalShell
      title="Creator Portal"
      description="Campaign-focused execution for creator assignments, IOs, deliverables, and payment visibility."
      userLabel={creatorName}
      navItems={navItems}
    >
      {children}
    </PortalShell>
  );
}

```

#### `app/login/layout.tsx`

```tsx
export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

```
### 2.2 Dashboard shell + sidebar

#### `components/layout/dashboard-shell.tsx`

```tsx
import Link from "next/link";
import {
  Building2Icon,
  FileSignatureIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { CollapsibleAppSidebar } from "@/components/layout/collapsible-app-sidebar";
import { DashboardHelpButton } from "@/components/layout/dashboard-help-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PageBackButton } from "@/components/navigation/page-back-button";
import { UserAccount } from "@/components/layout/user-account";
import {
  HomeWorkspaceNavTabs,
  type HomeWorkspaceNavTab,
} from "@/features/home/components/home-workspace-nav-tabs";
import { getAuthUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/", label: "Home", icon: LayoutDashboardIcon },
  { href: "/clients", label: "Clients", icon: Building2Icon },
  { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
  { href: "/ios/client", label: "IOs", icon: FileSignatureIcon },
  { href: "/settings/users", label: "Settings", icon: Settings2Icon },
  { href: "/vendors", label: "Vendors", icon: UsersIcon },
] as const;

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** thinkway-platform_6.html list/workspace chrome (light, compact topbar). */
  platformV6?: boolean;
  /** Hide generic page header (entity workspaces provide their own). */
  hidePageHeader?: boolean;
  /** Full-bleed home layout — hides shell topbars (desktop + mobile). */
  immersiveLayout?: boolean;
  /**
   * Lock shell height and delegate scrolling to page content (campaign workspaces).
   * Prevents document/main scroll so inner sticky regions work.
   * Full-bleed main (no outer p-4/md:p-6) — pages own their gutters.
   */
  containedMain?: boolean;
  mainClassName?: string;
  /** Extra classes on the compact topbar (hidePageHeader / non–platform-v6). */
  headerClassName?: string;
  /** When set, shows Overview / Finance / Campaigns / Clients switcher in the shell topbar. */
  workspaceNavActive?: HomeWorkspaceNavTab;
  /** When set, shows a back control that navigates to this path. */
  backFallbackHref?: string;
  backLabel?: string;
};

export async function DashboardShell({
  children,
  title,
  description,
  actions,
  platformV6 = false,
  hidePageHeader = false,
  immersiveLayout = false,
  containedMain = false,
  mainClassName,
  headerClassName,
  workspaceNavActive,
  backFallbackHref,
  backLabel = "Go back",
}: DashboardShellProps) {
  const { user, fullName } = await getAuthUser();
  const userEmail = user?.email ?? null;

  return (
    <div className="relative flex min-h-svh bg-background text-foreground">
      <CollapsibleAppSidebar userEmail={userEmail} />
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ease-in-out",
          containedMain && "h-svh max-h-svh overflow-hidden"
        )}
      >
        {!immersiveLayout ? (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md md:hidden dark:bg-background/90">
          <Link href="/" className="flex items-center">
            <ThinkwayLogo compact className="mb-0" />
          </Link>
          <nav className="flex items-center gap-1">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-2xl border border-border px-3 py-2 text-xs font-medium",
                    "bg-card text-foreground shadow-[var(--card-shadow)]"
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <DashboardHelpButton />
            <ThemeToggle />
            <UserAccount email={userEmail} name={fullName} compact inSidebar={false} />
          </div>
        </div>
        ) : null}
        {!immersiveLayout && workspaceNavActive ? (
          <div className="thinkway-platform-v6 thinkway-platform-v6-workspace-nav-mobile md:hidden">
            <HomeWorkspaceNavTabs active={workspaceNavActive} />
          </div>
        ) : null}
        {!immersiveLayout && hidePageHeader ? (
          <header
            className={cn(
              "hidden items-center justify-between gap-3 md:flex",
              platformV6
                ? cn(
                    "thinkway-platform-v6-topbar",
                    workspaceNavActive && "thinkway-platform-v6-topbar--workspace-nav"
                  )
                : cn("thinkway-shell-header px-4 py-2.5 md:px-8", headerClassName)
            )}
          >
            {platformV6 ? (
              <div>
                <span className="platform-v6-tb-title">{title}</span>
                {description ? (
                  <p className="platform-v6-tb-sub">{description}</p>
                ) : null}
              </div>
            ) : (
              <Link href="/" className="flex shrink-0 items-center" title="Thinkway home">
                <ThinkwayLogo compact showText className="mb-0" />
              </Link>
            )}
            {workspaceNavActive ? <HomeWorkspaceNavTabs active={workspaceNavActive} /> : null}
            <div className="flex items-center gap-2">
              <DashboardHelpButton />
              <ThemeToggle />
              <UserAccount email={userEmail} name={fullName} compact inSidebar={false} />
            </div>
          </header>
        ) : !immersiveLayout && platformV6 ? (
          <header
            className={cn(
              "thinkway-platform-v6-topbar hidden w-full md:flex",
              "thinkway-platform-v6",
              workspaceNavActive && "thinkway-platform-v6-topbar--workspace-nav"
            )}
          >
            <div>
              <span className="platform-v6-tb-title">{title}</span>
              {description ? <p className="platform-v6-tb-sub">{description}</p> : null}
            </div>
            {workspaceNavActive ? <HomeWorkspaceNavTabs active={workspaceNavActive} /> : null}
            <div className="flex items-center gap-2">
              <DashboardHelpButton />
              <ThemeToggle />
              <UserAccount email={userEmail} name={fullName} compact inSidebar={false} />
            </div>
          </header>
        ) : !immersiveLayout ? (
          <header className="thinkway-shell-header flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex min-w-0 items-start gap-3">
              <Link
                href="/"
                className="hidden shrink-0 items-center md:flex"
                title="Thinkway home"
              >
                <ThinkwayLogo compact showText className="mb-0" />
              </Link>
              {backFallbackHref ? (
                <PageBackButton
                  fallbackHref={backFallbackHref}
                  label={backLabel}
                  variant="icon"
                  className="mt-0.5 shrink-0"
                />
              ) : null}
              <div className="min-w-0 space-y-1">
                <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
                {description ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <DashboardHelpButton />
              <ThemeToggle />
              {actions}
            </div>
          </header>
        ) : null}
        <main
          className={cn(
            platformV6 && "thinkway-platform-v6",
            /* containedMain is full-bleed — pages own their own gutters (e.g. Discovery px-4).
               Do not add p-4 md:p-6 here: callers overriding with only p-0 still left md:p-6,
               which framed header+content as one outer panel. */
            containedMain
              ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
              : "min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6",
            platformV6 && !containedMain && "bg-[#f8fafc] p-6 md:p-6",
            platformV6 && containedMain && "bg-[#f8fafc]",
            mainClassName
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

```

#### `components/layout/collapsible-app-sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ArrowRightLeftIcon,
  BarChart3Icon,
  BrainIcon,
  Building2Icon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronRightIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CoinsIcon,
  FileSignatureIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LayersIcon,
  Link2Icon,
  ListIcon,
  MegaphoneIcon,
  RadarIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PinIcon,
  PinOffIcon,
  PercentIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SearchIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  SendIcon,
  TagsIcon,
  TargetIcon,
  UploadIcon,
  UserCogIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { UserAccount } from "@/components/layout/user-account";
import { isIntelligenceEnabled } from "@/lib/intelligence/feature-flag";
import {
  APP_SIDEBAR_MARGIN,
  APP_SIDEBAR_WIDTH_COLLAPSED,
  APP_SIDEBAR_WIDTH_CSS_VAR,
  APP_SIDEBAR_WIDTH_EXPANDED,
  getAppSidebarLayoutWidth,
  resolveAppSidebarExpanded,
} from "@/lib/layout/app-sidebar-width";
import { cn } from "@/lib/utils";

type NavLinkItem = {
  kind: "link";
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavSubheaderItem = {
  kind: "subheader";
  label: string;
};

type NavEntry = NavLinkItem | NavSubheaderItem;

type NavGroupIconTone = "blue" | "violet" | "teal" | "amber" | "navy";

type NavGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  iconTone: NavGroupIconTone;
  items: NavEntry[];
};

const GROUP_ICON_TONE_CLASS: Record<NavGroupIconTone, string> = {
  blue: "thinkway-sidebar-grp-icon thinkway-sidebar-grp-icon-blue",
  violet: "thinkway-sidebar-grp-icon thinkway-sidebar-grp-icon-violet",
  teal: "thinkway-sidebar-grp-icon thinkway-sidebar-grp-icon-teal",
  amber: "thinkway-sidebar-grp-icon thinkway-sidebar-grp-icon-amber",
  navy: "thinkway-sidebar-grp-icon thinkway-sidebar-grp-icon-navy",
};

/** Global nav order — overview, workspace, commercial, finance, insights, admin. */
const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboardIcon,
    iconTone: "blue",
    items: [
      { kind: "link", href: "/", label: "Home", icon: LayoutDashboardIcon },
      { kind: "link", href: "/dashboard", label: "Executive", icon: LineChartIcon },
    ],
  },
  {
    label: "Workspace",
    icon: MegaphoneIcon,
    iconTone: "violet",
    items: [
      { kind: "link", href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon },
      { kind: "link", href: "/studio", label: "Studio", icon: LayoutDashboardIcon },
      { kind: "link", href: "/ai", label: "Campaign AI", icon: SparklesIcon },
    ],
  },
  {
    label: "Discovery",
    icon: RadarIcon,
    iconTone: "teal",
    items: [
      { kind: "link", href: "/discovery/search", label: "Search", icon: SearchIcon },
      { kind: "link", href: "/discovery/shortlists", label: "Shortlists", icon: ListIcon },
      {
        kind: "link",
        href: "/discovery/quotations",
        label: "Client Quotations",
        icon: FileTextIcon,
      },
      {
        kind: "link",
        href: "/discovery/campaign-match",
        label: "Campaign Match",
        icon: TargetIcon,
      },
      { kind: "link", href: "/discovery/import", label: "Import Center", icon: UploadIcon },
    ],
  },
  {
    label: "Clients and vendors CRM",
    icon: UsersIcon,
    iconTone: "blue",
    items: [
      { kind: "link", href: "/groups", label: "Holding Groups", icon: LayersIcon },
      { kind: "link", href: "/clients", label: "Clients", icon: Building2Icon },
      { kind: "link", href: "/brands", label: "Brands", icon: SparklesIcon },
      { kind: "link", href: "/vendors", label: "Vendors", icon: UsersIcon },
    ],
  },
  {
    label: "Commercial",
    icon: FileSignatureIcon,
    iconTone: "teal",
    items: [
      { kind: "link", href: "/ios/client", label: "Client IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/ios/vendor", label: "Vendor IOs", icon: FileSignatureIcon },
      { kind: "link", href: "/billing", label: "Billing", icon: ReceiptIcon },
      { kind: "link", href: "/finance/po-tracker", label: "PO Tracker", icon: ReceiptIcon },
    ],
  },
  {
    label: "Finance",
    icon: WalletIcon,
    iconTone: "amber",
    items: [
      { kind: "subheader", label: "Billing & documents" },
      { kind: "link", href: "/finance/invoices", label: "Invoices", icon: FileTextIcon },
      {
        kind: "link",
        href: "/finance/client-credit-notes",
        label: "Client credit notes",
        icon: CircleMinusIcon,
      },
      {
        kind: "link",
        href: "/finance/client-debit-notes",
        label: "Client debit notes",
        icon: CirclePlusIcon,
      },
      {
        kind: "link",
        href: "/finance/vendor-credit-notes",
        label: "Vendor credit notes",
        icon: CircleMinusIcon,
      },
      {
        kind: "link",
        href: "/finance/vendor-debit-notes",
        label: "Vendor debit notes",
        icon: CirclePlusIcon,
      },
      { kind: "subheader", label: "Treasury & cash" },
      { kind: "link", href: "/collections", label: "Collections", icon: CoinsIcon },
      { kind: "link", href: "/treasury", label: "Treasury", icon: WalletIcon },
      { kind: "link", href: "/finance/posting-center", label: "Posting center", icon: SendIcon },
      { kind: "subheader", label: "Compliance & planning" },
      { kind: "link", href: "/finance/vat", label: "VAT & Tax", icon: PercentIcon },
      { kind: "link", href: "/finance/exchange-rates", label: "Exchange rates", icon: RefreshCwIcon },
      { kind: "link", href: "/finance/periods", label: "Periods", icon: CalendarRangeIcon },
      { kind: "link", href: "/planning", label: "Planning", icon: CalendarClockIcon },
      { kind: "subheader", label: "Move from Acc to another" },
      { kind: "link", href: "/operations/move", label: "Move", icon: ArrowRightLeftIcon },
      {
        kind: "link",
        href: "/operations/reassignment",
        label: "Reassignment",
        icon: ArrowRightLeftIcon,
      },
    ],
  },
  {
    label: "Insights",
    icon: BarChart3Icon,
    iconTone: "violet",
    items: [
      { kind: "link", href: "/reports", label: "Reports", icon: BarChart3Icon },
      // Intelligence — gated by INTELLIGENCE_ARCHIVED (see docs/INTELLIGENCE_ARCHIVE.md)
      ...(isIntelligenceEnabled()
        ? [{ kind: "link" as const, href: "/intelligence", label: "Intelligence", icon: BrainIcon }]
        : []),
      { kind: "link", href: "/links", label: "Link Generator", icon: Link2Icon },
    ],
  },
  {
    label: "Administration",
    icon: Settings2Icon,
    iconTone: "navy",
    items: [
      { kind: "link", href: "/settings/users", label: "Users", icon: Settings2Icon },
      { kind: "link", href: "/settings/roles", label: "Roles", icon: UserCogIcon },
      { kind: "link", href: "/settings/permissions", label: "Permissions", icon: ShieldIcon },
      {
        kind: "link",
        href: "/settings/access-control",
        label: "Access Control",
        icon: ShieldIcon,
      },
      { kind: "link", href: "/settings/client-access", label: "Client Access", icon: UsersIcon },
      {
        kind: "link",
        href: "/settings/client-classification-review",
        label: "Classification Review",
        icon: TagsIcon,
      },
      { kind: "link", href: "/settings/email", label: "Email", icon: Settings2Icon },
      { kind: "link", href: "/system/health", label: "System Health", icon: ActivityIcon },
    ],
  },
];

const ALL_GROUP_LABELS = navGroups.map((g) => g.label);
const STORAGE_EXPANDED = "thinkway-sidebar-expanded";
const STORAGE_COLLAPSED_GROUPS = "thinkway-sidebar-collapsed-groups";
const SIDEBAR_HIDE_DELAY_MS = 200;
const HOVER_TRIGGER_WIDTH = "0.75rem";

/** Legacy section labels from pre-reorg sidebar — map into current groups. */
const LEGACY_COLLAPSED_LABEL_MAP: Record<string, string[]> = {
  Organization: ["Workspace", "Clients and vendors CRM", "Administration"],
  Clients: ["Clients and vendors CRM"],
  Operations: ["Finance"],
  System: ["Administration"],
};

function getNavLinks(group: NavGroup): NavLinkItem[] {
  return group.items.filter((item): item is NavLinkItem => item.kind === "link");
}

function migrateCollapsedGroups(stored: Set<string>): Set<string> {
  const migrated = new Set<string>();
  let hadLegacy = false;

  for (const label of stored) {
    const mapped = LEGACY_COLLAPSED_LABEL_MAP[label];
    if (mapped) {
      hadLegacy = true;
      for (const next of mapped) migrated.add(next);
    } else if (ALL_GROUP_LABELS.includes(label)) {
      migrated.add(label);
    }
  }

  if (hadLegacy && typeof window !== "undefined") {
    localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...migrated]));
  }

  return migrated;
}

type CollapsibleAppSidebarProps = {
  userEmail?: string | null;
};

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveGroupLabel(pathname: string): string | null {
  for (const group of navGroups) {
    if (getNavLinks(group).some((item) => isItemActive(pathname, item.href))) {
      return group.label;
    }
  }
  return null;
}

function readCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set(ALL_GROUP_LABELS);
  try {
    const raw = localStorage.getItem(STORAGE_COLLAPSED_GROUPS);
    if (!raw) return new Set(ALL_GROUP_LABELS);
    const parsed = JSON.parse(raw) as string[];
    return migrateCollapsedGroups(new Set(parsed));
  } catch {
    return new Set(ALL_GROUP_LABELS);
  }
}

function readSidebarExpanded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(STORAGE_EXPANDED);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

function initialCollapsedGroups(pathname: string): Set<string> {
  const next = new Set(ALL_GROUP_LABELS);
  const active = findActiveGroupLabel(pathname);
  if (active) next.delete(active);
  return next;
}

export function CollapsibleAppSidebar({ userEmail }: CollapsibleAppSidebarProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    initialCollapsedGroups(pathname)
  );
  const [hydrated, setHydrated] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setExpanded(readSidebarExpanded());
    const hasStored = localStorage.getItem(STORAGE_COLLAPSED_GROUPS) !== null;
    if (hasStored) {
      const stored = readCollapsedGroups();
      const next = new Set(stored);
      const active = findActiveGroupLabel(pathname);
      if (active) next.delete(active);
      setCollapsedGroups(next);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const activeGroup = findActiveGroupLabel(pathname);
    if (!activeGroup) return;
    setCollapsedGroups((prev) => {
      if (!prev.has(activeGroup)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup);
      localStorage.setItem(
        STORAGE_COLLAPSED_GROUPS,
        JSON.stringify([...next])
      );
      return next;
    });
  }, [pathname, hydrated]);

  const persistExpanded = useCallback((value: boolean) => {
    setExpanded(value);
    localStorage.setItem(STORAGE_EXPANDED, String(value));
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (pinned) return;
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setRevealed(false);
      hideTimerRef.current = null;
    }, SIDEBAR_HIDE_DELAY_MS);
  }, [clearHideTimer, pinned]);

  const handleReveal = useCallback(() => {
    clearHideTimer();
    setRevealed(true);
  }, [clearHideTimer]);

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      if (next) {
        clearHideTimer();
        setRevealed(true);
      }
      return next;
    });
  }, [clearHideTimer]);

  useEffect(() => {
    return () => clearHideTimer();
  }, [clearHideTimer]);

  const isVisible = pinned || revealed;
  const displayExpanded = resolveAppSidebarExpanded(isVisible, pinned, expanded);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty(
      APP_SIDEBAR_WIDTH_CSS_VAR,
      getAppSidebarLayoutWidth(isVisible, displayExpanded)
    );
  }, [displayExpanded, hydrated, isVisible]);

  const sidebarWidth = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;
  const slotWidth = isVisible
    ? `calc(${sidebarWidth} + ${APP_SIDEBAR_MARGIN})`
    : "0px";

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      localStorage.setItem(STORAGE_COLLAPSED_GROUPS, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const sidebarControlButtonClass =
    "flex size-[30px] items-center justify-center rounded-lg border-none bg-transparent text-sidebar-muted-foreground transition-colors hover:bg-[var(--sidebar-rail-hover-bg)] hover:text-sidebar-foreground active:scale-90";

  return (
    <>
      {!isVisible ? (
        <div
          aria-hidden
          className="fixed inset-y-0 left-0 z-50 hidden md:block"
          style={{ width: HOVER_TRIGGER_WIDTH }}
          onMouseEnter={handleReveal}
        />
      ) : null}

      <div
        className="relative hidden shrink-0 self-start overflow-hidden transition-all duration-300 ease-in-out md:sticky md:top-0 md:block md:h-svh md:max-h-svh"
        style={{ width: slotWidth }}
        onMouseEnter={handleReveal}
        onMouseLeave={scheduleHide}
      >
        <aside
          className={cn(
            "absolute flex flex-col overflow-hidden rounded-[20px] border border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
            "shadow-[var(--sidebar-rail-float-shadow)]",
            isVisible
              ? "pointer-events-auto translate-x-0 opacity-100"
              : "pointer-events-none -translate-x-2 opacity-0"
          )}
          style={{
            left: APP_SIDEBAR_MARGIN,
            top: APP_SIDEBAR_MARGIN,
            height: `calc(100svh - 2 * ${APP_SIDEBAR_MARGIN})`,
            width: sidebarWidth,
          }}
        >
      <div
        className={cn(
          "flex items-center",
          displayExpanded
            ? "justify-between px-[18px] pb-3 pt-[18px]"
            : "justify-center px-1.5 py-3"
        )}
      >
        <Link href="/" className="min-w-0" title="Thinkway">
          <ThinkwayLogo showText={displayExpanded} compact={!displayExpanded} className="mb-0" />
        </Link>
            {displayExpanded ? (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={togglePin}
                  className={sidebarControlButtonClass}
                  title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                  aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                  aria-pressed={pinned}
                >
                  {pinned ? (
                    <PinOffIcon className="size-4" />
                  ) : (
                    <PinIcon className="size-4" />
                  )}
                </button>
                {pinned ? (
                  <button
                    type="button"
                    onClick={() => persistExpanded(false)}
                    className={sidebarControlButtonClass}
                    title="Collapse sidebar"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftCloseIcon className="size-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
      </div>

          {!displayExpanded ? (
            <div className="flex justify-center gap-1 px-1.5 py-1">
              <button
                type="button"
                onClick={togglePin}
                className={sidebarControlButtonClass}
                title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                aria-pressed={pinned}
              >
                {pinned ? (
                  <PinOffIcon className="size-4" />
                ) : (
                  <PinIcon className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => persistExpanded(true)}
                className={sidebarControlButtonClass}
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpenIcon className="size-4" />
              </button>
            </div>
          ) : null}

      <nav
        className={cn(
          "flex flex-1 flex-col overflow-y-auto overflow-x-hidden",
          displayExpanded ? "gap-0.5 px-3 pb-3 pt-0.5" : "gap-0.5 px-1 py-2"
        )}
      >
        {navGroups.map((group) => {
          const groupCollapsed = collapsedGroups.has(group.label);
          const GroupIcon = group.icon;

          return (
            <div key={group.label} className="mb-0.5 flex flex-col">
              {displayExpanded ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center gap-[11px] rounded-[11px] px-2.5 py-2.5 text-left text-[13px] font-semibold text-sidebar-foreground transition-colors hover:bg-[var(--sidebar-rail-hover-bg)] active:scale-[0.99]"
                  aria-expanded={!groupCollapsed}
                  aria-label={`${groupCollapsed ? "Expand" : "Collapse"} ${group.label}`}
                >
                  <span className={GROUP_ICON_TONE_CLASS[group.iconTone]}>
                    <GroupIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  <ChevronRightIcon
                    className={cn(
                      "size-[15px] shrink-0 text-sidebar-muted-foreground transition-transform duration-200",
                      !groupCollapsed && "rotate-90"
                    )}
                  />
                </button>
              ) : null}

              <div
                className={cn(
                  "flex flex-col",
                  displayExpanded && groupCollapsed && "hidden",
                  displayExpanded && "pl-1"
                )}
              >
                {group.items.map((item) => {
                  if (item.kind === "subheader") {
                    if (!displayExpanded) return null;
                    return (
                      <div
                        key={`subheader-${item.label}`}
                        className="px-3 pt-2 pb-0.5 text-[11px] font-bold tracking-wide text-sidebar-muted-foreground uppercase first:pt-0"
                      >
                        {item.label}
                      </div>
                    );
                  }

                  const active = isItemActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "relative flex items-center font-medium transition-[background-color,color] duration-[130ms]",
                        displayExpanded
                          ? "my-px gap-2.5 rounded-[10px] py-2 pr-3 pl-4 text-[13px]"
                          : "justify-center rounded-lg px-1 py-1.5 text-sm",
                        active
                          ? displayExpanded
                            ? "thinkway-sidebar-item-active"
                            : "text-white shadow-[var(--sidebar-rail-active-shadow)] [background:var(--sidebar-rail-grad)]"
                          : displayExpanded
                            ? "text-[var(--sidebar-rail-item-fg)] hover:bg-[var(--sidebar-rail-hover-bg)] hover:text-sidebar-foreground"
                            : "text-sidebar-muted-foreground hover:bg-[var(--sidebar-rail-hover-bg)] hover:text-sidebar-foreground"
                      )}
                    >
                      {displayExpanded ? (
                        <span
                          className={cn(
                            "thinkway-sidebar-item-dot",
                            !active && "group-hover:bg-sidebar-muted-foreground"
                          )}
                        />
                      ) : (
                        <Icon className="size-3.5 shrink-0" />
                      )}
                      {displayExpanded ? (
                        <span className="truncate font-medium">{item.label}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div
        className={cn(
          "border-t border-[var(--sidebar-rail-line)]",
          displayExpanded ? "px-3.5 py-3" : "p-1.5"
        )}
      >
        {displayExpanded ? (
          <UserAccount email={userEmail} />
        ) : (
          <UserAccount email={userEmail} compact />
        )}
      </div>
        </aside>
      </div>
    </>
  );
}

```

#### `components/layout/app-sidebar.tsx`

```tsx
"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeftIcon,
  Building2Icon,
  CalendarClockIcon,
  FileSignatureIcon,
  LayoutDashboardIcon,
  LayersIcon,
  ListIcon,
  MegaphoneIcon,
  RadarIcon,
  ReceiptIcon,
  SearchIcon,
  Settings2Icon,
  TargetIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";

import { UserAccount } from "@/components/layout/user-account";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboardIcon },
  { href: "/dashboard", label: "Executive", icon: LayoutDashboardIcon },
  { href: "/campaigns", label: "Campaigns", icon: MegaphoneIcon,
    children: [
      { href: "/campaigns", label: "All campaigns" },
      { href: "/studio", label: "Studio" },
    ],
  },
  {
    href: "/discovery/search",
    label: "Discovery",
    icon: RadarIcon,
    children: [
      { href: "/discovery/search", label: "Search" },
      { href: "/discovery/shortlists", label: "Shortlists" },
      { href: "/discovery/quotations", label: "Client Quotations" },
      { href: "/discovery/campaign-match", label: "Campaign Match" },
      { href: "/discovery/import", label: "Import Center" },
    ],
  },
  {
    href: "/groups",
    label: "Clients",
    icon: Building2Icon,
    children: [
      { href: "/groups", label: "Holding Groups" },
      { href: "/clients", label: "Clients" },
      { href: "/brands", label: "Brands" },
      { href: "/vendors", label: "Vendors" },
    ],
  },
  {
    href: "/ios",
    label: "IOs",
    icon: FileSignatureIcon,
    children: [
      { href: "/ios/client", label: "Client IOs" },
      { href: "/ios/vendor", label: "Vendor IOs" },
    ],
  },
  { href: "/billing", label: "Billing", icon: ReceiptIcon },
  {
    href: "/operations",
    label: "Operations",
    icon: ArrowRightLeftIcon,
    children: [
      { href: "/operations/move", label: "Move between accounts" },
      { href: "/operations/reassignment", label: "Reassignment center" },
    ],
  },
  {
    href: "/finance",
    label: "Finance",
    icon: CalendarClockIcon,
    children: [
      { href: "/finance/invoices", label: "Invoices" },
      { href: "/finance/client-credit-notes", label: "Client credit notes" },
      { href: "/finance/vendor-credit-notes", label: "Vendor credit notes" },
      { href: "/finance/client-debit-notes", label: "Client debit notes" },
      { href: "/finance/vendor-debit-notes", label: "Vendor debit notes" },
      { href: "/finance/posting-center", label: "Posting center" },
      { href: "/collections", label: "Collections" },
      { href: "/treasury", label: "Treasury" },
      { href: "/finance/aging", label: "Aging reports" },
      { href: "/finance/credit-limit", label: "Credit limit" },
      { href: "/finance/vat", label: "VAT & tax" },
      { href: "/finance/po-tracker", label: "PO tracker" },
      { href: "/planning", label: "Planning" },
      { href: "/finance/exchange-rates", label: "Exchange rates" },
      { href: "/finance/periods", label: "Period management" },
      { href: "/system/health", label: "System health" },
    ],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings2Icon,
    children: [
      { href: "/settings/users", label: "Users" },
      { href: "/settings/roles", label: "Roles" },
      { href: "/settings/permissions", label: "Permissions" },
      { href: "/settings/access-control", label: "Access Control" },
      { href: "/settings/client-access", label: "Client Access" },
      { href: "/settings/client-classification-review", label: "Classification Review" },
      { href: "/settings/email", label: "Email" },
      { href: "/settings/discovery-engine", label: "Discovery Engine" },
      { href: "/settings/discovery-diagnostics", label: "Discovery Diagnostics" },
    ],
  },
];

type AppSidebarProps = {
  userEmail?: string | null;
};

export function AppSidebar({ userEmail }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          Thinkway
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : item.children
                ? item.children.some(
                    (child) =>
                      pathname === child.href || pathname.startsWith(`${child.href}/`)
                  )
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <div key={item.label}>
              <Link
                href={item.children?.[0]?.href ?? item.href}
                className={cn(
                  "flex items-center gap-3 rounded-3xl px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
              {item.children && isActive ? (
                <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                  {item.children.map((child) => {
                    const childActive =
                      pathname === child.href || pathname.startsWith(`${child.href}/`);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "rounded-2xl px-2 py-1.5 text-xs font-medium transition-colors",
                          childActive
                            ? "text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <UserAccount email={userEmail} />
      </div>
    </aside>
  );
}

```

> **Note:** `AppSidebar` is the older flat nav; the live dashboard uses `CollapsibleAppSidebar`.
### 2.3 Discovery shell family

#### `features/discovery/components/discovery-page-shell.tsx`

```tsx
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { cn } from "@/lib/utils";

import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageHeader,
  type DiscoveryPageKey,
} from "./discovery-page-identity";

export type DiscoveryPageShellVariant = "list" | "workspace" | "flush";

type DiscoveryPageShellProps = {
  page: DiscoveryPageKey;
  /** Override SubNav active matching (defaults to page identity href). */
  activeHref?: string;
  showDatabaseStats?: boolean;
  /**
   * list — lavender canvas + padded scroll region + optional page header
   * workspace — campaign-surface / muted workspace (detail pages)
   * flush — full-bleed content under SubNav (Creator Search)
   */
  variant?: DiscoveryPageShellVariant;
  /** When false, skip DiscoveryPageHeader (e.g. flush workspaces with their own top bar). */
  showHeader?: boolean;
  headerActions?: ReactNode;
  /** Extra chrome above children (e.g. back bar on detail pages). */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared Discovery chrome: DashboardShell + tab SubNav (+ stats) + content region.
 * Matches thinkway-client-quotations.html shell structure.
 */
export function DiscoveryPageShell({
  page,
  activeHref,
  showDatabaseStats = true,
  variant = "list",
  showHeader = variant !== "flush",
  headerActions,
  toolbar,
  children,
  className,
  contentClassName,
}: DiscoveryPageShellProps) {
  const identity = DISCOVERY_PAGE_IDENTITY[page];
  const href = activeHref ?? identity.href;

  return (
    <DashboardShell
      title={identity.title}
      description={identity.description}
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      headerClassName="h-14 px-4 py-0 md:px-4"
    >
      <PlatformErrorBoundary surface="generic">
        <div
          className={cn(
            "flex h-full min-h-0 flex-col overflow-hidden",
            className
          )}
        >
          <DiscoverySubNav
            activeHref={href}
            showDatabaseStats={showDatabaseStats}
          />
          {toolbar}
          {variant === "flush" ? (
            <div className={cn("min-h-0 flex-1 overflow-hidden", contentClassName)}>
              {children}
            </div>
          ) : variant === "workspace" ? (
            <div
              className={cn(
                "thinkway-campaign-workspace flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[var(--camp-surface)]",
                contentClassName
              )}
              data-campaign-workspace-scroll
            >
              {showHeader ? (
                <div className="space-y-4 p-4 md:p-5">
                  <DiscoveryPageHeader
                    identity={identity}
                    actions={headerActions}
                  />
                  {children}
                </div>
              ) : (
                children
              )}
            </div>
          ) : (
            /* HTML `.content`: page-head sits on lavender canvas; only children are card-bounded. */
            <div
              className={cn(
                "min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--lavender)] px-4 pt-5 pb-[60px] dark:bg-background",
                contentClassName
              )}
            >
              {showHeader ? (
                <DiscoveryPageHeader
                  identity={identity}
                  actions={headerActions}
                />
              ) : null}
              {children}
            </div>
          )}
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}

```

#### `features/discovery/components/discovery-page-identity.tsx`

```tsx
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BrainIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ListChecksIcon,
  RadarIcon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type DiscoveryPageKey =
  | "search"
  | "intelligence"
  | "shortlists"
  | "quotations"
  | "campaign-match"
  | "import";

export type DiscoveryPageIdentity = {
  key: DiscoveryPageKey;
  href: string;
  navLabel: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  iconClass: string;
  /** Solid icon tile (list page headers) — overrides gradient badge when set. */
  iconSolidClass?: string;
};

export const DISCOVERY_PAGE_IDENTITY: Record<DiscoveryPageKey, DiscoveryPageIdentity> = {
  search: {
    key: "search",
    href: "/discovery/search",
    navLabel: "Search",
    title: "Creator Search",
    description: "Browse, filter, and shortlist creators across platforms.",
    icon: SearchIcon,
    accent: "from-sky-400/25 via-sky-300/15 to-blue-500/10",
    iconClass: "text-sky-700 dark:text-sky-300",
    iconSolidClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  intelligence: {
    key: "intelligence",
    href: "/discovery/intelligence/library",
    navLabel: "Intelligence",
    title: "Campaign Intelligence Library",
    description: "Shared brief intelligence for Discovery, campaigns, Studio, and AI workflows.",
    icon: BrainIcon,
    accent: "from-teal-400/25 via-teal-300/15 to-emerald-500/10",
    iconClass: "text-teal-700 dark:text-teal-300",
    iconSolidClass: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  },
  shortlists: {
    key: "shortlists",
    href: "/discovery/shortlists",
    navLabel: "Shortlists",
    title: "Shortlists",
    description: "Build, review, approve, and move creators into campaigns.",
    icon: ListChecksIcon,
    accent: "from-violet-400/25 via-violet-300/15 to-purple-500/10",
    iconClass: "text-violet-700 dark:text-violet-300",
    iconSolidClass: "bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  },
  quotations: {
    key: "quotations",
    href: "/discovery/quotations",
    navLabel: "Client Quotations",
    title: "Client Quotations",
    description: "Serial-numbered quotations (QT-YYYY-NNNN). Totals reported in EGP.",
    icon: FileTextIcon,
    accent: "from-amber-400/25 via-amber-300/15 to-orange-500/10",
    iconClass: "text-amber-800 dark:text-amber-300",
    iconSolidClass:
      "bg-[var(--amber-bg)] text-[var(--amber-text)] dark:bg-amber-950/50 dark:text-amber-300",
  },
  "campaign-match": {
    key: "campaign-match",
    href: "/discovery/campaign-match",
    navLabel: "Campaign Match",
    title: "Campaign Match",
    description: "Match discovered creators to campaign briefs with AI scoring.",
    icon: RadarIcon,
    accent: "from-rose-400/25 via-rose-300/15 to-pink-500/10",
    iconClass: "text-rose-700 dark:text-rose-300",
    iconSolidClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  },
  import: {
    key: "import",
    href: "/discovery/import",
    navLabel: "Import Center",
    title: "Discovery Import Center",
    description: "Upload creator datasets from agencies, platforms, or clients.",
    icon: UploadIcon,
    accent: "from-emerald-400/25 via-emerald-300/15 to-teal-500/10",
    iconClass: "text-emerald-700 dark:text-emerald-300",
    iconSolidClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

export const DISCOVERY_SUB_NAV_PAGES: DiscoveryPageIdentity[] = [
  DISCOVERY_PAGE_IDENTITY.search,
  DISCOVERY_PAGE_IDENTITY.intelligence,
  DISCOVERY_PAGE_IDENTITY.shortlists,
  DISCOVERY_PAGE_IDENTITY.quotations,
  DISCOVERY_PAGE_IDENTITY["campaign-match"],
  DISCOVERY_PAGE_IDENTITY.import,
];

type DiscoveryPageIconBadgeProps = {
  identity: DiscoveryPageIdentity;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const BADGE_SIZE = {
  sm: "size-6 rounded-md [&_svg]:size-3",
  md: "size-[38px] rounded-[10px] [&_svg]:size-[19px]",
  lg: "size-12 rounded-xl [&_svg]:size-6",
} as const;

export function DiscoveryPageIconBadge({
  identity,
  size = "md",
  className,
}: DiscoveryPageIconBadgeProps) {
  const Icon = identity.icon;
  const solid = identity.iconSolidClass;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        solid
          ? cn(solid, BADGE_SIZE[size])
          : cn(
              "border border-white/60 bg-gradient-to-br shadow-sm backdrop-blur-sm",
              "dark:border-white/10",
              identity.accent,
              BADGE_SIZE[size]
            ),
        className
      )}
      aria-hidden
    >
      <Icon className={identity.iconClass} />
    </div>
  );
}

type DiscoveryPageHeaderProps = {
  identity: DiscoveryPageIdentity;
  actions?: ReactNode;
  className?: string;
};

export function DiscoveryPageHeader({
  identity,
  actions,
  className,
}: DiscoveryPageHeaderProps) {
  return (
    <section
      className={cn(
        /* HTML `.page-head`: items-center, gap 16px, margin-bottom via parent space-y-4 */
        "flex flex-wrap items-center justify-between gap-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <DiscoveryPageIconBadge identity={identity} />
        <div className="min-w-0">
          <h2 className="text-[18px] font-extrabold tracking-[-0.3px] text-[var(--text)] dark:text-foreground">
            {identity.title}
          </h2>
          <p className="mt-px text-xs text-[var(--text-3)]">{identity.description}</p>
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </section>
  );
}

/** Spreadsheet accent for import upload sections */
export const DISCOVERY_IMPORT_UPLOAD_IDENTITY: Pick<
  DiscoveryPageIdentity,
  "icon" | "accent" | "iconClass"
> = {
  icon: FileSpreadsheetIcon,
  accent: "from-slate-400/20 via-slate-300/10 to-slate-500/5",
  iconClass: "text-slate-600 dark:text-slate-400",
};

```

#### `features/discovery-import/components/discovery-sub-nav.tsx`

```tsx
import Link from "next/link";

import { cn } from "@/lib/utils";
import { DiscoveryDatabaseStatsBar } from "@/features/discovery/components/discovery-database-stats-bar";
import { getDiscoveryDatabaseStats } from "@/features/discovery/queries";

import {
  DISCOVERY_SUB_NAV_PAGES,
  type DiscoveryPageIdentity,
} from "@/features/discovery/components/discovery-page-identity";

type DiscoverySubNavProps = {
  activeHref: string;
  /** Hide creator database stats bar (e.g. on quotation workspace). */
  showDatabaseStats?: boolean;
};

function isDiscoveryTabActive(activeHref: string, page: DiscoveryPageIdentity): boolean {
  if (activeHref === page.href) return true;
  if (page.key === "intelligence" && activeHref.startsWith("/discovery/intelligence")) {
    return true;
  }
  if (page.key === "shortlists" && activeHref.startsWith("/discovery/shortlists")) {
    return true;
  }
  if (page.key === "quotations" && activeHref.startsWith("/discovery/quotations")) {
    return true;
  }
  if (page.key === "search" && activeHref.startsWith("/discovery/search")) {
    return true;
  }
  if (page.key === "import" && activeHref.startsWith("/discovery/import")) {
    return true;
  }
  if (
    page.key === "campaign-match" &&
    activeHref.startsWith("/discovery/campaign-match")
  ) {
    return true;
  }
  return false;
}

/**
 * Discovery tab bar + optional stats — matches thinkway-client-quotations.html
 * `.d-subnav` / `.d-tabs` / `.d-tab`.
 */
export async function DiscoverySubNav({
  activeHref,
  showDatabaseStats = true,
}: DiscoverySubNavProps) {
  let stats: Awaited<ReturnType<typeof getDiscoveryDatabaseStats>> | null = null;
  let statsError: string | null = null;

  if (showDatabaseStats) {
    try {
      stats = await getDiscoveryDatabaseStats();
    } catch (error) {
      statsError =
        error instanceof Error ? error.message : "Failed to load creator database stats.";
    }
  }

  return (
    <div className="shrink-0 border-b border-[var(--tw-border)] bg-background px-4 pt-3 dark:bg-background">
      <nav
        aria-label="Discovery"
        className="flex flex-wrap items-center gap-1 pb-3"
      >
        {DISCOVERY_SUB_NAV_PAGES.map((page) => {
          const isActive = isDiscoveryTabActive(activeHref, page);
          const Icon = page.icon;
          return (
            <Link
              key={page.href}
              href={page.href}
              className={cn(
                "inline-flex items-center gap-[7px] rounded-[20px] px-[13px] py-[7px] text-[12.5px] font-bold transition-colors",
                isActive
                  ? "bg-[var(--blue-light)] text-[var(--blue-text)] dark:bg-blue-950/40 dark:text-blue-300"
                  : "text-[var(--text-2)] hover:bg-[var(--surface)] dark:text-muted-foreground dark:hover:bg-muted/60 dark:hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span>{page.navLabel}</span>
            </Link>
          );
        })}
      </nav>
      {showDatabaseStats ? (
        <DiscoveryDatabaseStatsBar stats={stats} errorMessage={statsError} />
      ) : null}
    </div>
  );
}

```

#### `features/discovery/components/discovery-database-stats-bar.tsx`

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { UsersIcon } from "lucide-react";

import type { DiscoveryDatabaseStats } from "@/lib/discovery/database-stats";
import { buildCreatorSearchHref } from "@/lib/creators/category-filter";
import { cn } from "@/lib/utils";

import { DiscoveryDatabaseStatsChips } from "./discovery-database-stats-chips";

type DiscoveryDatabaseStatsBarProps = {
  stats: DiscoveryDatabaseStats | null;
  errorMessage?: string | null;
  className?: string;
  /**
   * embedded — inside DiscoverySubNav (border-top only; parent owns chrome)
   * standalone — legacy /discovery page (own border + background)
   */
  variant?: "embedded" | "standalone";
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

/**
 * Stats + category chips row — matches HTML `.d-stats-row` / `.d-stat` / `.d-cats`.
 */
export function DiscoveryDatabaseStatsBar({
  stats,
  errorMessage,
  className,
  variant = "embedded",
}: DiscoveryDatabaseStatsBarProps) {
  const chrome =
    variant === "standalone"
      ? "shrink-0 border-b border-[var(--tw-border)] bg-background px-4 py-2.5"
      : "border-t border-[var(--tw-border)] py-2.5";

  if (errorMessage) {
    return (
      <section
        aria-label="Creator database stats"
        className={cn(chrome, "text-xs text-destructive", className)}
      >
        {errorMessage}
      </section>
    );
  }

  if (!stats) {
    return (
      <section
        aria-label="Creator database stats"
        className={cn(chrome, className)}
      >
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="inline-flex h-6 w-28 animate-pulse rounded-full bg-muted" />
          <span className="inline-flex h-5 w-40 animate-pulse rounded-full bg-muted/70" />
          <span className="inline-flex h-5 w-32 animate-pulse rounded-full bg-muted/70" />
        </div>
      </section>
    );
  }

  const visibleCategories = stats.topCategories.filter(
    (item) => item.label !== "Uncategorized"
  );
  const uncategorized = stats.topCategories.find((item) => item.label === "Uncategorized");

  return (
    <section
      aria-label="Creator database stats"
      className={cn(chrome, className)}
    >
      <div className="flex flex-wrap items-center gap-3.5">
        <Link
          href={buildCreatorSearchHref()}
          className="flex min-w-0 items-center gap-[7px] rounded-md transition-colors hover:opacity-80"
        >
          <UsersIcon
            className="size-[15px] shrink-0 text-[var(--green)]"
            aria-hidden
          />
          <p className="text-[12.5px] font-bold text-[var(--text)] dark:text-foreground">
            <span className="tabular-nums">
              {formatCount(stats.totalCreators)}
            </span>{" "}
            {stats.totalCreators === 1 ? "creator" : "creators"} in your database
          </p>
        </Link>

        <Suspense
          fallback={
            <div className="ml-1.5 flex min-w-0 flex-wrap items-center gap-2">
              <span className="inline-flex h-5 w-24 animate-pulse rounded-full bg-muted/70" />
              <span className="inline-flex h-5 w-32 animate-pulse rounded-full bg-muted/70" />
            </div>
          }
        >
          <DiscoveryDatabaseStatsChips
            categories={visibleCategories}
            uncategorized={uncategorized}
          />
        </Suspense>
      </div>
    </section>
  );
}

```

#### `features/discovery/components/discovery-database-stats-chips.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { DiscoveryCategoryStat } from "@/lib/discovery/database-stats";
import {
  CREATOR_CATEGORY_UNCATEGORIZED,
  applyCategoriesToUrlParams,
  buildCreatorSearchHref,
  categoriesFromUrlParams,
  categoryFilterLabel,
  removeCategoryFromList,
  toggleCategoryInList,
} from "@/lib/creators/category-filter";
import { cn } from "@/lib/utils";

type DiscoveryDatabaseStatsChipsProps = {
  categories: DiscoveryCategoryStat[];
  uncategorized: DiscoveryCategoryStat | undefined;
};

const SEARCH_PATH = "/discovery/search";

function formatCount(value: number): string {
  return value.toLocaleString();
}

function isCategoryActive(activeCategories: string[], categoryValue: string): boolean {
  return activeCategories.includes(categoryValue);
}

function CategoryChip({
  active,
  onClick,
  href,
  children,
  className,
}: {
  active: boolean;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const chipClass = cn(
    "inline-flex items-center gap-[5px] rounded-[20px] border px-[11px] py-1 text-[11.5px] font-semibold transition-colors",
    active
      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
      : "border-[var(--tw-border)] bg-[var(--surface)] text-[var(--text-2)] hover:bg-muted/80",
    className
  );

  if (href) {
    return (
      <Link href={href} className={chipClass} aria-current={active ? "page" : undefined}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={chipClass} aria-pressed={active}>
      {children}
    </button>
  );
}

/**
 * Category chips — matches HTML `.d-cats` / `.d-cat-chip` (inline with creators stat).
 */
export function DiscoveryDatabaseStatsChips({
  categories,
  uncategorized,
}: DiscoveryDatabaseStatsChipsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategories = categoriesFromUrlParams(searchParams);
  const isSearchPage = pathname === SEARCH_PATH;
  const isUnfilteredSearch = isSearchPage && activeCategories.length === 0;

  const replaceCategories = (nextCategories: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    applyCategoriesToUrlParams(params, nextCategories);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl, { scroll: false });
  };

  const handleToggleCategory = (category: string) => {
    replaceCategories(toggleCategoryInList(activeCategories, category));
  };

  const handleRemoveCategory = (category: string) => {
    replaceCategories(removeCategoryFromList(activeCategories, category));
  };

  const handleClearCategories = () => {
    replaceCategories([]);
  };

  if (categories.length === 0 && !uncategorized) {
    return <p className="text-[11px] text-muted-foreground">No category tags yet</p>;
  }

  return (
    <>
      <div className="ml-1.5 flex min-w-0 flex-wrap items-center gap-2">
        <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-3)]">
          By category
        </span>
        <CategoryChip
          active={isUnfilteredSearch}
          href={isSearchPage ? undefined : buildCreatorSearchHref()}
          onClick={isSearchPage ? handleClearCategories : undefined}
        >
          All
        </CategoryChip>
        {categories.map((item) => {
          const active = isCategoryActive(activeCategories, item.label);
          return (
            <CategoryChip
              key={item.label}
              active={active}
              href={isSearchPage ? undefined : buildCreatorSearchHref(item.label)}
              onClick={isSearchPage ? () => handleToggleCategory(item.label) : undefined}
            >
              <span>{item.label}</span>
              <b className={cn("font-bold", active ? "text-white" : "text-[var(--text)]")}>
                {formatCount(item.count)}
              </b>
            </CategoryChip>
          );
        })}
        {uncategorized ? (
          <CategoryChip
            active={isCategoryActive(activeCategories, CREATOR_CATEGORY_UNCATEGORIZED)}
            href={
              isSearchPage ? undefined : buildCreatorSearchHref(CREATOR_CATEGORY_UNCATEGORIZED)
            }
            onClick={
              isSearchPage
                ? () => handleToggleCategory(CREATOR_CATEGORY_UNCATEGORIZED)
                : undefined
            }
            className={
              isCategoryActive(activeCategories, CREATOR_CATEGORY_UNCATEGORIZED)
                ? undefined
                : "border-dashed"
            }
          >
            <span>Uncategorized</span>
            <b
              className={cn(
                "font-bold",
                isCategoryActive(activeCategories, CREATOR_CATEGORY_UNCATEGORIZED)
                  ? "text-white"
                  : "text-[var(--text)]"
              )}
            >
              {formatCount(uncategorized.count)}
            </b>
          </CategoryChip>
        ) : null}
      </div>

      {isSearchPage && activeCategories.length > 0 ? (
        <div className="flex basis-full min-w-0 flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-3)]">
            Active
          </span>
          {activeCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => handleRemoveCategory(category)}
              className={cn(
                "group inline-flex items-center gap-1 rounded-[20px] border border-[var(--tw-border)] bg-[var(--surface)] py-0.5 pr-1 pl-[11px]",
                "text-[11.5px] font-semibold text-[var(--text-2)] transition-colors hover:bg-muted"
              )}
            >
              <span className="max-w-[160px] truncate">{categoryFilterLabel(category)}</span>
              <XIcon className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

```
### 2.4 Portal shell

#### `components/layout/portal-shell.tsx`

```tsx
import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { PortalMobileNav } from "@/components/layout/portal-mobile-nav";
import { PortalNav, type PortalNavItem } from "@/components/layout/portal-nav";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

type PortalShellProps = {
  title: string;
  description?: string;
  userLabel?: string | null;
  navItems: PortalNavItem[];
  children: React.ReactNode;
};

export function PortalShell({
  title,
  description,
  userLabel,
  navItems,
  children,
}: PortalShellProps) {
  return (
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 p-4 md:block">
        <div className="mb-6">
          <ThinkwayLogo className="mb-0" />
          <p className="mt-2 text-xs text-muted-foreground">{userLabel ?? "Portal user"}</p>
        </div>
        <PortalNav items={navItems} />
        <div className="mt-8">
          <SignOutButton />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-b border-border px-4 py-4 md:px-8">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </header>
        <PortalMobileNav items={navItems} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

```

#### `components/layout/portal-nav.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type PortalNavItem = {
  href: string;
  label: string;
  badge?: number;
};

export function PortalNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active =
          item.href === "/creator-portal" || item.href === "/client-portal"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground/80 hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  active ? "bg-white/20" : "bg-primary/10 text-primary"
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

```

#### `components/layout/portal-mobile-nav.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { PortalNavItem } from "@/components/layout/portal-nav";

export function PortalMobileNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
      {items.map((item) => {
        const active =
          item.href === "/creator-portal" || item.href === "/client-portal"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {item.label}
            {item.badge && item.badge > 0 ? ` (${item.badge})` : ""}
          </Link>
        );
      })}
    </nav>
  );
}

```
### 2.5 Platform V6 section / page wrappers

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
### 2.6 Feature shells used on multiple routes (not app chrome)

#### `features/finance/adjustments/components/adjustment-module-shell.tsx`

```tsx
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { AdjustmentRegisterSection } from "@/features/finance/adjustments/components/adjustment-register-section";
import { ClientCreditNoteWorkspace } from "@/features/finance/adjustments/components/client-credit-note-workspace";
import { getAdjustmentRegister, searchInvoicesForAdjustment } from "@/features/finance/adjustments/queries";
import type { AdjustmentModuleKey } from "@/lib/finance/status/document-kind";
import { ADJUSTMENT_MODULE_CONFIG } from "@/lib/finance/status/document-kind";

type AdjustmentModuleShellProps = {
  moduleKey: AdjustmentModuleKey;
};

export async function AdjustmentModuleShell({ moduleKey }: AdjustmentModuleShellProps) {
  const config = ADJUSTMENT_MODULE_CONFIG[moduleKey];
  const [rows, invoices] = await Promise.all([
    getAdjustmentRegister(moduleKey),
    moduleKey === "client_credit" ? searchInvoicesForAdjustment() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      {moduleKey === "client_credit" ? (
        <OperationalTableSection
          title="New client credit note"
          description="Search an invoice, then issue a draft CN. Posted CNs lock invoice cancellation until resolved."
        >
          <ClientCreditNoteWorkspace invoices={invoices} />
        </OperationalTableSection>
      ) : (
        <div className="rounded-3xl border border-dashed p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{config.title} workspace</p>
          <p className="mt-1">
            Register and schema are live. Source search workflow for {config.sourceLabel} follows
            the same pattern as client credit notes — connect {config.party} documents in the
            next sprint.
          </p>
        </div>
      )}

      <AdjustmentRegisterSection
        moduleKey={moduleKey}
        rows={rows}
        description={`${rows.length} document${rows.length === 1 ? "" : "s"} — historical serials retained (no deletes).`}
      />
    </div>
  );
}

```

Other feature shells (single-workspace, listed for completeness — not embedded):

- `features/campaign-decision-workspace/components/campaign-intelligence-shell.tsx`
- `features/campaigns/components/campaign-workspace-scroll-shell.tsx`
- `features/campaigns/components/tabs/assignments-invoice-shell.tsx`

---

## 3. Design tokens / theme (source of truth)

### Theme architecture

| Layer | File | Role |
|---|---|---|
| Canonical brand tokens | `app/thinkway-design-tokens.css` | Spec colors, lavender, radius 8/10/16, `--tw-*` aliases |
| App theme + shell CSS | `app/globals.css` | Tailwind v4 `@theme`, shadcn variables, sidebar rail, campaign workspace, login |
| Platform V6 list chrome | `app/thinkway-platform-v6.css` | `.thinkway-platform-v6` page/section/badge styles |
| Tailwind wiring | `postcss.config.mjs` + `@import "tailwindcss"` | **No** `tailwind.config.*` (Tailwind v4 CSS-first) |
| shadcn config | `components.json` | Points CSS at `app/globals.css` |

**Important tension for reviewers:** `thinkway-design-tokens.css` sets brand primary blue `#0057ff` and radius `8px`, while `globals.css` `:root` also defines marketing gradients (`#33b6fc` / `#a038fb` / `#ff89d3`), product accent `#1d9e75`, and shadcn `--radius: 0.75rem`. Discovery HTML-matched UI prefers `--tw-radius` / token names; shadcn components use the globals radius scale.

### 3.1 Full: `app/thinkway-design-tokens.css`

#### `app/thinkway-design-tokens.css`

```css
/* ═══════════════════════════════════════════════════════
   THINKWAY DESIGN TOKENS — v1.0 (canonical)
   Source: Thinkway_Brand_Kit.pdf v1.0 + THINKWAY_DESIGN_SPEC.md
   Imported globally via app/globals.css.
   Ref modules alias these names inside scoped roots (.outputs-center-ref, etc.).
   ═══════════════════════════════════════════════════════ */

:root {
  /* ---- Brand ---- */
  --navy: #060810;
  --ink: #0b0f1a;
  --muted: #6b7280;
  --lavender: #e8effe;

  --blue: #0057ff;
  --blue-hover: #0048dd;
  --blue-400: #1a6fff;
  --blue-300: #3d8bff;
  --blue-light: #eef3ff;
  --blue-text: #0048dd;

  --brand-gradient: linear-gradient(145deg, #0040cc, #0057ff, #1a6fff, #0048dd);

  /* ---- Semantic status (not brand) ---- */
  --green: #10b981;
  --green-bg: #ecfdf5;
  --green-text: #065f46;

  --amber: #f59e0b;
  --amber-bg: #fffbeb;
  --amber-text: #92400e;

  --red: #ef4444;
  --red-bg: #fef2f2;
  --red-text: #991b1b;

  --purple: #a855f7;
  --purple-bg: #faf5ff;
  --purple-text: #6b21a8;

  /* ---- Neutral scale ---- */
  --text: var(--ink);
  --text-2: #3f4757;
  --text-3: #6b7280;

  --border: #e3e8f2;
  --surface: #f3f6fc;
  --white: #ffffff;

  /* ---- Shape (HTML mock: 8 / 10 / 16). Prefer --tw-radius / --radius-lg in
     Discovery UI — globals.css overwrites --radius for shadcn (0.75rem). ---- */
  --radius: 8px;
  --radius-md: 10px;
  --radius-lg: 16px;

  /* ---- Motion ---- */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  /*
   * Shadcn-safe aliases — globals.css keeps --muted, --border, --radius, and
   * --brand-gradient for the legacy platform shell. Product UI ref modules
   * should prefer these names when they need official spec values.
   */
  --tw-muted-text: #6b7280;
  --tw-border: #e3e8f2;
  --tw-radius: 8px;
  --tw-brand-gradient: linear-gradient(145deg, #0040cc, #0057ff, #1a6fff, #0048dd);
}

.mono,
.font-mono {
  font-family: var(--font-geist-mono), "Geist Mono", ui-monospace, "SF Mono", Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

```
### 3.2 Theme variables + shell chrome from `app/globals.css`

Full file is **~108KB / ~4400 lines** (includes large campaign-workspace component CSS). Embedded below: imports, `@theme`, light/dark `:root`, base, brand utilities, shell/sidebar chrome, and the start of campaign workspace tokens. **Complete file:** [`frontend-design-review-package/globals.css`](./frontend-design-review-package/globals.css).

#### `app/globals.css` (lines 1–390)

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "./thinkway-design-tokens.css";
@import "./thinkway-platform-v6.css" layer(components);

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-muted-foreground: var(--sidebar-muted-foreground);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-input-background: var(--input-background);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
  --color-brand-blue: var(--brand-blue);
  --color-brand-purple: var(--brand-purple);
  --color-brand-pink: var(--brand-pink);
  --color-brand-navy: var(--brand-navy);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-brand-product: var(--brand-product);
  --color-surface-elevated: var(--surface-elevated);
  --color-surface-subtle: var(--surface-subtle);
  --shadow-card: var(--card-shadow);
  --shadow-card-hover: var(--card-shadow-hover);
}

:root {
  color-scheme: light;
  /* Thinkway brand palette (HTML design system) */
  --brand-navy: #020925;
  --brand-blue: #33b6fc;
  --brand-purple: #a038fb;
  --brand-pink: #ff89d3;
  --brand-gradient: linear-gradient(135deg, #33b6fc 0%, #a038fb 50%, #ff89d3 100%);
  --brand-gradient-2: linear-gradient(135deg, #a038fb 0%, #ff89d3 100%);
  --brand-gradient-3: linear-gradient(135deg, #33b6fc 0%, #a038fb 100%);
  --success: #10b981;
  --warning: #f59e0b;
  /* Thinkway product accent (ops / finance emphasis) */
  --brand-product: #1d9e75;

  /* Login v2 palette — CTAs, links, focus rings */
  --login-navy: #060810;
  --login-blue: #0057ff;
  --login-blue-hover: #0048dd;
  --login-muted: #8899bb;
  --login-border: #eef2f8;
  --login-surface-subtle: #fafbfd;
  --login-page-bg: #e8effe;
  --primary-shadow: 0 4px 14px rgba(0, 87, 255, 0.28);
  --primary-shadow-hover: 0 6px 20px rgba(0, 87, 255, 0.35);

  /* Platform surface system — Stripe / Linear / Vercel tier */
  --page-bg: #fafbfc;
  --surface-elevated: #ffffff;
  --surface-subtle: #f6f8fb;
  --card-shadow:
    0 1px 2px rgba(6, 8, 16, 0.04),
    0 2px 8px rgba(6, 8, 16, 0.05);
  --card-shadow-hover:
    0 2px 4px rgba(6, 8, 16, 0.05),
    0 8px 24px rgba(6, 8, 16, 0.08);

  --background: var(--page-bg);
  --foreground: var(--login-navy);
  --card: var(--surface-elevated);
  --card-foreground: var(--login-navy);
  --popover: var(--surface-elevated);
  --popover-foreground: var(--login-navy);
  --primary: var(--login-blue);
  --primary-foreground: #ffffff;
  --primary-hover: var(--login-blue-hover);
  --secondary: var(--surface-subtle);
  --secondary-foreground: var(--login-navy);
  --muted: var(--surface-subtle);
  --muted-foreground: #64748b;
  --accent: #f1f5f9;
  --accent-foreground: var(--login-navy);
  --destructive: #ef4444;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --input-background: #ffffff;
  --ring: var(--login-blue);
  --chart-1: var(--login-blue);
  --chart-2: #a038fb;
  --chart-3: #ff89d3;
  --chart-4: #10b981;
  --chart-5: #f59e0b;
  --radius: 0.75rem;
  /* Sidebar — floating card rail on #fafbfc page, #0057ff accent */
  --sidebar: var(--surface-elevated);
  --sidebar-foreground: var(--login-navy);
  --sidebar-primary: var(--login-blue);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: var(--accent);
  --sidebar-accent-foreground: var(--login-navy);
  --sidebar-border: var(--border);
  --sidebar-ring: var(--login-blue);
  --sidebar-muted-foreground: var(--muted-foreground);
  --sidebar-active-bg: rgba(0, 87, 255, 0.06);
  /* Thinkway_Client_Form final.html — floating rail tokens */
  --sidebar-rail-line: #e6eaf2;
  --sidebar-rail-line-2: #d7deea;
  --sidebar-rail-item-fg: #3a4254;
  --sidebar-rail-hover-bg: #f5f8fd;
  --sidebar-rail-badge-bg: #ecf1f9;
  --sidebar-rail-grad: linear-gradient(135deg, #0057ff 0%, #2e74ff 55%, #1a6fff 100%);
  --sidebar-rail-active-shadow: 0 6px 16px rgba(0, 87, 255, 0.28);
  --sidebar-rail-float-shadow:
    0 1px 2px rgba(11, 15, 26, 0.04),
    0 12px 32px rgba(20, 40, 110, 0.1),
    0 2px 8px rgba(20, 40, 110, 0.05);
  /* Collapsed rail default — updated when sidebar expands (CollapsibleAppSidebar). */
  --app-sidebar-width: 3.5rem;
  /* Reserve scroll space above OperationalFloatingActionBar (bar + bottom gap). */
  --floating-action-bar-offset: 7.5rem;
  --floating-action-bar-offset-mobile: calc(7.5rem + env(safe-area-inset-bottom, 0px));
}

.dark {
  color-scheme: dark;

  /* Platform surface system — Stripe / Linear / Vercel dark tier */
  --page-bg: #0a0a0f;
  --surface-elevated: #18181b;
  --surface-subtle: #141419;
  --card-shadow: none;
  --card-shadow-hover: 0 0 0 1px rgba(255, 255, 255, 0.06);
  --primary-shadow: 0 4px 14px rgba(0, 87, 255, 0.32);
  --primary-shadow-hover: 0 6px 20px rgba(0, 87, 255, 0.4);

  --background: var(--page-bg);
  --foreground: #fafafa;
  --card: var(--surface-elevated);
  --card-foreground: #fafafa;
  --popover: var(--surface-elevated);
  --popover-foreground: #fafafa;
  --primary: #0057ff;
  --primary-foreground: #ffffff;
  --primary-hover: #0048dd;
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: var(--surface-subtle);
  --muted-foreground: #a1a1aa;
  --accent: rgba(255, 255, 255, 0.06);
  --accent-foreground: #fafafa;
  --destructive: #f87171;
  --border: rgba(255, 255, 255, 0.08);
  --input: rgba(255, 255, 255, 0.12);
  --input-background: #18181b;
  --ring: #0057ff;
  --chart-1: #0057ff;
  --chart-2: #a038fb;
  --chart-3: #ff89d3;
  --chart-4: #10b981;
  --chart-5: #f59e0b;
  /* Sidebar — slightly elevated from page */
  --sidebar: #111116;
  --sidebar-foreground: #fafafa;
  --sidebar-primary: #0057ff;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: rgba(255, 255, 255, 0.06);
  --sidebar-accent-foreground: #fafafa;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-ring: #0057ff;
  --sidebar-muted-foreground: #a1a1aa;
  --sidebar-active-bg: rgba(0, 87, 255, 0.12);
  /* Sidebar rail — dark tier (mirrors light tokens above) */
  --sidebar-rail-line: rgba(255, 255, 255, 0.08);
  --sidebar-rail-line-2: rgba(255, 255, 255, 0.14);
  --sidebar-rail-item-fg: #d4d4d8;
  --sidebar-rail-hover-bg: rgba(255, 255, 255, 0.06);
  --sidebar-rail-badge-bg: rgba(255, 255, 255, 0.08);
  --sidebar-rail-float-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    0 12px 32px rgba(0, 0, 0, 0.35),
    0 2px 8px rgba(0, 0, 0, 0.25);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}

@layer utilities {
  /* Brand gradient helpers (HTML design system) */
  .bg-brand-gradient {
    background-image: var(--brand-gradient);
  }
  .bg-brand-gradient-2 {
    background-image: var(--brand-gradient-2);
  }
  .bg-brand-gradient-3 {
    background-image: var(--brand-gradient-3);
  }
  .text-brand-gradient {
    background-image: var(--brand-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .border-brand-gradient {
    border-image: var(--brand-gradient) 1;
  }
}

@layer components {
  /*
   * Global table styling to match the Thinkway design system.
   * Applies to plain <table> markup used across operational pages
   * (the shadcn Table component sets its own header treatment).
   */
  table:not([data-slot="table"]) th {
    @apply bg-muted/60 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase;
  }

  .thinkway-shell-header {
    @apply border-b border-border bg-background/80 backdrop-blur-md;
  }

  .thinkway-workspace-chrome {
    @apply border-b border-border bg-background/90 backdrop-blur-md;
  }

  /* Sidebar logo — readable on dark elevated rail */
  .dark .login-v2-logo-text {
    color: #fafafa;
  }

  .dark .login-v2-logo-text span {
    color: #0057ff;
  }

  /* Thinkway_Client_Form final.html — sidebar rail item treatments */
  .thinkway-sidebar-grp-icon {
    @apply flex size-7 shrink-0 items-center justify-center rounded-lg;
  }
  .thinkway-sidebar-grp-icon-blue {
    background: rgba(0, 87, 255, 0.1);
    color: #0057ff;
  }
  .thinkway-sidebar-grp-icon-violet {
    background: rgba(124, 92, 255, 0.12);
    color: #7c5cff;
  }
  .thinkway-sidebar-grp-icon-teal {
    background: rgba(14, 165, 164, 0.12);
    color: #0ea5a4;
  }
  .thinkway-sidebar-grp-icon-amber {
    background: rgba(224, 144, 27, 0.14);
    color: #e0901b;
  }
  .thinkway-sidebar-grp-icon-navy {
    background: rgba(11, 15, 26, 0.07);
    color: #0b0f1a;
  }
  .dark .thinkway-sidebar-grp-icon-navy {
    background: rgba(255, 255, 255, 0.08);
    color: #d4d4d8;
  }
  .thinkway-sidebar-item-dot {
    @apply size-1.5 shrink-0 rounded-full bg-[var(--sidebar-rail-line-2)] transition-colors;
    margin-left: 0.375rem;
  }
  .thinkway-sidebar-item-active {
    background: var(--sidebar-rail-grad);
    color: #fff;
    font-weight: 600;
    box-shadow: var(--sidebar-rail-active-shadow);
  }
  .thinkway-sidebar-item-active .thinkway-sidebar-item-dot {
    background: #fff;
  }
  .thinkway-sidebar-item-active:hover {
    background: var(--sidebar-rail-grad);
    color: #fff;
  }

}

@media (max-width: 767px) {
  :root {
    --app-sidebar-width: 0px;
  }
}

/* thinkway-campaign_2.html — campaign workspace design system */
@layer components {
  .thinkway-campaign-workspace {
    --camp-text: #0f172a;
    --camp-text-2: #475569;
    --camp-text-3: #94a3b8;
    --camp-border: #e2e8f0;
    --camp-surface: #f8fafc;
    --camp-white: #ffffff;
    --camp-blue: #2563eb;
    --camp-blue-hover: #1d4ed8;
    --camp-blue-light: #eff6ff;
    --camp-blue-text: #1d4ed8;
    --camp-green: #10b981;
    --camp-green-bg: #ecfdf5;
    --camp-green-text: #065f46;
    --camp-amber: #f59e0b;
    --camp-amber-bg: #fffbeb;
    --camp-amber-text: #92400e;
    --camp-red: #ef4444;
    --camp-red-bg: #fef2f2;
    --camp-red-text: #991b1b;
    --camp-purple: #a855f7;
    --camp-purple-bg: #faf5ff;
    --camp-purple-text: #6b21a8;
    --camp-hover: #f8fafc;
    --camp-row-open: #fafbff;
    --camp-row-open-hover: #f0f4ff;
    --camp-child-hdr: #f4f6fb;
    --camp-child-accent: #c7d6fa;
    --camp-scrollbar: #cbd5e1;
    --camp-progress-track: #e2e8f0;
    --camp-danger-border: #fecaca;
    --camp-danger-hover: #fee2e2;
    --camp-po-border: #fde68a;
    --camp-po-val: #78350f;
    --camp-tab-badge-active-border: #bfdbfe;
    --camp-plat-ig-bg: #fce7f3;
    --camp-plat-ig-text: #9d174d;
    --camp-plat-tt-bg: #f1f5f9;
    --camp-plat-tt-text: #1e293b;
    --camp-er-hi-bg: #dcfce7;
    --camp-er-hi-text: #166534;
    --camp-on-primary: #ffffff;
    --camp-radius: 6px;
    --camp-radius-lg: 12px;
    --camp-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    font-size: 13px;
    line-height: 1.5;
    color: var(--camp-text);
    background: var(--camp-surface);
  }

  .dark .thinkway-campaign-workspace {
    --camp-text: var(--foreground);
    --camp-text-2: #a1a1aa;
    --camp-text-3: #71717a;
```
### 3.3 Platform V6 CSS

Full file (~65KB) is in the companion folder — too large to embed here without drowning the shell sources:

- [`frontend-design-review-package/thinkway-platform-v6.css`](./frontend-design-review-package/thinkway-platform-v6.css)

Scoped under `.thinkway-platform-v6` (activated by `DashboardShell` `platformV6` and `PlatformV6Page`).

### 3.4 Tailwind / PostCSS / shadcn config

#### `postcss.config.mjs`

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;

```

#### `components.json`

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-luma",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "menuColor": "default",
  "menuAccent": "subtle",
  "registries": {}
}

```

No `tailwind.config.ts` / `tailwind.config.js` exists — theme extension is entirely via `@theme inline` in `globals.css`.

### 3.5 Other theme / ref CSS (paths only)

| Path | Used by |
|---|---|
| `features/campaign-studio/styles/campaign-studio-ref.css` | Campaign Studio (also copied to companion folder) |
| `features/campaign-outputs/styles/outputs-center-ref.css` | Campaign outputs |
| `features/ai-workspace/components/ai-workspace.css` | AI workspace |
| `features/ai-workspace/styles/copilot-ref.css` | Copilot |
| `features/ai-workspace/styles/studio-chat-ref.css` | Studio chat |

---

## 4. Component inventory — repeated UI patterns

### 4.1 Embedded representatives (full source)

#### Data table / operational table chrome

#### `components/tables/operational-table-chrome.tsx`

```tsx
"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  ArrowDownUpIcon,
  Columns3Icon,
  ListFilterIcon,
  SearchIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const operationalTableChrome = {
  toolbarButton: cn(
    "group/table-tool relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2",
    "text-xs font-medium text-muted-foreground",
    "transition-colors duration-150",
    "hover:bg-muted/40 hover:text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-product)]/25"
  ),
  toolbarButtonActive: "text-[var(--brand-product)] hover:text-[var(--brand-product)]",
  selectTrigger: cn(
    "h-8 w-fit gap-1.5 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none",
    "transition-colors duration-150",
    "hover:bg-muted/40 hover:text-foreground",
    "focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-product)]/25",
    "data-[state=open]:bg-muted/40 data-[state=open]:text-foreground"
  ),
  searchInput: cn(
    "h-8 rounded-lg border-0 bg-transparent pl-9 pr-9 text-xs shadow-none",
    "focus-visible:border-transparent focus-visible:ring-0"
  ),
  /** Discovery list toolbar — HTML `.search-box input` (36px, bordered). */
  searchInputBoxed: cn(
    "h-9 w-full rounded-[var(--tw-radius)] border border-[var(--tw-border)] bg-background pl-[34px] pr-9 text-[12.5px] shadow-none",
    "focus-visible:border-[var(--blue)] focus-visible:ring-0"
  ),
  panelShell: "rounded-2xl border border-border/55 bg-popover shadow-xl",
} as const;

type OperationalTableToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
};

export function OperationalTableToolbarButton({
  icon: Icon,
  label,
  active = false,
  className,
  ...props
}: OperationalTableToolbarButtonProps) {
  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      className={cn(
        operationalTableChrome.toolbarButton,
        active && operationalTableChrome.toolbarButtonActive,
        className
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span>{label}</span>
    </button>
  );
}

export function OperationalTableActionCluster({ children }: { children: ReactNode }) {
  return <div className="inline-flex shrink-0 flex-wrap items-center gap-0.5">{children}</div>;
}

type OperationalTableSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  isPending?: boolean;
  /** ghost = transparent toolbar chrome; boxed = Discovery list search. */
  variant?: "ghost" | "boxed";
  className?: string;
};

export function OperationalTableSearchField({
  value,
  onChange,
  onClear,
  placeholder,
  isPending = false,
  variant = "ghost",
  className,
}: OperationalTableSearchFieldProps) {
  const boxed = variant === "boxed";

  return (
    <div
      className={cn(
        "relative w-full min-w-[12rem]",
        boxed ? "max-w-none" : "max-w-sm",
        className
      )}
    >
      <SearchIcon
        className={cn(
          "pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2",
          boxed ? "text-[var(--text-3)]" : "text-muted-foreground"
        )}
        strokeWidth={2}
        aria-hidden
      />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={
          boxed
            ? operationalTableChrome.searchInputBoxed
            : operationalTableChrome.searchInput
        }
        aria-busy={isPending}
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          aria-label="Clear search"
        >
          <XIcon className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

export const OperationalTableIcons = {
  filter: ListFilterIcon,
  sort: ArrowDownUpIcon,
  settings: Columns3Icon,
} as const;

```

#### `components/ui/operational-table-section.tsx`

```tsx
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OperationalTableSectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Wide borderless layout for dense operational grids */
  wide?: boolean;
  /** Tighter section header */
  compact?: boolean;
  /** Table fills the frame; title/actions must be rendered outside */
  tableOnly?: boolean;
  /** White rounded card on page background (campaign workspace) */
  cardSurface?: boolean;
  /** Toolbar row inside the card (above table) */
  leading?: ReactNode;
  /** Filters / secondary controls between header and table */
  toolbar?: ReactNode;
  /** Sticky footer row inside the card (assignments: AI Match + Shortlist). */
  footer?: ReactNode;
  /** Assignments tab shell — asgn-wrap / asgn-head-bar / asgn-scroll layout. */
  assignmentsShell?: boolean;
};

/** Card header + flush table (single clean border like campaign assignments). */
export function OperationalTableSection({
  title,
  description,
  actions,
  children,
  className,
  wide = false,
  compact = false,
  tableOnly = false,
  cardSurface = false,
  leading,
  toolbar,
  footer,
  assignmentsShell = false,
}: OperationalTableSectionProps) {
  const showHeader = !tableOnly && Boolean(title || description || actions);
  const useReferenceSectionCard = cardSurface && tableOnly;
  const useAssignmentsShell = assignmentsShell && tableOnly;

  const sectionHead = leading ? (
    <div
      className={cn(
        cardSurface &&
          (useAssignmentsShell
            ? "thinkway-campaign-asgn-head-bar"
            : "thinkway-campaign-section-head")
      )}
    >
      {leading}
    </div>
  ) : null;

  const sectionToolbar = toolbar ? (
    <div
      className={cn(
        "border-b border-[var(--camp-border)]",
        cardSurface ? "thinkway-campaign-filter-panel border-b" : "border-border/40 px-4 md:px-5",
        !cardSurface && (compact ? "py-1.5" : "py-3")
      )}
    >
      {toolbar}
    </div>
  ) : null;

  const legacyHeader =
    showHeader && !leading ? (
      <CardHeader
        className={cn(
          "flex flex-row flex-wrap items-center justify-between gap-2",
          compact && cardSurface ? "gap-2 px-4 py-2.5 md:px-5" : compact ? "px-0 py-2" : "gap-3 px-4 py-3",
          wide ? "border-b border-border/25" : "border-b border-border",
          !wide && !compact && "px-4"
        )}
      >
        <div className={cn(compact ? "min-w-0" : "space-y-0.5")}>
          <CardTitle
            className={cn(compact ? "text-sm font-semibold" : "text-base font-semibold")}
          >
            {title}
          </CardTitle>
          {description ? (
            <p
              className={cn(
                "text-muted-foreground",
                compact && cardSurface ? "text-[11px] leading-snug" : "text-sm"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </CardHeader>
    ) : null;

  const tableBody = tableOnly ? (
    <div
      className={cn(
        useAssignmentsShell
          ? "thinkway-campaign-asgn-scroll"
          : "thinkway-campaign-table-scroll"
      )}
    >
      {children}
    </div>
  ) : (
    children
  );

  if (useAssignmentsShell) {
    return (
      <div className={cn("thinkway-campaign-asgn-wrap", className)}>
        {sectionHead}
        {sectionToolbar}
        {legacyHeader}
        {tableBody}
        {footer}
      </div>
    );
  }

  if (useReferenceSectionCard) {
    return (
      <div className={cn("thinkway-campaign-section-card", className)}>
        {sectionHead}
        {sectionToolbar}
        {legacyHeader}
        {tableBody}
        {footer}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden",
        cardSurface
          ? "thinkway-campaign-section-card rounded-[var(--camp-radius-lg)] border-[var(--camp-border)] bg-[var(--camp-white)] shadow-none"
          : wide || tableOnly
            ? "border-0 bg-background shadow-none"
            : "bg-background shadow-sm ring-1 ring-border/70",
        tableOnly && !cardSurface && "rounded-none",
        className
      )}
    >
      {sectionHead}
      {sectionToolbar}
      {legacyHeader}
      <CardContent className="p-0 [&_[data-slot=table-container]]:rounded-none [&_[data-slot=table-container]]:border-0 [&_[data-slot=table-container]]:shadow-none">
        {tableBody}
      </CardContent>
    </Card>
  );
}

```
#### Badge / status pill (quotations list)

#### `features/quotations/components/quotation-list-status-pill.tsx`

```tsx
import { cn } from "@/lib/utils";
import type { QuotationStatus } from "@/types/database";

import { QUOTATION_STATUS_LABELS } from "../constants";

/** List-surface status pills — matches HTML `.status-pill`. */
const LIST_STATUS_PILL_CLASS: Partial<Record<QuotationStatus, string>> = {
  draft:
    "border border-[var(--tw-border)] bg-[var(--surface)] text-[var(--text-2)]",
  under_review: "bg-[var(--amber-bg)] text-[var(--amber-text)]",
  sent: "bg-[var(--blue-light)] text-[var(--blue-text)]",
  approved: "bg-[var(--green-bg)] text-[var(--green-text)]",
  archived: "bg-[var(--red-bg)] text-[var(--red-text)]",
};

const LIST_STATUS_FALLBACK =
  "border border-[var(--tw-border)] bg-[var(--surface)] text-[var(--text-2)]";

export function QuotationListStatusPill({
  status,
  className,
}: {
  status: QuotationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-[20px] px-[11px] py-[3px] text-[10.5px] font-bold leading-none",
        LIST_STATUS_PILL_CLASS[status] ?? LIST_STATUS_FALLBACK,
        className
      )}
    >
      {QUOTATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

```
#### Button (shadcn)

#### `components/ui/button.tsx`

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--primary-shadow)] hover:bg-[var(--primary-hover)] hover:shadow-[var(--primary-shadow-hover)] hover:-translate-y-px active:translate-y-0 dark:hover:translate-y-0 dark:hover:shadow-[var(--primary-shadow-hover)]",
        outline:
          "border-border bg-card hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-transparent dark:hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-10 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

```
#### Discovery category chips
Already embedded in §2.3 as `discovery-database-stats-chips.tsx` (shared CategoryChip pattern).

### 4.2 Other repeated patterns (paths — not fully embedded)

| Pattern | Primary path(s) |
|---|---|
| Operational data table | `components/tables/operational-data-table.tsx` |
| Configurable operational table | `components/tables/operational-configurable-table.tsx` |
| Table toolbar / filters / sort | `components/tables/operational-table-toolbar.tsx`, `operational-table-filter-sheet.tsx`, `operational-table-sort-popover.tsx` |
| Quotation status badge (workspace) | `features/quotations/components/quotation-status-badge.tsx` |
| Quotation lifecycle pills | `features/quotations/components/quotation-lifecycle-pills.tsx` |
| Platform V6 KPI strip | `components/platform/platform-v6-kpi-strip.tsx` |
| Platform V6 badges (class helper) | `platformV6BadgeClass` in `components/platform/platform-v6-layout.tsx` |
| shadcn Badge | `components/ui/badge.tsx` |
| Card | `components/ui/card.tsx` |
| Input / Select | `components/ui/input.tsx`, `components/ui/select.tsx` |
| Page alert | `components/ui/page-alert.tsx` |
| Thinkway logo | `components/brand/thinkway-logo.tsx` |
| Theme toggle | `components/layout/theme-toggle.tsx` |
| User account menu | `components/layout/user-account.tsx` |
| Home workspace nav tabs | `features/home/components/home-workspace-nav-tabs.tsx` |
| Page back button | `components/navigation/page-back-button.tsx` |
| Error boundary | `components/platform/error-boundary.tsx` |
| Creator search AI criteria chips | `features/discovery/components/creator-search/creator-search-ai-criteria-chips.tsx` |
| Clients / campaigns / vendors list sections | `features/clients/components/clients-list-section.tsx`, `features/campaigns/components/campaigns-list-section.tsx`, `features/vendors/components/vendors-list-section.tsx` |

---

## Companion folder contents

`docs/frontend-design-review-package/`

- `globals.css` (105 KB) — copy of `app/globals.css`
- `thinkway-platform-v6.css` (63 KB) — copy of `app/thinkway-platform-v6.css`
- `thinkway-design-tokens.css` (2 KB) — copy of `app/thinkway-design-tokens.css`
- `campaign-studio-ref.css` (39 KB) — copy of `features/campaign-studio/styles/campaign-studio-ref.css`

---

*End of package. Do not treat this file as runtime source — paths refer to the Thinkway repo at generation time.*
