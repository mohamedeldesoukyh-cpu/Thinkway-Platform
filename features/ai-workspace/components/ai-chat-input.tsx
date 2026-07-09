"use client";

import { useCallback, useEffect, useRef } from "react";
import { PlusIcon, SendIcon, SquareIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AI_WORKSPACE_COPY } from "../constants/ai-copy";

type AiChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onNewChat?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  error?: string | null;
  className?: string;
};

export function AiChatInput({
  value,
  onChange,
  onSend,
  onStop,
  onNewChat,
  disabled,
  isStreaming,
  error,
  className,
}: AiChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <div
      className={cn(
        "shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6 sm:pb-4",
        className
      )}
    >
      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

      <div className="relative overflow-hidden rounded-[14px] border-[1.5px] border-border bg-background transition-[border-color,box-shadow] focus-within:border-violet-400 focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] dark:focus-within:border-violet-500">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={AI_WORKSPACE_COPY.inputPlaceholder}
          rows={1}
          disabled={disabled || isStreaming}
          className="block max-h-[180px] min-h-[52px] w-full resize-none overflow-y-auto bg-transparent py-3.5 pr-[52px] pl-[18px] text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label={isStreaming ? "Stop generation" : "Send message"}
          disabled={isStreaming ? false : !canSend}
          onClick={
            isStreaming
              ? () => {
                  onStop?.();
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }
              : onSend
          }
          className={cn(
            "absolute right-2.5 bottom-2.5 flex size-[34px] items-center justify-center rounded-[9px] text-white shadow-[0_2px_10px_rgba(99,102,241,0.4)] transition-all",
            isStreaming
              ? "bg-foreground/80 hover:bg-foreground hover:scale-[1.08] active:scale-95"
              : "ai-gradient-send hover:scale-[1.08] hover:shadow-[0_4px_18px_rgba(99,102,241,0.55)] active:scale-95",
            "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
          )}
        >
          {isStreaming ? (
            <SquareIcon className="size-[13px] fill-current" />
          ) : (
            <SendIcon className="size-[15px]" strokeWidth={2.5} />
          )}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onNewChat ? (
            <Button
              variant="outline"
              size="icon-sm"
              className="lg:hidden"
              aria-label="New chat"
              onClick={onNewChat}
            >
              <PlusIcon />
            </Button>
          ) : null}
          <p className="hidden text-[10px] text-muted-foreground sm:block">
            Press{" "}
            <kbd className="inline-flex h-3.5 items-center rounded border border-border bg-muted px-1 text-[9px]">
              Enter
            </kbd>{" "}
            to send ·{" "}
            <kbd className="inline-flex h-3.5 items-center rounded border border-border bg-muted px-1 text-[9px]">
              Shift
            </kbd>
            +
            <kbd className="inline-flex h-3.5 items-center rounded border border-border bg-muted px-1 text-[9px]">
              Enter
            </kbd>{" "}
            for new line
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Powered by <span className="ai-gradient-text font-bold">Thinkway AI</span>
        </p>
      </div>
    </div>
  );
}
