import { FinanceSuiteRoot } from "@/components/finance/suite";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceSuiteRoot>{children}</FinanceSuiteRoot>;
}
