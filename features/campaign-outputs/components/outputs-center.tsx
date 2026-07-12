"use client";

import { useMemo, useState } from "react";
import { LayersIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CampaignOutputContent, CampaignOutputGroup } from "../output-types";
import type { OutputView } from "../output-registry";
import { OUTPUT_GROUPS } from "../output-catalog";
import { OutputCard, type OutputCardActions } from "./output-card";
import { OutputViewer } from "./output-viewer";

export type OutputsCenterProps = {
  /** All output views (any order) — grouped internally by the metadata-driven group. */
  outputs: OutputView[];
  /** Resolve the rendered content for the Open/Preview panel. */
  getContent?: (kind: OutputView["kind"]) => CampaignOutputContent | undefined;
  actions?: OutputCardActions;
  className?: string;
};

/**
 * The Campaign Outputs Center — a first-class platform page. An asset library
 * for the campaign: every generated artifact as a rich card, grouped by the
 * metadata-driven Strategy / Planning / Client / Internal buckets, with an
 * inline preview panel. It consumes outputs (derived from the Campaign Object);
 * it never owns campaign data.
 */
export function OutputsCenter({ outputs, getContent, actions, className }: OutputsCenterProps) {
  const [openKind, setOpenKind] = useState<OutputView["kind"] | null>(null);

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

  const openContent = openKind ? getContent?.(openKind) : undefined;

  const mergedActions: OutputCardActions = {
    ...actions,
    onOpen: (kind) => {
      setOpenKind(kind);
      actions?.onOpen?.(kind);
    },
    onPreview: (kind) => {
      setOpenKind(kind);
      actions?.onPreview?.(kind);
    },
  };

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
                  <OutputCard key={output.kind} output={output} actions={mergedActions} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {openKind ? (
        <div className="absolute inset-0 z-30 flex justify-end bg-black/30" onClick={() => setOpenKind(null)}>
          <div
            className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Preview
              </span>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setOpenKind(null)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {openContent ? (
                <OutputViewer content={openContent} />
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
