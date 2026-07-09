"use client";

import { SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function CreatorSearchAiExtractingState({ className }: Props) {
  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-[#1D9E75]/10">
        <SparklesIcon className="size-7 animate-pulse text-[#1D9E75]" aria-hidden />
      </div>
      <p className="max-w-sm text-sm font-medium text-foreground">
        Extracting key details from your brief…
      </p>
      <p className="max-w-xs text-xs text-muted-foreground">
        AI is turning your campaign requirements into search filters.
      </p>
    </div>
  );
}
