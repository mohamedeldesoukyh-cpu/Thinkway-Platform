"use client";

import { ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type DocumentOutputTemplateOption = {
  id: string;
  label: string;
  hint: string;
};

export type DocumentOutputFormatOption = {
  id: string;
  label: string;
  /** Purpose line under the format name (pack Overlay F). */
  purpose: string;
  /** Badge colour: doc red · sheet green · web blue. */
  kind: "doc" | "sheet" | "web";
};

type TriggerRenderProps = {
  children: React.ReactNode;
  disabled?: boolean;
  /** When true, adapter should use primary/glow styling (Send). */
  primary?: boolean;
  onClick?: () => void;
};

export type DocumentOutputToolbarProps = {
  templates: DocumentOutputTemplateOption[];
  activeTemplateId: string;
  onTemplateChange: (id: string) => void;
  /** Opens preview for the active layout (selection / window.open owned by adapter). */
  onOpenPreview: () => void;
  formats: DocumentOutputFormatOption[];
  onExport: (formatId: string) => void;
  onClientLink: () => void;
  onSend: () => void;
  clientLinkLabel?: string;
  sendLabel?: string;
  busy?: boolean;
  linkDisabled?: boolean;
  sendDisabled?: boolean;
  /**
   * Render prop so page adapters keep their trigger styles.
   * Export formats are supplied by the adapter (`formats`) — this chrome never
   * branches on product type (CSV etc. are capability lists, not product ifs).
   */
  renderTrigger: (props: TriggerRenderProps) => React.ReactElement;
  className?: string;
};

function formatBadge(label: string) {
  return label.slice(0, 3).toUpperCase();
}

/**
 * Overlay F chrome — Preview · layout · Export · Client link · Send.
 * Adapters own selection dialogs, hrefs, and share/send side effects.
 */
export function DocumentOutputToolbar({
  templates,
  activeTemplateId,
  onTemplateChange,
  onOpenPreview,
  formats,
  onExport,
  onClientLink,
  onSend,
  clientLinkLabel = "Client link",
  sendLabel = "Send to client",
  busy,
  linkDisabled,
  sendDisabled,
  renderTrigger,
  className,
}: DocumentOutputToolbarProps) {
  const active =
    templates.find((option) => option.id === activeTemplateId) ?? templates[0];

  return (
    <div className={cn("discovery-suite flex flex-wrap items-center gap-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={busy}>
          {renderTrigger({
            disabled: busy,
            children: (
              <>
                Preview · {active?.label ?? "Layout"}
                <ChevronDownIcon className="size-3 opacity-70" />
              </>
            ),
          })}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] max-w-[calc(100vw-24px)] p-1">
          <div className="text-left text-sm">
            <span className="block px-3 py-2 text-xs font-semibold text-muted-foreground">Layout</span>
            {templates.map((option) => {
              const selected = option.id === activeTemplateId;
              return (
                <DropdownMenuItem
                  key={option.id}
                  className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left", selected && "bg-primary/10")}
                  onSelect={(event) => { event.preventDefault(); onTemplateChange(option.id); }}
                >
                  <span>
                    <b className="block text-sm font-semibold">{option.label}</b>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                  {selected ? <span className="ml-auto text-primary">✓</span> : null}
                </DropdownMenuItem>
              );
            })}
            <span className="block border-t p-2">
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                style={{ width: "100%" }}
                disabled={busy}
                onClick={onOpenPreview}
              >
                Open preview
              </button>
            </span>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={busy}>
          {renderTrigger({
            disabled: busy,
            children: (
              <>
                Export
                <ChevronDownIcon className="size-3 opacity-70" />
              </>
            ),
          })}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[320px] max-w-[calc(100vw-24px)] p-1">
          <div className="text-left text-sm">
            <span className="block px-3 py-2 text-xs font-semibold text-muted-foreground">
              Download as — {(active?.label ?? "layout").toLowerCase()} layout
            </span>
            {formats.map((format) => (
              <DropdownMenuItem
                key={format.id}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                disabled={busy}
                onSelect={() => onExport(format.id)}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-[10px] font-bold", format.kind === "sheet" ? "bg-emerald-50 text-emerald-700" : format.kind === "web" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700")}>{formatBadge(format.label)}</span>
                <span>
                  <b className="block text-sm font-semibold">{format.label}</b>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{format.purpose}</span>
                </span>
              </DropdownMenuItem>
            ))}
            <span className="block border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Exports use the layout above. Change it in <b>Preview</b> first if this is going to a
              client.
            </span>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {renderTrigger({
        disabled: busy || linkDisabled,
        onClick: onClientLink,
        children: clientLinkLabel,
      })}

      {renderTrigger({
        disabled: busy || sendDisabled,
        primary: true,
        onClick: onSend,
        children: sendLabel,
      })}
    </div>
  );
}
