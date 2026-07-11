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
    <div className={cn("flex shrink-0 justify-center px-4 pt-3 pb-4 sm:px-8", className)}>
      <div className="flex w-full max-w-[860px] flex-col">
        {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

        <div
          className={cn(
            "ai-composer-card relative overflow-hidden rounded-[20px] border border-[#0B0F1A]/8 bg-white transition-[border-color,box-shadow]",
            "focus-within:border-[#0057FF]/40 focus-within:shadow-[0_24px_60px_rgba(0,87,255,0.2),0_0_0_3px_rgba(0,87,255,0.1)]",
            "dark:border-border dark:bg-background"
          )}
        >
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
            className="block max-h-[180px] min-h-[56px] w-full resize-none overflow-y-auto bg-transparent py-4 pr-[60px] pl-5 text-[14.5px] leading-relaxed text-foreground outline-none placeholder:text-[#9AA3B2]"
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
              "absolute right-2 bottom-2 flex size-10 items-center justify-center rounded-xl text-white transition-all",
              isStreaming
                ? "bg-foreground/80 shadow-md hover:scale-[1.08] hover:bg-foreground active:scale-95"
                : "ai-send-btn hover:scale-[1.08] active:scale-95",
              "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:scale-100"
            )}
          >
            {isStreaming ? (
              <SquareIcon className="size-[13px] fill-current" />
            ) : (
              <SendIcon className="size-4" strokeWidth={2.3} />
            )}
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
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
            <p className="hidden text-[11.5px] text-[#9AA3B2] sm:block">
              Press{" "}
              <kbd className="inline-flex h-4 items-center rounded border border-[#0B0F1A]/8 bg-white px-1.5 font-mono text-[10.5px] text-muted-foreground dark:border-border dark:bg-muted">
                Enter
              </kbd>{" "}
              to send ·{" "}
              <kbd className="inline-flex h-4 items-center rounded border border-[#0B0F1A]/8 bg-white px-1.5 font-mono text-[10.5px] text-muted-foreground dark:border-border dark:bg-muted">
                Shift
              </kbd>
              +
              <kbd className="inline-flex h-4 items-center rounded border border-[#0B0F1A]/8 bg-white px-1.5 font-mono text-[10.5px] text-muted-foreground dark:border-border dark:bg-muted">
                Enter
              </kbd>{" "}
              for new line
            </p>
          </div>
          <p className="text-[11.5px] text-[#9AA3B2]">
            Powered by <span className="font-bold text-[#0057FF]">Thinkway AI</span>
          </p>
        </div>
      </div>
    </div>
  );
}
