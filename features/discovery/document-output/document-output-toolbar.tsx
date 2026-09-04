"use client";

import { ChevronDownIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
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
  /** Render prop so quotation / shortlist keep their trigger styles. */
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
        <DropdownMenuContent align="end" className="w-[296px] p-0">
          <div className="tw-menu" style={{ position: "static", width: "100%", boxShadow: "none" }}>
            <span className="mh">Layout</span>
            {templates.map((option) => {
              const selected = option.id === activeTemplateId;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn("mi", selected && "on")}
                  onClick={() => onTemplateChange(option.id)}
                >
                  <span>
                    <b>{option.label}</b>
                    <u>{option.hint}</u>
                  </span>
                  {selected ? <span className="ck">✓</span> : null}
                </button>
              );
            })}
            <span className="mf">
              <button
                type="button"
                className="tw-b sm pri"
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
        <DropdownMenuContent align="end" className="w-[296px] p-0">
          <div className="tw-menu" style={{ position: "static", width: "100%", boxShadow: "none" }}>
            <span className="mh">
              Download as — {(active?.label ?? "layout").toLowerCase()} layout
            </span>
            {formats.map((format) => (
              <button
                key={format.id}
                type="button"
                className="mi"
                disabled={busy}
                onClick={() => onExport(format.id)}
              >
                <span className={cn("fm", format.kind)}>{formatBadge(format.label)}</span>
                <span>
                  <b>{format.label}</b>
                  <u>{format.purpose}</u>
                </span>
              </button>
            ))}
            <span className="mn">
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
