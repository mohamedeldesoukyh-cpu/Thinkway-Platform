import type { ReactNode } from "react";

import "@/app/styles/finance-suite.css";

import { cn } from "@/lib/utils";

type FinanceSuiteRootProps = {
  children: ReactNode;
  className?: string;
};

export function FinanceSuiteRoot({ children, className }: FinanceSuiteRootProps) {
  return <div className={cn("finance-suite", className)}>{children}</div>;
}
