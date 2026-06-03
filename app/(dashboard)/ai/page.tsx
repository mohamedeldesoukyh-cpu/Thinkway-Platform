import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AiAnalystWorkspace } from "@/features/ai-analyst/components/ai-analyst-workspace";

export default function AiAnalystPage() {
  return (
    <DashboardShell
      title="AI Analyst"
      description="Ask questions, uncover trends, and get smart insights about your campaigns and performance."
    >
      <PlatformErrorBoundary surface="analytics">
        <AiAnalystWorkspace />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
