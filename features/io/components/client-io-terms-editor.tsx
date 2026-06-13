"use client";

import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DETAIL_FORM_INPUT_CLASS,
  DetailEditBlock,
} from "@/features/campaigns/components/operational-detail-panel";
import type { ClientIoTerm } from "@/lib/io/client-io-terms";
import { cn } from "@/lib/utils";

const DETAIL_TEXTAREA_CLASS =
  "min-h-[4.5rem] resize-y border-border/60 bg-muted/20 text-sm shadow-none focus-visible:ring-1";

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
  function updateTerm(index: number, patch: Partial<ClientIoTerm>) {
    onChange(terms.map((term, i) => (i === index ? { ...term, ...patch } : term)));
  }

  function removeTerm(index: number) {
    onChange(terms.filter((_, i) => i !== index));
  }

  function addTerm() {
    onChange([...terms, { title: "", body: "" }]);
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
            className="rounded-xl border border-border/60 bg-muted/10 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Term {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeTerm(index)}
                disabled={disabled || terms.length <= 1}
                aria-label={`Remove term ${index + 1}`}
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              value={term.title}
              onChange={(e) => updateTerm(index, { title: e.target.value })}
              placeholder="Term title (e.g. Payment Terms.)"
              className={DETAIL_FORM_INPUT_CLASS}
              disabled={disabled}
            />
            <Textarea
              value={term.body}
              onChange={(e) => updateTerm(index, { body: e.target.value })}
              placeholder="Term body text"
              rows={3}
              className={DETAIL_TEXTAREA_CLASS}
              disabled={disabled}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTerm}
          disabled={disabled}
          className="gap-1.5"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add term
        </Button>
        {showRecover && onRecover ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRecover}
            disabled={disabled}
            className={cn("gap-1.5 text-muted-foreground")}
          >
            <RotateCcwIcon className="h-3.5 w-3.5" />
            Recover to default
          </Button>
        ) : null}
      </div>
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
