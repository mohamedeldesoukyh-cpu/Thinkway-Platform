import type { AiActionCard } from "@/features/ai-workspace/types";

import type {
  WorkflowPauseReason,
  WorkflowResponseMetadata,
  WorkflowState,
  WorkflowSummarySection,
  WorkflowTaskResult,
} from "./workflow";

export interface WorkflowDashboard {
  title: string;
  summary: string;
  content: string;
  progress: WorkflowProgress;
  tasks: WorkflowTaskDisplay[];
  recommendedNextAction: string;
  actionCards: AiActionCard[];
  summarySections: WorkflowSummarySection[];
  metadata: WorkflowResponseMetadata;
}

export interface WorkflowProgress {
  current: number;
  total: number;
  percent: number;
  statusLabel: string;
}

export interface WorkflowTaskDisplay {
  id: string;
  title: string;
  status: WorkflowTaskResult["status"];
  agent?: string;
  isCurrent: boolean;
}

export type { WorkflowSummarySection } from "./workflow";

export interface DashboardFormatInput {
  state: WorkflowState;
  actionCards: AiActionCard[];
  pauseReason?: WorkflowPauseReason;
  pauseMessage?: string;
}
