"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { ScenarioComparison } from "@/features/campaign-decision-engine";

type ScenarioComparisonTableProps = {
  comparison: ScenarioComparison;
  compact?: boolean;
  className?: string;
};

export function ScenarioComparisonTable({
  comparison,
  compact = false,
  className,
}: ScenarioComparisonTableProps) {
  return (
    <Card size="sm" className={cn("rounded-2xl border-border/80 shadow-none", className)}>
      <CardHeader className={cn("pb-2", compact && "px-3 pt-3")}>
        <CardTitle className={cn("font-semibold", compact ? "text-xs" : "text-sm")}>
          {compact ? "Scenario Compare" : "Side-by-Side Comparison"}
        </CardTitle>
        {!compact ? (
          <p className="text-xs text-muted-foreground">Winner highlighted automatically</p>
        ) : null}
      </CardHeader>
      <CardContent className={cn("overflow-x-auto p-0 pb-4", compact && "px-2")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={cn(compact ? "text-[10px]" : "text-xs")}>Scenario</TableHead>
              {!compact ? (
                <>
                  <TableHead className="text-right text-xs">Budget</TableHead>
                  <TableHead className="text-right text-xs">Reach</TableHead>
                  <TableHead className="text-right text-xs">Engagement</TableHead>
                  <TableHead className="text-right text-xs">ER</TableHead>
                </>
              ) : null}
              <TableHead className={cn("text-right", compact ? "text-[10px]" : "text-xs")}>
                {compact ? "Budget" : "CPM"}
              </TableHead>
              {compact ? (
                <TableHead className="text-right text-[10px]">Score</TableHead>
              ) : (
                <>
                  <TableHead className="text-right text-xs">CPM</TableHead>
                  <TableHead className="text-right text-xs">Creators</TableHead>
                  <TableHead className="text-right text-xs">Score</TableHead>
                  <TableHead className="text-right text-xs">Success</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparison.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={compact ? 3 : 9}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  No scenarios to compare yet.
                </TableCell>
              </TableRow>
            ) : (
              comparison.rows.map((row) => (
              <TableRow
                key={row.scenarioId}
                className={cn(row.isWinner && "bg-[#1D9E75]/8 hover:bg-[#1D9E75]/10")}
              >
                <TableCell className={cn("font-medium", compact ? "text-[10px]" : "text-xs")}>
                  {row.scenarioName}
                  {row.isWinner && (
                    <span className="ml-1 text-[10px] font-semibold text-[#1D9E75]">★</span>
                  )}
                </TableCell>
                {!compact ? (
                  <>
                    <TableCell className="text-right text-xs tabular-nums">
                      {row.budget.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {row.reach.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {row.engagement.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">—</TableCell>
                  </>
                ) : null}
                <TableCell className={cn("text-right tabular-nums", compact ? "text-[10px]" : "text-xs")}>
                  {compact ? row.budget.toLocaleString() : Math.round(row.cpm)}
                </TableCell>
                {compact ? (
                  <TableCell className="text-right text-[10px] font-semibold tabular-nums text-[#1D9E75]">
                    {row.thinkwayScore}
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="text-right text-xs tabular-nums">
                      {Math.round(row.cpm)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {row.creatorCount}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums text-[#1D9E75]">
                      {row.thinkwayScore}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {row.successProbability}%
                    </TableCell>
                  </>
                )}
              </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
