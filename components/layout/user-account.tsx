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
  className?: string;
  compact?: boolean;
  /** Dark sidebar (default) vs light page chrome (mobile header). */
  inSidebar?: boolean;
};

function getInitials(email: string | null | undefined) {
  if (!email) {
    return "?";
  }

  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
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
  className,
  compact = false,
  inSidebar = true,
}: UserAccountProps) {
  const displayEmail = email ?? "Signed in";
  const textPrimary = inSidebar ? "text-sidebar-foreground" : "text-foreground";
  const textSecondary = inSidebar
    ? "text-sidebar-foreground/60"
    : "text-muted-foreground";
  const triggerSurface = inSidebar
    ? "rounded-3xl bg-sidebar-accent/60 hover:bg-sidebar-accent"
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
                ? cn(inSidebar ? "justify-center" : "flex-1", triggerSurface, "p-1")
                : cn("w-full px-3 py-2", triggerSurface)
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {getInitials(email)}
            </span>
            {!compact ? (
              <span className="min-w-0 flex-1 text-left">
                <span className={cn("block truncate text-sm font-medium", textPrimary)}>
                  {displayEmail}
                </span>
                <span className={cn("block text-xs", textSecondary)}>Account</span>
              </span>
            ) : (
              <span
                className={cn(
                  "hidden truncate text-sm font-medium sm:block",
                  textPrimary
                )}
              >
                {displayEmail}
              </span>
            )}
            {!compact ? (
              <ChevronUpIcon
                className={cn("size-4 shrink-0 opacity-60", textPrimary)}
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
