"use client";

import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CLIENT_FORM_INPUT_CLASS,
  CLIENT_FORM_TEXTAREA_CLASS,
  useClientProfilePlatformV6,
} from "@/features/clients/components/client-form-ui";
import { DetailEditBlock } from "@/features/campaigns/components/operational-detail-panel";
import type { ClientIoTerm } from "@/lib/io/client-io-terms";
import { cn } from "@/lib/utils";

type Props = {
  terms: ClientIoTerm[];
  onChange: (terms: ClientIoTerm[]) => void;
  onRecover?: () => void;
  disabled?: boolean;
  showRecover?: boolean;
  description?: string;
};

export function ClientIoTermsEditor({
  terms,
  onChange,
  onRecover,
  disabled = false,
  showRecover = true,
  description,
}: Props) {
  const platformV6 = useClientProfilePlatformV6();

  function updateTerm(index: number, patch: Partial<ClientIoTerm>) {
    onChange(terms.map((term, i) => (i === index ? { ...term, ...patch } : term)));
  }

  function removeTerm(index: number) {
    onChange(terms.filter((_, i) => i !== index));
  }

  function addTerm() {
    onChange([...terms, { title: "", body: "" }]);
  }

  if (platformV6) {
    return (
      <div>
        {description ? (
          <p className="platform-v6-field-hint mb-3">{description}</p>
        ) : null}

        {terms.map((term, index) => (
          <details key={index} className="platform-v6-io-term" open>
            <summary className="platform-v6-io-term-head">
              <span className="platform-v6-io-term-title">
                Term {index + 1}
                {term.title ? ` — ${term.title}` : ""}
              </span>
              <button
                type="button"
                className="platform-v6-io-term-delete"
                onClick={(event) => {
                  event.preventDefault();
                  removeTerm(index);
                }}
                disabled={disabled || terms.length <= 1}
                aria-label={`Remove term ${index + 1}`}
              >
                <Trash2Icon className="size-3.5" strokeWidth={2} />
              </button>
            </summary>
            <div className="platform-v6-io-term-edit">
              <Input
                value={term.title}
                onChange={(e) => updateTerm(index, { title: e.target.value })}
                placeholder="Term title (e.g. Payment)"
                disabled={disabled}
              />
              <Textarea
                value={term.body}
                onChange={(e) => updateTerm(index, { body: e.target.value })}
                placeholder="Describe this term…"
                rows={3}
                disabled={disabled}
              />
            </div>
          </details>
        ))}

        <div className="platform-v6-io-actions">
          <button
            type="button"
            onClick={addTerm}
            disabled={disabled}
            className="platform-v6-btn platform-v6-btn-sm"
          >
            <PlusIcon className="size-3.5" strokeWidth={2.2} />
            Add term
          </button>
          {showRecover && onRecover ? (
            <button
              type="button"
              onClick={onRecover}
              disabled={disabled}
              className="platform-v6-link inline-flex items-center gap-1 text-[11px]"
            >
              <RotateCcwIcon className="size-3" />
              Restore to default
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {description ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}

      <div className="space-y-3">
        {terms.map((term, index) => (
          <div
            key={index}
            className={cn(
              "space-y-2.5 rounded-[12px] border border-border bg-muted p-4",
              "transition-[border-color,box-shadow] focus-within:border-[#0057FF]",
              "focus-within:ring-[3px] focus-within:ring-[#EEF4FF]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Term {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-[30px] rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeTerm(index)}
                disabled={disabled || terms.length <= 1}
                aria-label={`Remove term ${index + 1}`}
              >
                <Trash2Icon className="size-4" strokeWidth={1.8} />
              </Button>
            </div>
            <Input
              value={term.title}
              onChange={(e) => updateTerm(index, { title: e.target.value })}
              placeholder="Term title (e.g. Payment)"
              className={CLIENT_FORM_INPUT_CLASS}
              disabled={disabled}
            />
            <Textarea
              value={term.body}
              onChange={(e) => updateTerm(index, { body: e.target.value })}
              placeholder="Describe this term…"
              rows={3}
              className={cn(CLIENT_FORM_TEXTAREA_CLASS, "min-h-[70px]")}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addTerm}
        disabled={disabled}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-[var(--camp-border)]",
          "px-4 py-2.5 text-[13px] font-semibold text-[var(--camp-blue)] transition-colors",
          "hover:border-[var(--camp-blue)] hover:bg-[var(--camp-blue-light)]",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <PlusIcon className="size-[15px]" strokeWidth={2.2} />
        Add term
      </button>

      {showRecover && onRecover ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRecover}
          disabled={disabled}
          className="gap-1.5 text-muted-foreground"
        >
          <RotateCcwIcon className="size-3.5" />
          Recover to default
        </Button>
      ) : null}
    </div>
  );
}

export function ClientIoTermsEditorField({
  label,
  terms,
  onChange,
  onRecover,
  disabled,
  showRecover,
  description,
}: Props & { label: string }) {
  return (
    <DetailEditBlock label={label}>
      <ClientIoTermsEditor
        terms={terms}
        onChange={onChange}
        onRecover={onRecover}
        disabled={disabled}
        showRecover={showRecover}
        description={description}
      />
    </DetailEditBlock>
  );
}
