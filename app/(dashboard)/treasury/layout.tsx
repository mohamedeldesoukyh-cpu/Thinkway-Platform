import { FinanceSuiteRoot } from "@/components/finance/suite";

export default function TreasuryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceSuiteRoot>{children}</FinanceSuiteRoot>;
}
