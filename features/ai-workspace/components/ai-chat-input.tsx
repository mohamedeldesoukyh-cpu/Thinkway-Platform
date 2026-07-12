"use client";

import { forwardRef, useCallback, useEffect, useRef } from "react";
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

export const AiChatInput = forwardRef<HTMLElement, AiChatInputProps>(function AiChatInput(
  {
    value,
    onChange,
    onSend,
    onStop,
    onNewChat,
    disabled,
    isStreaming,
    error,
    className,
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  return (
    <footer
      ref={ref}
      className={cn(
        "ai-composer-footer px-4 pt-2 pb-3 sm:px-6 sm:pb-4",
        className
      )}
    >
      <div className="mx-auto flex w-[min(78%,36rem)] flex-col">
        {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

        <div className="ai-composer-card flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 transition-[border-color,box-shadow]">
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
            className="ai-composer-input max-h-[120px] min-h-[44px] min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2.5 text-[14px] leading-snug text-foreground outline-none placeholder:text-[#9AA3B2]"
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
              "ai-composer-send flex size-9 shrink-0 items-center justify-center rounded-xl text-white transition-all",
              isStreaming
                ? "bg-foreground/80 shadow-md hover:scale-[1.05] hover:bg-foreground active:scale-95"
                : "ai-send-btn hover:scale-[1.05] active:scale-95",
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

        <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
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
            <p className="hidden text-[11px] text-[#9AA3B2] sm:block">
              Press{" "}
              <kbd className="inline-flex h-4 items-center rounded border border-[#0B0F1A]/8 bg-white px-1.5 font-mono text-[10px] text-muted-foreground dark:border-border dark:bg-muted">
                Enter
              </kbd>{" "}
              to send ·{" "}
              <kbd className="inline-flex h-4 items-center rounded border border-[#0B0F1A]/8 bg-white px-1.5 font-mono text-[10px] text-muted-foreground dark:border-border dark:bg-muted">
                Shift
              </kbd>
              +
              <kbd className="inline-flex h-4 items-center rounded border border-[#0B0F1A]/8 bg-white px-1.5 font-mono text-[10px] text-muted-foreground dark:border-border dark:bg-muted">
                Enter
              </kbd>{" "}
              for new line
            </p>
          </div>
          <p className="text-[11px] text-[#9AA3B2]">
            Powered by <span className="font-bold text-[#0057FF]">Thinkway AI</span>
          </p>
        </div>
      </div>
    </footer>
  );
});

AiChatInput.displayName = "AiChatInput";
