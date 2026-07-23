import { ThinkwayLogo } from "@/components/brand/thinkway-logo";
import { cn } from "@/lib/utils";

type ThinkwayPageLoaderProps = {
  className?: string;
  /** Accessible label for screen readers. */
  label?: string;
};

/** Branded loading mark — use instead of skeleton placeholders during route transitions. */
export function ThinkwayPageLoader({
  className,
  label = "Loading",
}: ThinkwayPageLoaderProps) {
  return (
    <div
      className={cn("thinkway-page-loader", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <ThinkwayLogo showText className="thinkway-page-loader-logo mb-0" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

type ThinkwayRouteLoadingProps = {
  className?: string;
  /** Fill the main content column (default for route `loading.tsx`). */
  fullscreen?: boolean;
};

export function ThinkwayRouteLoading({
  className,
  fullscreen = true,
}: ThinkwayRouteLoadingProps) {
  return (
    <div
      className={cn(
        fullscreen &&
          "flex min-h-[min(100%,480px)] w-full flex-1 items-center justify-center bg-background",
        className
      )}
    >
      <ThinkwayPageLoader />
    </div>
  );
}
