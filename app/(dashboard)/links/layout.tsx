import { FinanceSuiteRoot } from "@/components/finance/suite";

export default function LinksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceSuiteRoot>{children}</FinanceSuiteRoot>;
}
