import { FinanceSuiteRoot } from "@/components/finance/suite";

export default function VendorIoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FinanceSuiteRoot>{children}</FinanceSuiteRoot>;
}
