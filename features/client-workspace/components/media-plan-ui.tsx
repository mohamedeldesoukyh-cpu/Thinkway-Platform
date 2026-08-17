import { formatMoneyKpi } from "@/lib/finance/currency-format";

import { formatCompactCount, formatExactCount, NOT_AVAILABLE } from "../format";

export function Panel({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6 ${className}`}>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{eyebrow}</p>
      ) : null}
      {title ? (
        <h2 className={`${eyebrow ? "mt-1" : ""} text-lg font-semibold tracking-tight`}>{title}</h2>
      ) : null}
      <div className={title || eyebrow ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200/80 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 truncate text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "bg-amber-50 text-amber-800"
        : tone === "danger"
          ? "bg-red-50 text-red-800"
          : "bg-zinc-100 text-zinc-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
      {children}
    </span>
  );
}

export function MixBars({ items }: { items: Array<{ label: string; count: number }> }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium">{item.count} {item.label}</span>
            <span className="text-zinc-400">{total > 0 ? Math.round((item.count / total) * 100) : 0}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-[#1D9E75]"
              style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function formatForecastCount(value: number | undefined): string {
  return value != null ? formatCompactCount(value) : NOT_AVAILABLE;
}

export function formatForecastMoney(
  value: number | undefined,
  currency: string
): string {
  return value != null ? formatMoneyKpi(value, currency) : NOT_AVAILABLE;
}

export function formatCreatorCount(value: number): string {
  return formatExactCount(value);
}
