import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { cn } from "@/lib/utils";

type UserAccountProps = {
  email?: string | null;
  className?: string;
  compact?: boolean;
};

function getInitials(email: string | null | undefined) {
  if (!email) {
    return "?";
  }

  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export function UserAccount({
  email,
  className,
  compact = false,
}: UserAccountProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "flex-row" : "flex-col items-stretch",
        className
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          compact ? "flex-1" : "rounded-3xl bg-sidebar-accent/60 px-3 py-2"
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {getInitials(email)}
        </div>
        {!compact ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{email ?? "Signed in"}</p>
            <p className="text-xs text-muted-foreground">Account</p>
          </div>
        ) : (
          <p className="hidden truncate text-sm font-medium sm:block">
            {email ?? "Account"}
          </p>
        )}
      </div>
      <SignOutButton
        showLabel={!compact}
        className={compact ? "w-auto shrink-0" : undefined}
      />
    </div>
  );
}
