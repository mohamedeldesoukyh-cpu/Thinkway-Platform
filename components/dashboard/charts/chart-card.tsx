import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  minHeight?: number;
};

export function ChartCard({
  title,
  description,
  children,
  className,
  minHeight = 200,
}: ChartCardProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-xs">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent style={{ minHeight }} className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
}
