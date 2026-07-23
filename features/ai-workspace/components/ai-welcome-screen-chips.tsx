import {
  AlertCircleIcon,
  DollarSignIcon,
  FileTextIcon,
  LineChartIcon,
  StarIcon,
} from "lucide-react";

import type { AiIntent } from "@/features/ai";

export const CHIP_ACTIONS = [
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
