import { cn } from "@/lib/utils";

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
  return (
    <div
      className={cn(
        "flex items-center first:mt-1 sm:gap-3",
        compact ? "gap-2 py-1 sm:mt-2" : "pt-2 pb-4 sm:mt-[34px]",
        className
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-[#0B0F1A] font-extrabold text-white dark:bg-foreground",
          compact ? "size-6 text-[10px]" : "size-7 text-xs"
        )}
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
