import { FinanceSuiteRoot } from "@/components/finance/suite";

export default function PlanningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceSuiteRoot>{children}</FinanceSuiteRoot>;
}
