"use client";

import type { CSSProperties, ReactNode } from "react";

import { CreatorAvatarImage } from "@/components/creator/creator-avatar-image";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DISCOVERY_WORKSPACE_SHEET_CLASS,
  DISCOVERY_WORKSPACE_SHEET_STYLE,
} from "@/features/discovery/components/design-system/discovery-sheet-chrome";
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

/** Discovery Creator Details chrome — used by Add publications / Edit assignment. */
export const OPERATIONAL_DETAIL_SHEET_DETAIL_STYLE: CSSProperties = {
  ...DISCOVERY_WORKSPACE_SHEET_STYLE,
};

export const OPERATIONAL_DETAIL_SHEET_DETAIL_CLASS = DISCOVERY_WORKSPACE_SHEET_CLASS;

type OperationalDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** `detail` matches Discovery Creator Details drawer chrome. */
  variant?: "operational" | "detail";
};

export function OperationalDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "operational",
}: OperationalDetailSheetProps) {
  const isDetail = variant === "detail";
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        showCloseButton
        showOverlay={false}
        style={isDetail ? OPERATIONAL_DETAIL_SHEET_DETAIL_STYLE : OPERATIONAL_DETAIL_SHEET_STYLE}
        className={isDetail ? OPERATIONAL_DETAIL_SHEET_DETAIL_CLASS : OPERATIONAL_DETAIL_SHEET_CLASS}
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
    <div className="flex items-start justify-between gap-4 border-b border-border/40 py-3 last:border-b-0 sm:gap-6">
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
      <div
        className={cn(
          "min-w-0 max-w-[65%] text-right text-sm text-foreground break-words whitespace-normal",
          valueClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** System-card chrome for operational detail drawers (VIO / Finance / etc.). */
export function DetailFieldGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card px-4 py-1 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.12)]",
        className
      )}
    >
      {title ? (
        <p className="border-b border-border/40 py-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </p>
      ) : null}
      {children}
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
  if (normalized === "under_client_review") {
    return (
      <DetailPill className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100">
        Under client review
      </DetailPill>
    );
  }
  if (normalized === "sent") {
    return (
      <DetailPill className="border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100">
        Sent
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
  if (normalized === "generated") {
    return <DetailPill>Generated</DetailPill>;
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
    <div className="shrink-0 border-b border-border bg-background/80 px-5 pb-4 pt-5 dark:bg-background">
      <div className="pr-10">
        <h2 className="text-[18px] font-extrabold tracking-[-0.3px] text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
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
