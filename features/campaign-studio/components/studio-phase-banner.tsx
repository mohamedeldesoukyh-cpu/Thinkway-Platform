import { cn } from "@/lib/utils";

import { STUDIO_REF_CLASSES } from "../constants/campaign-studio-ref-tokens";
import { useStudioRefMode } from "../hooks/use-studio-ref-mode";

type StudioPhaseBannerProps = {
  phaseNumber: number;
  label: string;
  description: string;
  className?: string;
  compact?: boolean;
};

export function StudioPhaseBanner({
  phaseNumber,
  label,
  description,
  className,
  compact = false,
}: StudioPhaseBannerProps) {
  const refMode = useStudioRefMode();

  if (refMode || compact) {
    return (
      <div className={cn(STUDIO_REF_CLASSES.stepHead, className)}>
        <span className={STUDIO_REF_CLASSES.stepNum} aria-hidden>
          {phaseNumber}
        </span>
        <span className={STUDIO_REF_CLASSES.stepTitle}>{label}</span>
        <span className={STUDIO_REF_CLASSES.stepSub}>{description}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center first:mt-1 sm:gap-3",
        "pt-2 pb-4 sm:mt-[34px]",
        className
      )}
    >
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#0B0F1A] text-xs font-extrabold text-white dark:bg-foreground"
        aria-hidden
      >
        {phaseNumber}
      </div>
      <h3 className="shrink-0 text-xs font-extrabold tracking-[0.16em] text-[#0B0F1A] uppercase dark:text-foreground">
        {label}
      </h3>
      <span className="hidden truncate text-[12.5px] font-semibold text-[#6B7280] sm:inline">
        {description}
      </span>
      <div className="h-px min-w-8 flex-1 bg-[#0B0F1A]/8 dark:bg-border" aria-hidden />
    </div>
  );
}
