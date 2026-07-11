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
  { label: `4,550 ${AI_TERMINOLOGY.vendorPlural}`, dot: "bg-[#0C9D57]" },
  { label: "1 Campaign active", dot: "bg-[#7C3AED]" },
  { label: "£445K pending payment", dot: "bg-[#D97706]" },
  { label: "6 Shortlists", dot: "bg-[#3D5AFE]" },
  { label: "EG · MENA", dot: "bg-[#D6336C]" },
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
    iconBg: "bg-gradient-to-br from-[#FFE3EC] to-[#FFC7DC] dark:from-pink-950/60 dark:to-pink-900/40",
    iconColor: "text-[#D6336C]",
  },
  {
    id: "create-campaign",
    label: `Create ${AI_TERMINOLOGY.campaign.toLowerCase()}`,
    hint: "Arab Bank × Gen Z on Instagram & TikTok for Q3 2026",
    prompt:
      "Create a new campaign for Arab Bank targeting Gen Z on Instagram and TikTok for Q3 2026",
    intent: "strategize" as AiIntent,
    icon: MegaphoneIcon,
    iconBg: "bg-gradient-to-br from-[#E3E9FF] to-[#D6DEFF] dark:from-blue-950/60 dark:to-blue-900/40",
    iconColor: "text-[#3D5AFE]",
  },
  {
    id: "analyze-campaign",
    label: `Analyze ${AI_TERMINOLOGY.campaign.toLowerCase()}`,
    hint: "Key insights from Arab Bank × La Liga performance data",
    prompt:
      "Analyze the performance of Arab Bank × La Liga campaign and give me key insights",
    intent: "analyze" as AiIntent,
    icon: TrendingUpIcon,
    iconBg: "bg-gradient-to-br from-[#DFFBEA] to-[#C6F5D9] dark:from-emerald-950/60 dark:to-emerald-900/40",
    iconColor: "text-[#0C9D57]",
  },
  {
    id: "build-shortlist",
    label: "Build shortlist",
    hint: "15 food & lifestyle vendors for a Cairo restaurant launch",
    prompt:
      "Build a shortlist of 15 food and lifestyle creators for a restaurant brand launch in Cairo",
    intent: "scout" as AiIntent,
    icon: UserPlusIcon,
    iconBg: "bg-gradient-to-br from-[#F0E6FF] to-[#E4D2FF] dark:from-purple-950/60 dark:to-purple-900/40",
    iconColor: "text-[#7C3AED]",
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
      <div className="relative z-[1] w-full max-w-[720px]">
        <div className="mx-auto mb-6 flex justify-center">
          <AiOrbIcon
            size="lg"
            float
            ring
            className="shadow-[0_20px_40px_rgba(0,87,255,0.35)]"
          />
        </div>

        <h2 className="mb-3 text-[30px] leading-[1.15] font-extrabold tracking-[-1.2px] text-foreground sm:text-[38px]">
          How can I help <span className="ai-gradient-text">your campaigns</span> today?
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

        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {CONTEXT_PILLS.map((pill) => (
            <span
              key={pill.label}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-[#0B0F1A]/8 bg-white px-3.5 text-[12px] font-semibold text-foreground shadow-[0_1px_2px_rgba(6,8,16,0.06)] dark:border-border dark:bg-background"
            >
              <span className={cn("size-[7px] shrink-0 rounded-full", pill.dot)} />
              {pill.label}
            </span>
          ))}
        </div>

        <div className="mx-auto mb-5 grid max-w-[640px] grid-cols-1 gap-3.5 text-left sm:grid-cols-2">
          {PROMPT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(card.prompt, card.intent)}
                className={cn(
                  "flex items-start gap-3.5 rounded-[20px] border border-[#0B0F1A]/8 bg-white p-[18px] text-left shadow-[0_1px_2px_rgba(6,8,16,0.06)] transition-all",
                  "hover:-translate-y-[3px] hover:border-[#0057FF]/25 hover:shadow-[0_8px_24px_rgba(0,87,255,0.10),0_2px_6px_rgba(6,8,16,0.06)]",
                  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
                  "dark:border-border dark:bg-background dark:hover:border-blue-800"
                )}
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    card.iconBg
                  )}
                >
                  <Icon className={cn("size-[19px]", card.iconColor)} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-bold tracking-[-0.2px] text-foreground">
                    {card.label}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-[1.45] text-muted-foreground">
                    {card.hint}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {CHIP_ACTIONS.map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(chip.prompt, chip.intent)}
                className={cn(
                  "inline-flex h-[34px] items-center gap-1.5 rounded-full border border-[#0057FF]/15 bg-[#0057FF]/5 px-[15px] text-[12.5px] font-semibold text-[#0057FF] transition-colors",
                  "hover:bg-[#0057FF]/10",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                )}
              >
                <Icon className="size-3.5" />
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
