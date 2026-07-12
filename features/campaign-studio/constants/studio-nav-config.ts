import type { LucideIcon } from "lucide-react";
import {
  CalendarIcon,
  CheckSquareIcon,
  CompassIcon,
  FileTextIcon,
  LineChartIcon,
  UsersIcon,
} from "lucide-react";

/** Visual config for story-arc phases in the section sidebar rail. */
export const STUDIO_PHASE_NAV: Record<
  string,
  {
    icon: LucideIcon;
    iconBgClass: string;
    iconTextClass: string;
  }
> = {
  brief: {
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
  plan: {
    icon: CalendarIcon,
    iconBgClass: "bg-[#D97706]/20",
    iconTextClass: "text-[#FFC98A]",
  },
  forecast: {
    icon: LineChartIcon,
    iconBgClass: "bg-[#0C9D57]/20",
    iconTextClass: "text-[#8FE3B5]",
  },
  signoff: {
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
