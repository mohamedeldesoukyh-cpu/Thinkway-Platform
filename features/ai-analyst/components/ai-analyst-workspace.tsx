"use client";

import { useState } from "react";
import { PlusIcon, SearchIcon, SendIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  "Quarterly review",
  "Top vendors",
  "Revenue trends",
  "VAT summary",
] as const;

const HISTORY = [
  "Performance of this quarter",
  "Campaign ROI breakdown",
  "Top vendor analysis",
  "Weekly report generation",
  "VAT summary",
] as const;

export function AiAnalystWorkspace() {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="grid min-h-[60vh] gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="hidden flex-col gap-3 rounded-3xl border border-border bg-card p-4 lg:flex">
        <Button className="w-full justify-center">
          <PlusIcon />
          New chat
        </Button>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted px-3 py-2">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            placeholder="Search recent"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          History
        </p>
        <div className="flex flex-col gap-1">
          {HISTORY.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-2xl px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-muted"
            >
              {item}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-border bg-card p-6 py-12">
        <div className="bg-brand-gradient flex size-16 items-center justify-center rounded-3xl shadow-md">
          <SparklesIcon className="size-8 text-white" />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="font-heading text-2xl font-extrabold">AI Analyst</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Your AI analyst is here. Ask questions, uncover trends, and get smart
            insights about your campaigns and performance.
          </p>
        </div>

        <div className="relative w-full max-w-2xl rounded-3xl p-[2px]">
          <div className="bg-brand-gradient absolute inset-0 rounded-3xl opacity-90" />
          <div className="relative rounded-[calc(1.5rem-2px)] bg-card p-4">
            <Textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask anything about your performance…"
              rows={3}
              className="resize-none border-transparent bg-transparent focus-visible:ring-0"
            />
            <div className="mt-2 flex items-center justify-between">
              <Button variant="outline" size="icon-sm" aria-label="Add context">
                <PlusIcon />
              </Button>
              <Button
                size="icon"
                aria-label="Send prompt"
                disabled={prompt.trim().length === 0}
              >
                <SendIcon />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {SUGGESTED_PROMPTS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setPrompt(suggestion)}
              className={cn(
                "rounded-full border border-border bg-background px-4 py-2 text-xs font-medium transition-colors",
                "hover:border-brand-blue hover:text-brand-blue"
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
