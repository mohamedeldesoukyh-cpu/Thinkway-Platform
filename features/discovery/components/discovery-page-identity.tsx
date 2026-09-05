import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRightIcon,
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
  | "compare"
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
  compare: {
    key: "compare",
    href: "/discovery/compare",
    navLabel: "Compare",
    title: "Creator Comparison",
    description: "Compare creators side by side across metrics and platforms.",
    icon: ArrowLeftRightIcon,
    accent: "from-indigo-400/25 via-indigo-300/15 to-blue-500/10",
    iconClass: "text-indigo-700 dark:text-indigo-300",
    iconSolidClass: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
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

/** Pack / shell nav active match — Search, Intelligence, Shortlists, Client Quotations, Campaign Match, Import Center. */
export function isDiscoveryNavPageActive(
  activeHref: string,
  page: DiscoveryPageIdentity
): boolean {
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
      <div className="flex min-w-0 items-center gap-[13px]">
        <DiscoveryPageIconBadge identity={identity} />
        <div className="min-w-0">
          <h2 className="text-[19px] font-extrabold tracking-[-0.028em] text-[var(--text)] dark:text-foreground">
            {identity.title}
          </h2>
          <p className="mt-[3px] text-[12.5px] tracking-[-0.005em] text-[var(--text-3)]">{identity.description}</p>
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
