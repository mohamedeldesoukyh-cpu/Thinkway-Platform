import {
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  GitCompareIcon,
  HistoryIcon,
  LayersIcon,
  Loader2Icon,
  RefreshCwIcon,
  Share2Icon,
  ZapIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { OutputView } from "../output-registry";
import { formatEstimatedTime, formatOrigin, formatRelativeTime, formatSize } from "./output-format";
import { OUTPUTS_CLASSES } from "../constants/outputs-center-tokens";

export type OutputCardActions = {
  onOpen?: (kind: OutputView["kind"]) => void;
  onPreview?: (kind: OutputView["kind"]) => void;
  onRegenerate?: (kind: OutputView["kind"]) => void;
  onExport?: (kind: OutputView["kind"]) => void;
  onShare?: (kind: OutputView["kind"]) => void;
  onCompare?: (kind: OutputView["kind"]) => void;
  onHistory?: (kind: OutputView["kind"]) => void;
};

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={OUTPUTS_CLASSES.metaItem}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatusLine({
  status,
  versionLabel,
  operation,
  isGenerating,
  isGenerated,
}: {
  status: OutputView["status"];
  versionLabel: string;
  operation?: OutputView["operation"];
  isGenerating: boolean;
  isGenerated: boolean;
}) {
  if (isGenerating) {
    return (
      <div className="oc-status-line">
        <span className="s-left">
          <Loader2Icon className="size-3 animate-spin text-[#0057FF]" aria-hidden />
          {isGenerated ? "Regenerating…" : "Generating…"}
        </span>
      </div>
    );
  }

  const opLabel =
    operation === "revise"
      ? "Revised"
      : operation === "regenerate"
        ? "Regenerated"
        : operation === "restore"
          ? "Restored"
          : null;

  if (status === "generated") {
    return (
      <div className="oc-status-line">
        <span className="s-left">
          <span className="oc-status-dot green" />
          {opLabel ? `${opLabel} · up to date` : "Up to date"}
        </span>
        <span className="oc-ver-chip">{versionLabel}</span>
      </div>
    );
  }

  if (status === "needs_update") {
    return (
      <div className="oc-status-line">
        <span className="s-left">
          <span className="oc-status-dot amber" />
          Needs Update
        </span>
        <span className="oc-ver-chip">{versionLabel}</span>
      </div>
    );
  }

  return (
    <div className="oc-status-line">
      <span className="s-left">
        <span className="oc-status-dot grey" />
        Not Generated
      </span>
    </div>
  );
}

function ActionIcon({
  label,
  icon: Icon,
  onClick,
  disabled,
  primary,
  ghost,
  loading,
}: {
  label: string;
  icon: typeof EyeIcon;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  ghost?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick || loading}
      className={cn(
        OUTPUTS_CLASSES.aicon,
        primary && OUTPUTS_CLASSES.aiconPrimary,
        ghost && OUTPUTS_CLASSES.aiconGhost
      )}
    >
      {loading ? <Loader2Icon className="animate-spin" /> : <Icon />}
      {label}
    </button>
  );
}

function CornerBadge({
  children,
  tone,
}: {
  children: string;
  tone: "active" | "soon" | "media";
}) {
  return (
    <span className={cn(OUTPUTS_CLASSES.cornerBadge, tone)}>
      {children}
    </span>
  );
}

/**
 * A rich Campaign Output card for the Outputs Center — reference ocard layout.
 */
export function OutputCard({
  output,
  actions,
  isGenerating = false,
}: {
  output: OutputView;
  actions?: OutputCardActions;
  isGenerating?: boolean;
  compact?: boolean;
}) {
  const isGenerated = output.status !== "not_generated";
  const hasHistory = output.version > 1;
  const isMediaPlan = output.kind === "media_plan";
  const generateLabel = isGenerated ? "Regenerate" : "Generate";
  const linkedOutput = Boolean(output.linkedOutputKind);
  const isSoon = !output.generatable && !linkedOutput;

  return (
    <div className={OUTPUTS_CLASSES.ocard} aria-busy={isGenerating}>
      <div className={OUTPUTS_CLASSES.ocardTop}>
        <div className="oc-ocard-title-row">
          <h3>{output.label}</h3>
          {!output.generatable ? (
            <CornerBadge tone={linkedOutput ? "media" : "soon"}>
              {linkedOutput ? "In Media Plan" : "Soon"}
            </CornerBadge>
          ) : null}
        </div>

        <p className="oc-ocard-desc">{output.description}</p>

        <StatusLine
          status={output.status}
          versionLabel={output.versionLabel}
          operation={output.operation}
          isGenerating={isGenerating}
          isGenerated={isGenerated}
        />

        <div className={OUTPUTS_CLASSES.metaGrid}>
          <MetaItem label="Last updated" value={formatRelativeTime(output.updatedAt)} />
          <MetaItem
            label="Generator"
            value={output.generatorVersion ? `v${output.generatorVersion}` : "—"}
          />
          <MetaItem label="Generated by" value={isGenerated ? formatOrigin(output.origin) : "—"} />
          {isGenerated && output.changeSummary ? (
            <MetaItem label="Last change" value={output.changeSummary} />
          ) : (
            <MetaItem label="Est. time" value={formatEstimatedTime(output.estimatedGenerationMs)} />
          )}
          <MetaItem label="Size" value={isGenerated ? formatSize(output.sizeBytes) : "—"} />
        </div>
        {isMediaPlan && isGenerated ? (
          <p className="oc-source-label mt-1 text-[10px] text-muted-foreground">
            Revise (timeline/slots) keeps structure · Regenerate creates a new major version
          </p>
        ) : null}

        <p className="oc-source-label">
          <LayersIcon aria-hidden />
          Source data
        </p>
        <div className="oc-tag-row">
          {output.sourceData.map((source) => (
            <span key={source} className={OUTPUTS_CLASSES.stag}>
              {source}
            </span>
          ))}
        </div>
      </div>

      <div className={OUTPUTS_CLASSES.ocardActions}>
        {isGenerated ? (
          <>
            <div className="oc-action-row">
              <ActionIcon
                label="Open"
                icon={ExternalLinkIcon}
                onClick={actions?.onOpen && (() => actions.onOpen!(output.kind))}
                disabled={isGenerating}
                primary
              />
              <ActionIcon
                label="Preview"
                icon={EyeIcon}
                onClick={actions?.onPreview && (() => actions.onPreview!(output.kind))}
                disabled={isGenerating}
              />
              <ActionIcon
                label={generateLabel}
                icon={RefreshCwIcon}
                onClick={actions?.onRegenerate && (() => actions.onRegenerate!(output.kind))}
                disabled={!output.generatable || isGenerating}
                loading={isGenerating}
              />
              <ActionIcon
                label="Export"
                icon={DownloadIcon}
                onClick={actions?.onExport && (() => actions.onExport!(output.kind))}
                disabled={isGenerating}
              />
              <ActionIcon
                label="Share"
                icon={Share2Icon}
                onClick={actions?.onShare && (() => actions.onShare!(output.kind))}
                disabled={isGenerating}
              />
            </div>
            <div className="oc-action-row">
              <ActionIcon
                label="Compare"
                icon={GitCompareIcon}
                onClick={actions?.onCompare && (() => actions.onCompare!(output.kind))}
                disabled={!hasHistory || isGenerating}
                ghost
              />
              <ActionIcon
                label="History"
                icon={HistoryIcon}
                onClick={actions?.onHistory && (() => actions.onHistory!(output.kind))}
                disabled={!hasHistory || isGenerating}
                ghost
              />
            </div>
          </>
        ) : linkedOutput ? (
          <button
            type="button"
            onClick={actions?.onOpen && (() => actions.onOpen!(output.kind))}
            disabled={isGenerating || !actions?.onOpen}
            className={OUTPUTS_CLASSES.fullBtn}
          >
            <ExternalLinkIcon aria-hidden />
            Open in Media Plan
          </button>
        ) : (
          <button
            type="button"
            onClick={actions?.onRegenerate && (() => actions.onRegenerate!(output.kind))}
            disabled={!output.generatable || isGenerating || isSoon}
            className={cn(OUTPUTS_CLASSES.fullBtn, isSoon && OUTPUTS_CLASSES.fullBtnSoon)}
          >
            {isGenerating ? (
              <Loader2Icon className="animate-spin" aria-hidden />
            ) : (
              <ZapIcon aria-hidden />
            )}
            {generateLabel}
          </button>
        )}
      </div>
    </div>
  );
}
