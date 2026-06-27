"use client";

import { ChevronUpIcon, LogOutIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

type UserAccountProps = {
  email?: string | null;
  name?: string | null;
  className?: string;
  compact?: boolean;
  /** Dark sidebar (default) vs light page chrome (mobile header). */
  inSidebar?: boolean;
};

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return trimmedName.slice(0, 2).toUpperCase();
  }

  if (!email) {
    return "?";
  }

  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

function getHeaderDisplayName(name: string | null | undefined, email: string | null | undefined) {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  if (email) {
    return email.split("@")[0] ?? email;
  }

  return "Account";
}

function SignOutMenuItem() {
  const { pending } = useFormStatus();

  return (
    <DropdownMenuItem asChild disabled={pending}>
      <button type="submit" className="w-full cursor-pointer">
        <LogOutIcon />
        <span>{pending ? "Signing out..." : "Sign out"}</span>
      </button>
    </DropdownMenuItem>
  );
}

export function UserAccount({
  email,
  name,
  className,
  compact = false,
  inSidebar = true,
}: UserAccountProps) {
  const isHeaderChrome = compact && !inSidebar;
  const displayEmail = email ?? "Signed in";
  const displayLabel = isHeaderChrome
    ? getHeaderDisplayName(name, email)
    : displayEmail;
  const textPrimary = inSidebar ? "text-sidebar-foreground" : "text-foreground";
  const textSecondary = inSidebar ? "text-sidebar-muted-foreground" : "text-muted-foreground";
  const labelClass = isHeaderChrome
    ? "text-muted-foreground font-normal"
    : cn("font-medium", textPrimary);
  const triggerSurface = inSidebar
    ? "rounded-xl p-2 transition-colors hover:bg-[var(--sidebar-rail-hover-bg)] active:scale-[0.99]"
    : "rounded-2xl hover:bg-muted";
  const focusRing = inSidebar
    ? "focus-visible:ring-sidebar-ring"
    : "focus-visible:ring-ring";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 items-center gap-2 transition-colors outline-none focus-visible:ring-2",
            focusRing,
            compact
              ? cn("flex-row", inSidebar && "w-full justify-center")
              : "w-full flex-col items-stretch",
            className
          )}
          aria-label="Account menu"
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2",
            compact
              ? cn(inSidebar ? "justify-center" : "flex-1", triggerSurface)
              : cn("w-full gap-[11px]", triggerSurface)
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                inSidebar
                  ? "bg-[linear-gradient(135deg,#0057FF,#7C5CFF)]"
                  : "bg-primary text-primary-foreground"
              )}
            >
              {getInitials(name, email)}
            </span>
            {!compact ? (
              <span className="min-w-0 flex-1 text-left">
                <span className={cn("block truncate text-[13px] font-semibold", textPrimary)}>
                  {displayEmail}
                </span>
                <span className={cn("block text-[11px]", textSecondary)}>Account</span>
              </span>
            ) : (
              <span className={cn("hidden truncate text-sm sm:block", labelClass)}>
                {displayLabel}
              </span>
            )}
            {!compact ? (
              <ChevronUpIcon
                className={cn("size-[15px] shrink-0", textSecondary)}
                aria-hidden
              />
            ) : null}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align={compact ? "end" : "start"}
        className="min-w-52"
      >
        {email ? (
          <>
            <DropdownMenuLabel className="font-normal">
              <span className="block truncate text-sm font-medium">{email}</span>
              <span className="text-xs text-muted-foreground">Signed in</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <form action={signOutAction}>
          <SignOutMenuItem />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
