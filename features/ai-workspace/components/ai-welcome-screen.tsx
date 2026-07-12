"use client";

import {
  AlertCircleIcon,
  DollarSignIcon,
  FileTextIcon,
  LineChartIcon,
  StarIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { AiIntent } from "@/features/ai";
import { AiOrbIcon } from "./ai-orb-icon";

type AiWelcomeScreenProps = {
  onSelect?: (prompt: string, intent?: AiIntent) => void;
  disabled?: boolean;
  className?: string;
};

const CHIP_ACTIONS = [
  {
    id: "generate-brief",
    label: "Generate brief",
    prompt: "Generate a campaign brief for a fashion brand targeting women aged 18-35",
    intent: "strategize" as AiIntent,
    icon: FileTextIcon,
    hideWhenWorkflow: ["create-campaign", "generate-brief"],
  },
  {
    id: "revenue-summary",
    label: "Revenue summary",
    prompt: "What is our total revenue and gross profit this month?",
    intent: "analyze" as AiIntent,
    icon: DollarSignIcon,
    contexts: ["general", "campaign", "client"] as const,
  },
  {
    id: "pending-payments",
    label: "Pending payments",
    prompt: "Show me all vendors with pending payments",
    intent: "analyze" as AiIntent,
    icon: AlertCircleIcon,
    contexts: ["general", "campaign", "client"] as const,
  },
  {
    id: "top-er",
    label: "Top by ER%",
    prompt: "Who are the top performing creators by engagement rate in our database?",
    intent: "scout" as AiIntent,
    icon: StarIcon,
    contexts: ["general", "discovery"] as const,
  },
  {
    id: "export-report",
    label: "Export report",
    prompt: "Export a report for the Arab Bank campaign with all creator deliverables",
    intent: "analyze" as AiIntent,
    icon: LineChartIcon,
    contexts: ["general", "campaign"] as const,
  },
] as const;

export function AiWelcomeScreen({ className }: AiWelcomeScreenProps) {
  return (
    <div
      className={cn(
        "ai-welcome-aurora ai-welcome-dots relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6",
        className
      )}
    >
      <div className="relative z-[1] flex flex-col items-center gap-5 text-center">
        <AiOrbIcon
          size="lg"
          float
          ring
          className="shadow-[0_20px_40px_rgba(0,87,255,0.35)]"
        />

        <h2 className="whitespace-nowrap text-[clamp(22px,3.2vw,38px)] leading-none font-extrabold tracking-[-1.2px] text-foreground">
          How can I help <span className="ai-gradient-text">your campaigns</span> today?
        </h2>
      </div>
    </div>
  );
}

export { CHIP_ACTIONS };
