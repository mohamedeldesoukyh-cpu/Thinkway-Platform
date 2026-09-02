import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { LinkGeneratorWorkspace } from "@/features/links/components/link-generator-workspace";

export default function LinkGeneratorPage() {
  return (
    <FinanceSuiteShell
      title="Link generator"
      description="Attribution links for campaigns and vendors"
    >
      <PlatformErrorBoundary surface="generic">
        <LinkGeneratorWorkspace />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
