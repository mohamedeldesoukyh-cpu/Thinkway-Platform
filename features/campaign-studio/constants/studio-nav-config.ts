import type { LucideIcon } from "lucide-react";
import {
  CheckSquareIcon,
  CompassIcon,
  FileTextIcon,
  LayoutGridIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

/** Visual config for the six-step Studio workspace rail. */
export const STUDIO_PHASE_NAV: Record<
  string,
  {
    icon: LucideIcon;
    iconBgClass: string;
    iconTextClass: string;
  }
> = {
  intake: {
    icon: FileTextIcon,
    iconBgClass: "bg-[#0057FF]/20",
    iconTextClass: "text-[#7FA8FF]",
  },
  strategy: {
    icon: CompassIcon,
    iconBgClass: "bg-[#7C3AED]/20",
    iconTextClass: "text-[#C9AEFF]",
  },
  creators: {
    icon: UsersIcon,
    iconBgClass: "bg-[#0057FF]/20",
    iconTextClass: "text-[#7FA8FF]",
  },
  content: {
    icon: LayoutGridIcon,
    iconBgClass: "bg-[#D97706]/20",
    iconTextClass: "text-[#FFC98A]",
  },
  commercial: {
    icon: WalletIcon,
    iconBgClass: "bg-[#0C9D57]/20",
    iconTextClass: "text-[#8FE3B5]",
  },
  package: {
    icon: CheckSquareIcon,
    iconBgClass: "bg-[#D6336C]/20",
    iconTextClass: "text-[#FFB3CB]",
  },
};

export const DEFAULT_PHASE_NAV = {
  icon: FileTextIcon,
  iconBgClass: "bg-white/10",
  iconTextClass: "text-white/70",
};
