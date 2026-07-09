"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type MessageActionsProps = {
  role: "user" | "assistant";
  content: string;
  isLastUserMessage?: boolean;
  disabled?: boolean;
  onEdit?: () => void;
  onCopy?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
  className?: string;
};

export function MessageActions({
  role,
  content,
  isLastUserMessage,
  disabled,
  onEdit,
  onCopy,
  onRetry,
  onDelete,
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [content, onCopy]);

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
        className
      )}
    >
      {role === "user" && isLastUserMessage && onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6 text-muted-foreground hover:text-foreground"
          aria-label="Edit message"
          disabled={disabled}
          onClick={onEdit}
        >
          <PencilIcon className="size-3" />
        </Button>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-6 text-muted-foreground hover:text-foreground"
        aria-label="Copy message"
        disabled={disabled}
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <CheckIcon className="size-3 text-[#1D9E75]" />
        ) : (
          <CopyIcon className="size-3" />
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-6 text-muted-foreground hover:text-foreground"
            aria-label="Message actions"
            disabled={disabled}
          >
            <MoreHorizontalIcon className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={role === "user" ? "end" : "start"} className="w-40">
          {onRetry ? (
            <DropdownMenuItem onClick={onRetry}>
              <RefreshCwIcon className="size-3.5" />
              Retry
            </DropdownMenuItem>
          ) : null}
          {onDelete ? (
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type EditMessageFormProps = {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
  disabled?: boolean;
};

export function EditMessageForm({
  initialContent,
  onSave,
  onCancel,
  disabled,
}: EditMessageFormProps) {
  const [value, setValue] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, 0);
  }, []);

  return (
    <div className="min-w-0 w-full text-left [direction:ltr]" dir="ltr">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        rows={1}
        dir="ltr"
        style={{ direction: "ltr", textAlign: "left" }}
        className="block w-full min-w-0 resize-none overflow-y-auto border-0 bg-transparent p-0 text-left text-[13px] leading-relaxed text-white [overflow-wrap:anywhere] [word-break:break-word] [unicode-bidi:plaintext] shadow-none outline-none ring-0 placeholder:text-white/60 focus:ring-0 focus-visible:ring-0"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const trimmed = value.trim();
            if (!disabled && trimmed && trimmed !== initialContent.trim()) {
              onSave(trimmed);
            }
          }
        }}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-2">
        <span className="text-[10px] text-white/50">
          Ctrl+Enter to save
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={onCancel}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 bg-white/20 text-white hover:bg-white/30"
            disabled={disabled || !value.trim() || value.trim() === initialContent.trim()}
            onClick={() => onSave(value.trim())}
          >
            Save &amp; re-run
          </Button>
        </div>
      </div>
    </div>
  );
}
