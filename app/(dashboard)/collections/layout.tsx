import { FinanceSuiteRoot } from "@/components/finance/suite";

export default function CollectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceSuiteRoot>{children}</FinanceSuiteRoot>;
}
