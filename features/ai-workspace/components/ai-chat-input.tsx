"use client";

import { forwardRef, useCallback, useEffect, useRef } from "react";
import { PaperclipIcon, PlusIcon, SendIcon, SquareIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AI_WORKSPACE_COPY } from "../constants/ai-copy";
import { STUDIO_CHAT_CLASSES } from "../constants/studio-chat-tokens";

const PLACEHOLDER_EXAMPLES = [
  AI_WORKSPACE_COPY.inputPlaceholder,
  "Summarize this week's campaigns…",
  "Compare vendor quotes for SOOH…",
  "What needs my attention today?",
  "Draft a creator brief for a new campaign…",
] as const;

type AiChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onNewChat?: () => void;
  onAttach?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  error?: string | null;
  className?: string;
  /** `inline` = reference flex footer; `overlay` = absolute dock composer */
  layout?: "inline" | "overlay";
};

export const AiChatInput = forwardRef<HTMLElement, AiChatInputProps>(function AiChatInput(
  {
    value,
    onChange,
    onSend,
    onStop,
    onNewChat,
    onAttach,
    disabled,
    isStreaming,
    error,
    className,
    layout = "inline",
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholderIndexRef = useRef(0);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  useEffect(() => {
    if (layout !== "inline") return;
    const interval = window.setInterval(() => {
      const el = textareaRef.current;
      if (!el || document.activeElement === el) return;
      placeholderIndexRef.current =
        (placeholderIndexRef.current + 1) % PLACEHOLDER_EXAMPLES.length;
      el.placeholder = PLACEHOLDER_EXAMPLES[placeholderIndexRef.current] ?? PLACEHOLDER_EXAMPLES[0];
    }, 3200);
    return () => window.clearInterval(interval);
  }, [layout]);

  const canSend = value.trim().length > 0 && !disabled && !isStreaming;

  if (layout === "overlay") {
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
        </div>
      </footer>
    );
  }

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} className={cn(STUDIO_CHAT_CLASSES.composerWrap, className)}>
      {error ? (
        <p className="mx-auto mb-2 max-w-[820px] text-sm text-destructive">{error}</p>
      ) : null}

      <div className={STUDIO_CHAT_CLASSES.composer}>
        {onAttach ? (
          <button
            type="button"
            className="sc-composer-attach"
            aria-label="Attach brief in Studio"
            title="Upload a brief in Campaign Studio"
            disabled={disabled || isStreaming}
            onClick={onAttach}
          >
            <PaperclipIcon strokeWidth={2} />
          </button>
        ) : null}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (isStreaming) {
                onStop?.();
              } else if (canSend) {
                onSend();
              }
            }
          }}
          placeholder={PLACEHOLDER_EXAMPLES[0]}
          rows={1}
          disabled={disabled}
        />
        <button
          type="button"
          className="sc-composer-send"
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
        >
          {isStreaming ? (
            <SquareIcon className="size-4 fill-current" strokeWidth={2.4} />
          ) : (
            <SendIcon strokeWidth={2.4} />
          )}
        </button>
      </div>

      <div className={STUDIO_CHAT_CLASSES.composerFoot}>
        <span>
          {onNewChat ? (
            <Button
              variant="outline"
              size="icon-sm"
              className="mr-2 inline-flex lg:hidden"
              aria-label="New chat"
              onClick={onNewChat}
            >
              <PlusIcon />
            </Button>
          ) : null}
          <span className="hidden sm:inline">
            Press <span className={STUDIO_CHAT_CLASSES.kbd}>Enter</span> to send ·{" "}
            <span className={STUDIO_CHAT_CLASSES.kbd}>Shift</span> +{" "}
            <span className={STUDIO_CHAT_CLASSES.kbd}>Enter</span> for new line
          </span>
        </span>
        <span>
          Powered by <b>Thinkway AI</b>
        </span>
      </div>
    </div>
  );
});

AiChatInput.displayName = "AiChatInput";
