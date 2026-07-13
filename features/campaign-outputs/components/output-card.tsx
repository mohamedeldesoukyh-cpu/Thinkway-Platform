import {
  ClockIcon,
  DownloadIcon,
  EyeIcon,
  GitCompareIcon,
  HistoryIcon,
  Loader2Icon,
  RefreshCwIcon,
  Share2Icon,
  SparklesIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { OutputView } from "../output-registry";
import { OutputStatusBadge } from "./output-status-badge";
import { formatEstimatedTime, formatOrigin, formatRelativeTime, formatSize } from "./output-format";

export type OutputCardActions = {
  onOpen?: (kind: OutputView["kind"]) => void;
  onPreview?: (kind: OutputView["kind"]) => void;
  onRegenerate?: (kind: OutputView["kind"]) => void;
  onExport?: (kind: OutputView["kind"]) => void;
  onShare?: (kind: OutputView["kind"]) => void;
  onCompare?: (kind: OutputView["kind"]) => void;
  onHistory?: (kind: OutputView["kind"]) => void;
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="truncate text-[11px] font-medium text-foreground/90">{value}</span>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  primary,
  loading,
}: {
  label: string;
  icon: typeof EyeIcon;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick || loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "bg-[#1D9E75] text-white hover:bg-[#178a66]"
          : "border border-border text-foreground/80 hover:bg-muted/60"
      )}
    >
      {loading ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : (
        <Icon className="size-3.5" />
      )}
      {label}
    </button>
  );
}

function GeneratingBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1D9E75]/40 bg-[#1D9E75]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#1D9E75]">
      <Loader2Icon className="size-3 animate-spin" />
      {label}
    </span>
  );
}

/**
 * A rich Campaign Output card for the Outputs Center — the asset-library tile.
 * Shows name, description, status (with precise stale reason), version, and the
 * full metadata block, plus the output's actions.
 */
export function OutputCard({
  output,
  actions,
  isGenerating = false,
}: {
  output: OutputView;
  actions?: OutputCardActions;
  isGenerating?: boolean;
}) {
  const isGenerated = output.status !== "not_generated";
  const hasHistory = output.version > 1;
  const generateLabel = isGenerated ? "Regenerate" : "Generate";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-sm transition-shadow hover:shadow-md",
        isGenerating
          ? "border-[#1D9E75]/50 ring-2 ring-[#1D9E75]/20"
          : "border-border"
      )}
      aria-busy={isGenerating}
    >
      {isGenerating ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-xl bg-[#1D9E75]/15">
          <div className="h-full w-1/3 animate-pulse bg-[#1D9E75]" />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground">{output.label}</h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {output.description}
          </p>
        </div>
        {!output.generatable ? (
          <span className="shrink-0 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
            Soon
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {isGenerating ? (
          <GeneratingBadge label={isGenerated ? "Regenerating…" : "Generating…"} />
        ) : (
          <OutputStatusBadge status={output.status} staleReason={output.staleReason} />
        )}
        {isGenerated && !isGenerating ? (
          <span className="text-[11px] font-semibold text-muted-foreground">v{output.version}</span>
        ) : null}
      </div>

      {isGenerating ? (
        <p className="text-[10px] text-muted-foreground">
          Copilot is building this output
          {output.estimatedGenerationMs
            ? ` · usually ~${formatEstimatedTime(output.estimatedGenerationMs)}`
            : ""}
          …
        </p>
      ) : null}

      {output.status === "needs_update" && output.staleReason && !isGenerating ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          Reason: {output.staleReason}
        </p>
      ) : null}

      <div className="space-y-1 border-y border-border/60 py-2.5">
        <MetaRow label="Last updated" value={formatRelativeTime(output.updatedAt)} />
        <MetaRow label="Generator" value={output.generatorVersion ? `v${output.generatorVersion}` : "—"} />
        <MetaRow label="Generated by" value={isGenerated ? formatOrigin(output.origin) : "—"} />
        <MetaRow label="Est. time" value={formatEstimatedTime(output.estimatedGenerationMs)} />
        {isGenerated ? <MetaRow label="Size" value={formatSize(output.sizeBytes)} /> : null}
      </div>

      <div>
        <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <SparklesIcon className="size-3" /> Source data
        </p>
        <div className="flex flex-wrap gap-1">
          {output.sourceData.map((source) => (
            <span
              key={source}
              className="rounded-full border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {source}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {isGenerated ? (
          <>
            <ActionButton
              label="Open"
              icon={EyeIcon}
              onClick={actions?.onOpen && (() => actions.onOpen!(output.kind))}
              disabled={isGenerating}
              primary
            />
            <ActionButton
              label="Preview"
              icon={EyeIcon}
              onClick={actions?.onPreview && (() => actions.onPreview!(output.kind))}
              disabled={isGenerating}
            />
            <ActionButton
              label={generateLabel}
              icon={RefreshCwIcon}
              onClick={actions?.onRegenerate && (() => actions.onRegenerate!(output.kind))}
              disabled={!output.generatable || isGenerating}
              loading={isGenerating}
            />
            <ActionButton
              label="Export"
              icon={DownloadIcon}
              onClick={actions?.onExport && (() => actions.onExport!(output.kind))}
              disabled={isGenerating}
            />
            <ActionButton
              label="Share"
              icon={Share2Icon}
              onClick={actions?.onShare && (() => actions.onShare!(output.kind))}
              disabled={isGenerating}
            />
            <ActionButton
              label="Compare"
              icon={GitCompareIcon}
              onClick={actions?.onCompare && (() => actions.onCompare!(output.kind))}
              disabled={!hasHistory || isGenerating}
            />
            <ActionButton
              label="History"
              icon={HistoryIcon}
              onClick={actions?.onHistory && (() => actions.onHistory!(output.kind))}
              disabled={!hasHistory || isGenerating}
            />
          </>
        ) : (
          <ActionButton
            label={generateLabel}
            icon={ClockIcon}
            onClick={actions?.onRegenerate && (() => actions.onRegenerate!(output.kind))}
            disabled={!output.generatable || isGenerating}
            loading={isGenerating}
            primary
          />
        )}
      </div>
    </div>
  );
}
