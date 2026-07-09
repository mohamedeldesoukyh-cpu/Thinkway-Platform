"use client";

import type { ReactNode } from "react";
import { BugIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { isCampaignIntelligencePipelineDebugEnabled } from "@/lib/campaign-intelligence/pipeline-debug-flag";

import type { CampaignIntelligenceProfile } from "../types/profile";
import type { StructuredBriefBlock, StructuredBriefSection } from "../services/structured-brief-parser/types";
import {
  buildPipelineSummary,
  computeDiscoveryNotGenerated,
  evidenceLevelLabel,
  formatFilterRow,
  parseDiscoverySkippedEntry,
  parseRawLlmJson,
  resolveParserModeInfo,
  severityClass,
} from "./pipeline-inspector-utils";

type Props = {
  profile: CampaignIntelligenceProfile;
  className?: string;
};

function JsonBlock({
  value,
  maxHeight = "max-h-96",
  className,
}: {
  value: unknown;
  maxHeight?: string;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "overflow-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words",
        maxHeight,
        className
      )}
    >
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

function DebugSection({
  title,
  summary,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-lg border border-border/80 bg-card"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-2">
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
            <span>{title}</span>
            {badge}
          </span>
          {summary ? (
            <span className="max-w-[55%] truncate text-right text-xs font-normal text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </span>
      </summary>
      <div className="space-y-3 border-t border-border/60 px-3 py-3">{children}</div>
    </details>
  );
}

function SubSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-md border border-border/60 bg-muted/10">
      <summary className="cursor-pointer px-2.5 py-2 text-xs font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="border-t border-border/50 px-2.5 py-2">{children}</div>
    </details>
  );
}

function KeyValueTable({ rows }: { rows: Array<{ key: string; value: string }> }) {
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">None</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/60 bg-muted/30">
            <th className="px-2 py-1.5 font-medium">Field</th>
            <th className="px-2 py-1.5 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.key}-${row.value}`} className="border-b border-border/40 last:border-0">
              <td className="whitespace-nowrap px-2 py-1.5 align-top text-muted-foreground">{row.key}</td>
              <td className="px-2 py-1.5 align-top break-words">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block: StructuredBriefBlock, index: number) {
  switch (block.type) {
    case "heading":
      return (
        <p key={index} className="text-xs font-semibold">
          H{block.level}: {block.text}
        </p>
      );
    case "paragraph":
      return (
        <p key={index} className="text-xs leading-relaxed text-foreground">
          {block.text}
        </p>
      );
    case "list":
      return (
        <ul key={index} className="list-inside list-disc text-xs">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div key={index} className="overflow-x-auto rounded border border-border/60">
          <table className="w-full text-xs">
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/40 last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "px-2 py-1 align-top",
                        cellIndex === 0 ? "font-medium text-muted-foreground" : "break-words"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

function StructuredDocumentView({ document }: { document: NonNullable<Props["profile"]["pipelineDebug"]>["structuredParserOutput"] }) {
  if (!document) return null;

  return (
    <div className="space-y-3">
      {document.title ? (
        <p className="text-xs">
          <span className="font-medium text-muted-foreground">Title:</span> {document.title}
        </p>
      ) : null}
      {document.sections.map((section: StructuredBriefSection, sectionIndex: number) => (
        <SubSection
          key={sectionIndex}
          title={`Section ${sectionIndex + 1}${section.title ? `: ${section.title}` : ""} (${section.blocks.length} blocks)`}
        >
          <div className="space-y-2">{section.blocks.map((block, blockIndex) => renderBlock(block, blockIndex))}</div>
        </SubSection>
      ))}
    </div>
  );
}

function PipelineSummaryCard({ debug }: { debug: NonNullable<Props["profile"]["pipelineDebug"]> }) {
  const summary = buildPipelineSummary(debug);
  const parserCategory = summary.parserInfo.category === "structured" ? "Structured" : "Fallback";

  return (
    <Card size="sm" className="rounded-xl border-amber-300/40 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BugIcon className="size-4 text-amber-600" />
          Pipeline summary
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryItem
          label="Parser mode"
          value={summary.parserInfo.label}
          detail={summary.parserInfo.description}
          variant={summary.parserInfo.category === "structured" ? "success" : "warning"}
        />
        <SummaryItem
          label="Extraction mode"
          value={summary.extractionMode === "llm" ? "LLM" : "Heuristic"}
          detail={summary.extractionModeReason}
          variant={summary.extractionMode === "llm" ? "success" : "warning"}
        />
        <SummaryItem label="Brief text source" value={debug.briefTextSource} />
        <SummaryItem label="Accepted fields" value={String(summary.accepted)} />
        <SummaryItem label="Rejected fields" value={String(summary.rejected)} variant={summary.rejected > 0 ? "warning" : "default"} />
        <SummaryItem
          label="Discovery filters"
          value={String(summary.filters)}
          detail={summary.skipped > 0 ? `${summary.skipped} skipped entries` : undefined}
          variant={summary.filters <= 2 ? "warning" : "default"}
        />
        <p className="col-span-full text-[11px] text-muted-foreground">
          Parser category: <strong>{parserCategory}</strong> · Captured{" "}
          {new Date(debug.capturedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function SummaryItem({
  label,
  value,
  detail,
  variant = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  variant?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold",
          variant === "warning" && "text-amber-700 dark:text-amber-400",
          variant === "success" && "text-emerald-700 dark:text-emerald-400"
        )}
      >
        {value}
      </p>
      {detail ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function CampaignIntelligencePipelineInspector({ profile, className }: Props) {
  if (!isCampaignIntelligencePipelineDebugEnabled()) return null;

  const debug = profile.pipelineDebug;
  if (!debug) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-amber-300/60 bg-amber-50/50 px-3 py-2 text-xs text-muted-foreground dark:border-amber-900/50 dark:bg-amber-950/20",
          className
        )}
      >
        <div className="flex items-center gap-2 font-medium text-foreground">
          <BugIcon className="size-3.5 text-amber-600" />
          Pipeline inspector
        </div>
        <p className="mt-1">No pipeline artifacts captured yet. Upload or re-analyze a brief.</p>
      </div>
    );
  }

  const parserInfo = resolveParserModeInfo(debug.structuredParserOutput);
  const rawLlm = parseRawLlmJson(debug.rawLlmResponse);
  const skippedParsed = (debug.discoveryMapping?.skipped ?? []).map(parseDiscoverySkippedEntry);
  const notGenerated = computeDiscoveryNotGenerated(
    debug.validatedIntelligence ?? profile.validatedIntelligence,
    debug.extractedProfile,
    debug.discoveryMapping
  );

  return (
    <div className={cn("space-y-3", className)}>
      <PipelineSummaryCard debug={debug} />

      <DebugSection
        title="1. Structured parser output"
        summary={`${parserInfo.label} · ${debug.structuredParserOutput?.sections.length ?? 0} sections`}
        badge={
          <Badge
            variant={parserInfo.category === "structured" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {parserInfo.category === "structured" ? "Structured" : "Fallback"}
          </Badge>
        }
        defaultOpen
      >
        <p className="text-xs text-muted-foreground">{parserInfo.description}</p>
        <SubSection title="Document blocks (human-readable)">
          {debug.structuredParserOutput ? (
            <StructuredDocumentView document={debug.structuredParserOutput} />
          ) : (
            <p className="text-xs text-muted-foreground">Not captured for this run.</p>
          )}
        </SubSection>
        <SubSection title="Serialized llmBriefText (extractor input)">
          <JsonBlock value={debug.llmPrompt.user.replace(/^Structured campaign brief:\n\n/, "")} />
        </SubSection>
        <SubSection title="Full structured document JSON">
          <JsonBlock value={debug.structuredParserOutput ?? null} maxHeight="max-h-[32rem]" />
        </SubSection>
      </DebugSection>

      <DebugSection
        title="2. Extraction path"
        summary={`${debug.extractionMode === "llm" ? "LLM" : "Heuristic"} · ${debug.llmPrompt.model}`}
        badge={
          <Badge variant={debug.extractionMode === "llm" ? "default" : "secondary"} className="text-[10px]">
            {debug.extractionMode === "llm" ? "LLM" : "Heuristic"}
          </Badge>
        }
      >
        <KeyValueTable
          rows={[
            { key: "Mode", value: debug.extractionMode === "llm" ? "LLM (OpenAI)" : "Heuristic fallback" },
            { key: "Why", value: debug.extractionModeReason ?? "—" },
            { key: "Model", value: debug.llmPrompt.model },
            ...(debug.llmParseError ? [{ key: "Parse error", value: debug.llmParseError }] : []),
          ]}
        />
        <SubSection title="System prompt">
          <JsonBlock value={debug.llmPrompt.system} maxHeight="max-h-64" />
        </SubSection>
        <SubSection title="User prompt (exact text sent)">
          <JsonBlock value={debug.llmPrompt.user} maxHeight="max-h-[28rem]" />
        </SubSection>
      </DebugSection>

      <DebugSection
        title="3. Raw LLM JSON response"
        summary={debug.rawLlmResponse ? "present" : "missing — heuristic path"}
      >
        {debug.rawLlmResponse ? (
          <>
            {rawLlm.parsed != null ? (
              <SubSection title="Parsed JSON (pretty)">
                <JsonBlock value={rawLlm.parsed} maxHeight="max-h-[32rem]" />
              </SubSection>
            ) : (
              <p className="text-xs text-destructive">JSON parse error: {rawLlm.error}</p>
            )}
            <SubSection title="Raw response string">
              <JsonBlock value={debug.rawLlmResponse} maxHeight="max-h-[32rem]" />
            </SubSection>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No LLM response — heuristic extractor ran instead. See section 2 for the reason.
          </p>
        )}
      </DebugSection>

      <DebugSection title="4. Extracted profile (pre-normalize)">
        <p className="text-xs text-muted-foreground">
          Direct output from the extractor before normalization. Check brandName and creator fields here for
          concatenation or missing values.
        </p>
        <SubSection title="Key Discovery-relevant fields">
          <KeyValueTable
            rows={[
              { key: "brandName", value: debug.extractedProfile.brandName ?? "—" },
              { key: "market", value: debug.extractedProfile.market ?? "—" },
              { key: "platforms", value: (debug.extractedProfile.platforms ?? []).join(", ") || "—" },
              {
                key: "creatorCategories",
                value: (debug.extractedProfile.creatorCategories ?? []).join(", ") || "—",
              },
              { key: "creatorNiches", value: (debug.extractedProfile.creatorNiches ?? []).join(", ") || "—" },
              { key: "audience", value: debug.extractedProfile.audience ?? "—" },
              {
                key: "audienceDetail",
                value: debug.extractedProfile.audienceDetail
                  ? JSON.stringify(debug.extractedProfile.audienceDetail)
                  : "—",
              },
            ]}
          />
        </SubSection>
        <SubSection title="Full extracted profile JSON">
          <JsonBlock value={debug.extractedProfile} maxHeight="max-h-[32rem]" />
        </SubSection>
      </DebugSection>

      <DebugSection title="5. Normalized object">
        <SubSection title="Normalized entities (human-readable)">
          <KeyValueTable
            rows={[
              { key: "brand.brandName", value: debug.normalizedEntities?.brand.brandName ?? "—" },
              {
                key: "market",
                value:
                  debug.normalizedEntities?.market.countryLabel ??
                  debug.normalizedEntities?.market.countryCode ??
                  "—",
              },
              {
                key: "platforms",
                value: (debug.normalizedEntities?.platforms ?? []).join(", ") || "—",
              },
              {
                key: "categories",
                value: (debug.normalizedEntities?.categories ?? []).join(", ") || "—",
              },
              {
                key: "keywords",
                value: (debug.normalizedEntities?.keywords ?? []).join(", ") || "—",
              },
              {
                key: "audience",
                value: debug.normalizedEntities?.audience
                  ? `countries: ${debug.normalizedEntities.audience.countries.join(", ") || "—"}; gender: ${debug.normalizedEntities.audience.gender ?? "—"}; age: ${debug.normalizedEntities.audience.ageMin ?? "?"}–${debug.normalizedEntities.audience.ageMax ?? "?"}`
                  : "—",
              },
            ]}
          />
        </SubSection>
        <SubSection title="Full normalized entities JSON">
          <JsonBlock value={debug.normalizedEntities ?? null} maxHeight="max-h-[32rem]" />
        </SubSection>
      </DebugSection>

      <DebugSection
        title="6. Validation report"
        summary={`${debug.validation.accepted.length} accepted · ${debug.validation.rejected.length} rejected`}
      >
        <SubSection title={`Accepted fields (${debug.validation.accepted.length})`}>
          {debug.validation.accepted.length === 0 ? (
            <p className="text-xs text-muted-foreground">No fields passed validation with values.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-2 py-1.5 font-medium">Field</th>
                    <th className="px-2 py-1.5 font-medium">Value</th>
                    <th className="px-2 py-1.5 font-medium">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {debug.validation.accepted.map((row) => (
                    <tr key={row.key} className="border-b border-border/40 last:border-0">
                      <td className="px-2 py-1.5 align-top text-muted-foreground">{row.label}</td>
                      <td className="px-2 py-1.5 align-top break-words">{row.value}</td>
                      <td className="px-2 py-1.5 align-top text-muted-foreground">{evidenceLevelLabel(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SubSection>
        <SubSection title={`Rejected fields (${debug.validation.rejected.length})`}>
          {debug.validation.rejected.length === 0 ? (
            <p className="text-xs text-muted-foreground">No validation rejections.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-2 py-1.5 font-medium">Field</th>
                    <th className="px-2 py-1.5 font-medium">Raw value</th>
                    <th className="px-2 py-1.5 font-medium">Reason</th>
                    <th className="px-2 py-1.5 font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {debug.validation.rejected.map((issue, index) => (
                    <tr key={`${issue.field}-${index}`} className="border-b border-border/40 last:border-0">
                      <td className="px-2 py-1.5 align-top text-muted-foreground">{issue.field}</td>
                      <td className="px-2 py-1.5 align-top break-words font-mono text-[10px]">{issue.rawValue}</td>
                      <td className="px-2 py-1.5 align-top break-words">{issue.reason}</td>
                      <td className={cn("px-2 py-1.5 align-top", severityClass(issue.severity))}>
                        {issue.severity}
                        {issue.kind ? ` (${issue.kind})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SubSection>
      </DebugSection>

      <DebugSection title="7. Final validatedCampaignIntelligence">
        <SubSection title="SSOT summary">
          <KeyValueTable
            rows={[
              {
                key: "brand",
                value: debug.validatedIntelligence?.brand.brandName ?? profile.validatedIntelligence?.brand.brandName ?? "—",
              },
              {
                key: "market",
                value:
                  debug.validatedIntelligence?.market.countryLabel ??
                  debug.validatedIntelligence?.market.countryCode ??
                  "—",
              },
              {
                key: "platforms",
                value: (debug.validatedIntelligence?.platforms ?? []).join(", ") || "—",
              },
              {
                key: "categories",
                value: (debug.validatedIntelligence?.categories ?? []).join(", ") || "—",
              },
              {
                key: "keywords",
                value: (debug.validatedIntelligence?.keywords ?? []).join(", ") || "—",
              },
            ]}
          />
        </SubSection>
        <SubSection title="Full validatedCampaignIntelligence JSON">
          <JsonBlock
            value={debug.validatedIntelligence ?? profile.validatedIntelligence ?? null}
            maxHeight="max-h-[32rem]"
          />
        </SubSection>
      </DebugSection>

      <DebugSection
        title="8. Discovery mapping"
        summary={`${debug.discoveryMapping?.filters.length ?? 0} filters · ${skippedParsed.length} skipped`}
      >
        <SubSection title={`Accepted filters (${debug.discoveryMapping?.filters.length ?? 0})`}>
          {debug.discoveryMapping?.filters.length ? (
            <ul className="space-y-1 text-xs">
              {debug.discoveryMapping.filters.map((filter) => (
                <li key={filter.id} className="rounded border border-border/50 bg-muted/20 px-2 py-1">
                  {formatFilterRow(filter)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">No Discovery filters generated.</p>
          )}
        </SubSection>
        <SubSection title={`Skipped (${skippedParsed.length})`}>
          {skippedParsed.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing skipped.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-2 py-1.5 font-medium">Field</th>
                    <th className="px-2 py-1.5 font-medium">Value</th>
                    <th className="px-2 py-1.5 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {skippedParsed.map((row) => (
                    <tr key={row.raw} className="border-b border-border/40 last:border-0">
                      <td className="px-2 py-1.5 align-top text-muted-foreground">{row.field}</td>
                      <td className="px-2 py-1.5 align-top break-words font-mono text-[10px]">{row.value || "—"}</td>
                      <td className="px-2 py-1.5 align-top">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SubSection>
        <SubSection title={`Not generated (${notGenerated.length})`}>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Fields expected for Discovery but absent from filters — often because earlier stages cleared or
            never extracted them.
          </p>
          {notGenerated.length === 0 ? (
            <p className="text-xs text-muted-foreground">No obvious gaps detected.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-2 py-1.5 font-medium">Field</th>
                    <th className="px-2 py-1.5 font-medium">Source value</th>
                    <th className="px-2 py-1.5 font-medium">Why no filter</th>
                  </tr>
                </thead>
                <tbody>
                  {notGenerated.map((row) => (
                    <tr key={`${row.field}-${row.sourceValue}`} className="border-b border-border/40 last:border-0">
                      <td className="px-2 py-1.5 align-top text-muted-foreground">{row.field}</td>
                      <td className="px-2 py-1.5 align-top break-words">{row.sourceValue}</td>
                      <td className="px-2 py-1.5 align-top">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SubSection>
        <SubSection title="Full discovery mapping JSON">
          <JsonBlock value={debug.discoveryMapping ?? null} maxHeight="max-h-64" />
        </SubSection>
      </DebugSection>
    </div>
  );
}
