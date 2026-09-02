import { FinanceSuiteRoot } from "@/components/finance/suite";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceSuiteRoot>{children}</FinanceSuiteRoot>;
}
