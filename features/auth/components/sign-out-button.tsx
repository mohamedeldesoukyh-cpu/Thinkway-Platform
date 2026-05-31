"use client";

import { LogOutIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  className?: string;
  showLabel?: boolean;
};

function SignOutSubmit({ showLabel }: { showLabel: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="ghost"
      size={showLabel ? "sm" : "icon-sm"}
      className={cn(showLabel && "w-full justify-start")}
      disabled={pending}
    >
      <LogOutIcon />
      {showLabel ? (
        <span>{pending ? "Signing out..." : "Sign out"}</span>
      ) : (
        <span className="sr-only">Sign out</span>
      )}
    </Button>
  );
}

export function SignOutButton({
  className,
  showLabel = true,
}: SignOutButtonProps) {
  return (
    <form
      action={signOutAction}
      className={cn(showLabel ? "w-full" : "w-auto", className)}
    >
      <SignOutSubmit showLabel={showLabel} />
    </form>
  );
}
