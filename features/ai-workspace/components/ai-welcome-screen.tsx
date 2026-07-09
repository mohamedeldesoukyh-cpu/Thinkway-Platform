"use client";

import {
  AlertCircleIcon,
  DollarSignIcon,
  FileTextIcon,
  LineChartIcon,
  MegaphoneIcon,
  StarIcon,
  TrendingUpIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { AiIntent } from "@/features/ai";
import { AI_TERMINOLOGY } from "../constants/ai-copy";
import { AiOrbIcon } from "./ai-orb-icon";

type AiWelcomeScreenProps = {
  onSelect: (prompt: string, intent?: AiIntent) => void;
  disabled?: boolean;
  className?: string;
};

const CONTEXT_PILLS = [
  { label: `4,550 ${AI_TERMINOLOGY.vendorPlural}`, dot: "bg-[#1D9E75]" },
  { label: "1 Campaign active", dot: "bg-violet-600" },
  { label: "£445K pending payment", dot: "bg-amber-500" },
  { label: "6 Shortlists", dot: "bg-purple-500" },
  { label: "EG · MENA", dot: "bg-pink-500" },
] as const;

const PROMPT_CARDS = [
  {
    id: "find-creators",
    label: `Find ${AI_TERMINOLOGY.vendorPlural.toLowerCase()}`,
    hint: "Top beauty & fashion influencers in Egypt with 500K+ followers",
    prompt:
      "Find me top 10 Instagram creators in Egypt with over 500K followers in beauty and fashion niche",
    intent: "scout" as AiIntent,
    icon: UsersIcon,
    iconBg: "bg-pink-50 dark:bg-pink-950/40",
    iconColor: "text-pink-500",
  },
  {
    id: "create-campaign",
    label: `Create ${AI_TERMINOLOGY.campaign.toLowerCase()}`,
    hint: "Arab Bank × Gen Z on Instagram & TikTok for Q3 2026",
    prompt:
      "Create a new campaign for Arab Bank targeting Gen Z on Instagram and TikTok for Q3 2026",
    intent: "strategize" as AiIntent,
    icon: MegaphoneIcon,
    iconBg: "bg-violet-50 dark:bg-violet-950/40",
    iconColor: "text-violet-600",
  },
  {
    id: "analyze-campaign",
    label: `Analyze ${AI_TERMINOLOGY.campaign.toLowerCase()}`,
    hint: "Key insights from Arab Bank × La Liga performance data",
    prompt:
      "Analyze the performance of Arab Bank × La Liga campaign and give me key insights",
    intent: "analyze" as AiIntent,
    icon: TrendingUpIcon,
    iconBg: "bg-[#1D9E75]/10 dark:bg-[#1D9E75]/20",
    iconColor: "text-[#1D9E75]",
  },
  {
    id: "build-shortlist",
    label: "Build shortlist",
    hint: "15 food & lifestyle vendors for a Cairo restaurant launch",
    prompt:
      "Build a shortlist of 15 food and lifestyle creators for a restaurant brand launch in Cairo",
    intent: "scout" as AiIntent,
    icon: UserPlusIcon,
    iconBg: "bg-purple-50 dark:bg-purple-950/40",
    iconColor: "text-purple-500",
  },
] as const;

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

export function AiWelcomeScreen({ onSelect, disabled, className }: AiWelcomeScreenProps) {
  return (
    <div
      className={cn(
        "ai-welcome-aurora ai-welcome-dots relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-8 text-center",
        className
      )}
    >
      <div className="relative z-[1] w-full max-w-[640px]">
        <div className="mx-auto mb-6 flex justify-center">
          <AiOrbIcon
            size="lg"
            float
            ring
            className="shadow-[0_12px_40px_rgba(124,58,237,0.4)]"
          />
        </div>

        <h2 className="mb-2.5 text-[28px] leading-[1.1] font-extrabold tracking-[-0.8px] text-foreground sm:text-[32px]">
          How can I help
          <br />
          <span className="ai-gradient-text">your campaigns</span> today?
        </h2>

        <p className="mx-auto mb-7 max-w-[440px] text-sm leading-relaxed text-muted-foreground">
          Full context of your{" "}
          <strong className="font-semibold text-foreground/80">
            4,550 {AI_TERMINOLOGY.vendorPlural.toLowerCase()}
          </strong>
          ,{" "}
          <strong className="font-semibold text-foreground/80">1 campaign</strong>, and{" "}
          <strong className="font-semibold text-foreground/80">2 legal entities</strong>.
          Pick a task below to get started.
        </p>

        <div className="mb-7 flex flex-wrap items-center justify-center gap-2">
          {CONTEXT_PILLS.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex h-[26px] items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-[11px] font-semibold text-foreground/80 shadow-sm"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", pill.dot)} />
              {pill.label}
            </span>
          ))}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
          {PROMPT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(card.prompt, card.intent)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border bg-background p-3.5 text-left transition-all",
                  "hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_4px_20px_rgba(124,58,237,0.1)]",
                  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
                  "dark:hover:border-violet-800"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    card.iconBg
                  )}
                >
                  <Icon className={cn("size-[15px]", card.iconColor)} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">{card.label}</div>
                  <div className="text-[11px] leading-snug text-muted-foreground">
                    {card.hint}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {CHIP_ACTIONS.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(chip.prompt, chip.intent)}
                className={cn(
                  "inline-flex h-[30px] items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-[11px] font-medium text-foreground/80 transition-all",
                  "hover:-translate-y-px hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "dark:hover:border-violet-800 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
                )}
              >
                <Icon className="size-3" />
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { PROMPT_CARDS, CHIP_ACTIONS };
