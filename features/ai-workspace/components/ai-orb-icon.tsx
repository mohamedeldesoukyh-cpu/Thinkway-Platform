import { cn } from "@/lib/utils";

type AiOrbIconProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  pulse?: boolean;
  float?: boolean;
  ring?: boolean;
};

const SIZE_MAP = {
  sm: { box: "size-9 rounded-[10px]", icon: "size-[18px]" },
  md: { box: "size-[30px] rounded-[9px]", icon: "size-3.5" },
  lg: { box: "size-20 rounded-[22px]", icon: "size-[38px]" },
} as const;

export function AiOrbIcon({
  size = "sm",
  className,
  pulse = false,
  float = false,
  ring = false,
}: AiOrbIconProps) {
  const sizes = SIZE_MAP[size];

  return (
    <div
      className={cn(
        "ai-gradient-orb relative flex shrink-0 items-center justify-center shadow-[0_4px_14px_rgba(124,58,237,0.4)]",
        sizes.box,
        pulse && "ai-orb-pulse",
        float && "ai-orb-float",
        ring && "ai-orb-ring",
        className
      )}
    >
      <svg
        className={cn(sizes.icon, "relative z-[1] text-white")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    </div>
  );
}
