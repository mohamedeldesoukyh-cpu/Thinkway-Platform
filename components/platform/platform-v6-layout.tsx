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
