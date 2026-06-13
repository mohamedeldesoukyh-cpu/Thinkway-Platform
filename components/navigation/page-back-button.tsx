"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { navigateBack } from "@/lib/navigation/go-back";
import { cn } from "@/lib/utils";

type PageBackButtonProps = {
  /** Parent route to navigate to when Back is clicked. */
  fallbackHref: string;
  /** Visible label for text variant; screen-reader text for icon variant. */
  label?: string;
  variant?: "icon" | "text";
  className?: string;
  title?: string;
};

export function PageBackButton({
  fallbackHref,
  label = "Back",
  variant = "icon",
  className,
  title,
}: PageBackButtonProps) {
  const router = useRouter();

  function handleBack() {
    navigateBack(router, fallbackHref);
  }

  if (variant === "text") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("-ml-2 w-fit", className)}
        onClick={handleBack}
        title={title ?? label}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8 shrink-0", className)}
      onClick={handleBack}
      title={title ?? label}
    >
      <ArrowLeftIcon className="size-4" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}
