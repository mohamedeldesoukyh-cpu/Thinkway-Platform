import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
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
    iconClass: "text-sky-600 dark:text-sky-400",
  },
  shortlists: {
    key: "shortlists",
    href: "/discovery/shortlists",
    navLabel: "Shortlists",
    title: "Shortlists",
    description: "Build, review, approve, and move creators into campaigns.",
    icon: ListChecksIcon,
    accent: "from-violet-400/25 via-violet-300/15 to-purple-500/10",
    iconClass: "text-violet-600 dark:text-violet-400",
  },
  quotations: {
    key: "quotations",
    href: "/discovery/quotations",
    navLabel: "Client Quotations",
    title: "Client Quotations",
    description: "Serial-numbered quotations (QT-YYYY-NNNN). Totals reported in EGP.",
    icon: FileTextIcon,
    accent: "from-amber-400/25 via-amber-300/15 to-orange-500/10",
    iconClass: "text-amber-700 dark:text-amber-400",
  },
  "campaign-match": {
    key: "campaign-match",
    href: "/discovery/campaign-match",
    navLabel: "Campaign Match",
    title: "Campaign Match",
    description: "Match discovered creators to campaign briefs with AI scoring.",
    icon: RadarIcon,
    accent: "from-rose-400/25 via-rose-300/15 to-pink-500/10",
    iconClass: "text-rose-600 dark:text-rose-400",
  },
  import: {
    key: "import",
    href: "/discovery/import",
    navLabel: "Import Center",
    title: "Discovery Import Center",
    description: "Upload creator datasets from agencies, platforms, or clients.",
    icon: UploadIcon,
    accent: "from-emerald-400/25 via-emerald-300/15 to-teal-500/10",
    iconClass: "text-emerald-700 dark:text-emerald-400",
  },
};

export const DISCOVERY_SUB_NAV_PAGES: DiscoveryPageIdentity[] = [
  DISCOVERY_PAGE_IDENTITY.search,
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
  md: "size-10 rounded-xl [&_svg]:size-5",
  lg: "size-12 rounded-xl [&_svg]:size-6",
} as const;

export function DiscoveryPageIconBadge({
  identity,
  size = "md",
  className,
}: DiscoveryPageIconBadgeProps) {
  const Icon = identity.icon;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-white/60 bg-gradient-to-br shadow-sm backdrop-blur-sm",
        "dark:border-white/10",
        identity.accent,
        BADGE_SIZE[size],
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
        "flex flex-wrap items-start justify-between gap-3",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <DiscoveryPageIconBadge identity={identity} />
        <div className="min-w-0 space-y-0.5">
          <h2 className="font-heading text-xl font-semibold tracking-tight">
            {identity.title}
          </h2>
          <p className="text-xs text-muted-foreground">{identity.description}</p>
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
