"use client";

import type { PaymentReadinessResult } from "@/lib/creators/crm/payment-readiness";
import { cn } from "@/lib/utils";

export function PaymentReadinessStrip({
  readiness,
}: {
  readiness: PaymentReadinessResult;
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border px-3 py-2.5",
        readiness.ready
          ? "border-[var(--brand-product)]/40 bg-[var(--brand-product)]/5"
          : "border-amber-500/40 bg-amber-500/5"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Payment readiness
          </p>
          <p className="text-[13px] font-semibold text-foreground">
            {readiness.ready ? "YES — Finance can process payment" : "NO — Missing payment fields"}
          </p>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[11px] font-semibold",
            readiness.ready
              ? "bg-[var(--brand-product)]/15 text-[var(--brand-product)]"
              : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
          )}
        >
          {readiness.ready ? "Ready" : "Blocked"}
        </span>
      </div>

      {!readiness.ready && readiness.missing.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {readiness.missing.map((item) => (
            <span
              key={item.code}
              className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-900 dark:text-amber-100"
            >
              Missing {item.label}
            </span>
          ))}
        </div>
      ) : null}

      {readiness.warnings.length > 0 ? (
        <div className="space-y-1 border-t border-border/60 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Warnings (do not block payment)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {readiness.warnings.slice(0, 8).map((item) => (
              <span
                key={item.code}
                className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
