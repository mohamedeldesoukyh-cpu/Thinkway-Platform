import { cn } from "@/lib/utils";

type ThinkwayLogoProps = {
  /** Show THINKWAY wordmark beside the icon mark. */
  showText?: boolean;
  /** Smaller icon mark for collapsed sidebar rails. */
  compact?: boolean;
  className?: string;
};

export function ThinkwayLogo({
  showText = true,
  compact = false,
  className,
}: ThinkwayLogoProps) {
  return (
    <div
      className={cn(
        "login-v2-logo",
        compact && "thinkway-logo-compact",
        className
      )}
    >
      <div className="login-v2-logo-mark" aria-hidden />
      {showText ? (
        <div className="login-v2-logo-text">
          THINK<span>WAY</span>
        </div>
      ) : null}
    </div>
  );
}
