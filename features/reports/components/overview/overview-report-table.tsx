"use client";

import type { OverviewColumn, OverviewRow } from "@/lib/reports/overview/overview-report";
import { cn } from "@/lib/utils";

import styles from "./overview-report.module.css";
import {
  amountTone,
  formatOverviewAmount,
  OVERVIEW_COLUMN_META,
  overviewHeaderGroups,
} from "./overview-report-ui";

type OverviewReportTableProps = {
  rows: OverviewRow[];
  totals: OverviewRow;
  /** Visible columns, already in display order. */
  columns: OverviewColumn[];
  currency: string;
  pending: boolean;
  /** id of the visible heading that names the scroll region. */
  labelledBy: string;
};

/**
 * The financial table. Read-only presentation of server-computed values:
 * no amount is derived or re-calculated here.
 */
export function OverviewReportTable({ rows, totals, columns, currency, pending, labelledBy }: OverviewReportTableProps) {
  const groups = overviewHeaderGroups(columns);
  const familyStarts = new Set(groups.slice(1).map(group => group.firstKey));
  const campaignCount = `${rows.length} ${rows.length === 1 ? "campaign" : "campaigns"}`;

  const cellClass = (key: OverviewColumn, index: number) => {
    const meta = OVERVIEW_COLUMN_META[key];
    return cn(
      meta.numeric ? styles.numCell : styles.textCell,
      familyStarts.has(key) && styles.familyStart,
      index === 0 && styles.pinned,
    );
  };

  return (
    <div
      className={cn(styles.scroller, pending && styles.pending)}
      role="region"
      aria-labelledby={labelledBy}
      // Focusable so keyboard users can scroll wide tables horizontally.
      tabIndex={0}
    >
      <table className={styles.table}>
        <caption className="sr-only">
          Overview Report in {currency}, amounts before VAT. {campaignCount}. The totals row covers all filtered campaigns.
        </caption>
        <thead>
          <tr>
            {groups.map((group, index) => (
              <th
                key={group.firstKey}
                scope="colgroup"
                colSpan={group.span}
                className={cn(styles.groupCell, index > 0 && styles.familyStart, index === 0 && group.span === 1 && styles.pinned)}
              >
                <span>{group.label}</span>
              </th>
            ))}
          </tr>
          <tr>
            {columns.map((key, index) => {
              const meta = OVERVIEW_COLUMN_META[key];
              return (
                <th
                  key={key}
                  scope="col"
                  data-kind={meta.kind}
                  data-numeric={meta.numeric}
                  className={cn(styles.columnCell, cellClass(key, index))}
                >
                  <span className={styles.headLabel} title={`${meta.fullName}: ${meta.meaning}`}>
                    {meta.numeric && meta.kind !== "actual" && <span className={styles.kindMark} aria-hidden />}
                    <span aria-hidden>{meta.label}</span>
                    <span className="sr-only">{meta.fullName}</span>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(row => (
              <tr key={row.id}>
                {columns.map((key, index) => {
                  const meta = OVERVIEW_COLUMN_META[key];
                  if (!meta.numeric) {
                    const text = String(row[key] ?? "");
                    const Cell = index === 0 ? "th" : "td";
                    return (
                      <Cell key={key} scope={index === 0 ? "row" : undefined} data-kind="text" className={cellClass(key, index)}>
                        {text ? <span className={styles.clamp} title={text}>{text}</span> : <span className="text-muted-foreground" aria-label="Not set">—</span>}
                      </Cell>
                    );
                  }
                  const value = row[key] as number;
                  const tone = amountTone(value);
                  return (
                    <td
                      key={key}
                      data-kind={meta.kind}
                      className={cn(cellClass(key, index), tone === "negative" && styles.negative, tone === "zero" && styles.zero)}
                    >
                      {formatOverviewAmount(value)}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                <p className="font-medium text-foreground">No campaigns match these filters.</p>
                <p className="mt-1 text-xs">Change or remove a filter above, or use Reset filters to show all campaigns.</p>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            {columns.map((key, index) => {
              const meta = OVERVIEW_COLUMN_META[key];
              if (index === 0) {
                // The first cell always names the row, even when only numeric columns are visible.
                return (
                  <th key={key} scope="row" data-kind={meta.kind} className={cellClass(key, index)}>
                    {meta.numeric ? (
                      <span className={styles.totalsSplit}>
                        <span className={styles.totalsTag}>Totals<span className="sr-only"> for all filtered campaigns, {meta.fullName}</span></span>
                        <span className={cn(amountTone(totals[key] as number) === "negative" && styles.negative)}>{formatOverviewAmount(totals[key] as number)}</span>
                      </span>
                    ) : (
                      <span className={styles.totalsLabel}>
                        Totals
                        <span className={styles.totalsTag}>
                          <span className="sr-only">for </span>all {campaignCount}
                        </span>
                      </span>
                    )}
                  </th>
                );
              }
              if (!meta.numeric) return <td key={key} data-kind="text" className={cellClass(key, index)} />;
              const value = totals[key] as number;
              const tone = amountTone(value);
              return (
                <td key={key} data-kind={meta.kind} className={cn(cellClass(key, index), tone === "negative" && styles.negative, tone === "zero" && styles.zero)}>
                  {formatOverviewAmount(value)}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
