"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVerticalIcon, LayersIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignOutputContent, CampaignOutputGroup, CampaignOutputKind } from "../output-types";
import type { OutputView } from "../output-registry";
import { OUTPUT_GROUPS } from "../output-catalog";
import { OutputCard, type OutputCardActions } from "./output-card";
import { OutputViewer } from "./output-viewer";
import { OutputDocumentPreview } from "./output-document-preview";
import { MediaPlanExportActions } from "./media-plan-export-actions";
import { useDraggablePanel } from "../hooks/use-draggable-panel";
import { resolveMediaPlanContextForPreview } from "../actions/resolve-media-plan-context";
import type { MediaPlanCampaignContext } from "../generators/media-plan";

export type OutputsCenterProps = {
  /** All output views (any order) — grouped internally by the metadata-driven group. */
  outputs: OutputView[];
  /** Output currently being generated/regenerated via Copilot. */
  generatingKind?: CampaignOutputKind | null;
  /** Resolve the rendered content for the Open/Preview panel. */
  getContent?: (kind: OutputView["kind"]) => CampaignOutputContent | undefined;
  /** Required for Media Plan file export from the preview panel. */
  campaignObjectId?: string;
  conversationId?: string;
  actions?: OutputCardActions;
  className?: string;
};

type PanelState = {
  kind: OutputView["kind"];
  mode: "open" | "preview";
};

/**
 * The Campaign Outputs Center — a first-class platform page. An asset library
 * for the campaign: every generated artifact as a rich card, grouped by the
 * metadata-driven Strategy / Planning / Client / Internal buckets, with an
 * inline preview panel. It consumes outputs (derived from the Campaign Object);
 * it never owns campaign data.
 */
export function OutputsCenter({
  outputs,
  generatingKind,
  getContent,
  campaignObjectId,
  conversationId,
  actions,
  className,
}: OutputsCenterProps) {
  const [panel, setPanel] = useState<PanelState | null>(null);

  const grouped = useMemo(() => {
    const order = OUTPUT_GROUPS.map((g) => g.group);
    const labelOf = new Map(OUTPUT_GROUPS.map((g) => [g.group, g.label] as const));
    return order
      .map((group: CampaignOutputGroup) => ({
        group,
        label: labelOf.get(group) ?? group,
        outputs: outputs.filter((o) => o.group === group),
      }))
      .filter((section) => section.outputs.length > 0);
  }, [outputs]);

  const counts = useMemo(() => {
    const generated = outputs.filter((o) => o.status !== "not_generated").length;
    const stale = outputs.filter((o) => o.status === "needs_update").length;
    return { generated, stale, total: outputs.length };
  }, [outputs]);

  const panelContent = useMemo(() => {
    if (!panel || !getContent) return undefined;
    return getContent(panel.kind);
  }, [panel?.kind, panel?.mode, getContent]);

  const [liveMediaPlanContext, setLiveMediaPlanContext] = useState<
    MediaPlanCampaignContext | undefined
  >();

  useEffect(() => {
    if (panel?.kind !== "media_plan" || !campaignObjectId) {
      setLiveMediaPlanContext(undefined);
      return;
    }

    let cancelled = false;
    void resolveMediaPlanContextForPreview({
      campaignObjectId,
      conversationId,
    }).then((context) => {
      if (!cancelled) setLiveMediaPlanContext(context);
    });

    return () => {
      cancelled = true;
    };
  }, [panel?.kind, campaignObjectId, conversationId]);

  const mergedActions = useMemo<OutputCardActions>(
    () => ({
      ...actions,
      onOpen: (kind) => {
        setPanel({ kind, mode: "open" });
        actions?.onOpen?.(kind);
      },
      onPreview: (kind) => {
        setPanel({ kind, mode: "preview" });
        actions?.onPreview?.(kind);
      },
    }),
    [actions]
  );

  const isMediaPlanPanel = panel?.kind === "media_plan";
  const isFloatingPreview = panel?.mode === "preview" || isMediaPlanPanel;
  const { offset, dragHandleProps } = useDraggablePanel(Boolean(panel && isFloatingPreview));

  useEffect(() => {
    if (!panel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panel]);

  return (
    <div className={cn("relative flex h-full min-h-0 flex-col bg-background", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
            <LayersIcon className="size-4 text-white" />
          </span>
          <div>
            <h1 className="text-base font-bold text-foreground">Campaign Outputs Center</h1>
            <p className="text-[11px] text-muted-foreground">
              {counts.generated} generated · {counts.stale} need update · {counts.total} available
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-8">
          {grouped.map((section) => (
            <section key={section.group}>
              <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {section.label}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {section.outputs.map((output) => (
                  <OutputCard
                    key={output.kind}
                    output={output}
                    actions={mergedActions}
                    isGenerating={generatingKind === output.kind}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {panel && isFloatingPreview ? (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/30"
            onClick={() => setPanel(null)}
          />
          <div
            className={cn(
              "fixed left-1/2 top-16 z-[61] flex w-[min(1120px,96vw)] flex-col rounded-xl border border-border bg-background shadow-2xl",
              !isMediaPlanPanel && "max-w-4xl"
            )}
            style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="flex cursor-grab touch-none items-center justify-between border-b border-border bg-background/95 px-3 py-3 backdrop-blur active:cursor-grabbing sm:px-5"
              {...dragHandleProps}
            >
              <div className="flex min-w-0 items-center gap-2">
                <GripVerticalIcon
                  className="size-4 shrink-0 text-muted-foreground/70"
                  aria-hidden
                />
                <span className="truncate text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {panel.mode === "preview" ? "Document Preview" : "Media Plan"}
                  {isMediaPlanPanel ? " · Landscape" : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2" data-no-drag>
                {isMediaPlanPanel && campaignObjectId ? (
                  <MediaPlanExportActions
                    campaignObjectId={campaignObjectId}
                    conversationId={conversationId}
                    disabled={!panelContent}
                  />
                ) : null}
                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setPanel(null)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto">
              {panelContent ? (
                panel.mode === "preview" ? (
                  <OutputDocumentPreview
                    content={panelContent}
                    mediaPlanContextOverride={liveMediaPlanContext}
                  />
                ) : (
                  <div className="p-5">
                    <OutputViewer
                      content={panelContent}
                      mediaPlanContextOverride={liveMediaPlanContext}
                    />
                  </div>
                )
              ) : (
                <p className="p-8 text-sm text-muted-foreground">
                  This output hasn&apos;t been generated yet. Generate it to preview.
                </p>
              )}
            </div>
          </div>
        </>
      ) : panel ? (
        <div
          className="absolute inset-0 z-30 flex justify-end bg-black/30"
          onClick={() => setPanel(null)}
        >
            <div
              className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Open
                </span>
                <button
                  type="button"
                  aria-label="Close panel"
                  onClick={() => setPanel(null)}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <XIcon className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {panelContent ? (
                  <OutputViewer content={panelContent} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This output hasn&apos;t been generated yet. Generate it to preview.
                  </p>
                )}
              </div>
            </div>
        </div>
      ) : null}
    </div>
  );
}
