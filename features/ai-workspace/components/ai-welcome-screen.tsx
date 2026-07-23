"use client";

import { useMemo, type ReactNode } from "react";
import { CheckSquareIcon, PencilIcon, ZapIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { AiIntent } from "@/features/ai";
import { STUDIO_CHAT_CLASSES } from "../constants/studio-chat-tokens";

type PulseFeedItem = {
  id: string;
  icon: "gen" | "approve" | "edit";
  text: ReactNode;
  time: string;
};

type AiWelcomeScreenProps = {
  onSelect?: (prompt: string, intent?: AiIntent) => void;
  disabled?: boolean;
  className?: string;
  userDisplayName?: string;
};

const FEED_ICON_STYLES = {
  gen: { bg: "var(--sc-blue-light)", color: "var(--sc-blue-text)", Icon: ZapIcon },
  approve: { bg: "var(--sc-green-bg)", color: "var(--sc-green-text)", Icon: CheckSquareIcon },
  edit: { bg: "var(--sc-purple-bg)", color: "var(--sc-purple-text)", Icon: PencilIcon },
} as const;

const DEMO_FEED: PulseFeedItem[] = [
  {
    id: "demo-1",
    icon: "gen",
    text: (
      <>
        Copilot generated <b>Media Plan</b>
      </>
    ),
    time: "Recently",
  },
  {
    id: "demo-2",
    icon: "approve",
    text: (
      <>
        <b>Budget Allocation Plan</b> approved
      </>
    ),
    time: "Today",
  },
  {
    id: "demo-3",
    icon: "edit",
    text: (
      <>
        <b>Campaign brief</b> edited — target market updated
      </>
    ),
    time: "Yesterday",
  },
];

function firstName(displayName?: string): string | null {
  if (!displayName?.trim()) return null;
  return displayName.trim().split(/\s+/)[0] ?? null;
}

export function AiWelcomeScreen({
  className,
  userDisplayName,
}: AiWelcomeScreenProps) {
  const greetingName = useMemo(() => firstName(userDisplayName), [userDisplayName]);
  const greeting = greetingName
    ? `What can I help with, ${greetingName}?`
    : "What can I help with today?";

  return (
    <div className={cn(STUDIO_CHAT_CLASSES.welcome, className)}>
      <h2>{greeting}</h2>
      <p>
        Ask about campaigns, vendors, shortlists, or performance — Thinkway Intelligence pulls
        live data from your workspace to answer.
      </p>

      <div className="sc-pulse-live">
        <span className="sc-pulse-dot" aria-hidden />
        Studio pulse — Live
      </div>

      <div className="sc-orbit" aria-hidden>
        <div className="sc-orbit-guide" />
        <div className="sc-orbit-ring" />
        <div className="sc-orbit-logo">
          <span className="sc-dot-main" />
          <span className="sc-dot-spark" />
        </div>
      </div>

      <PulseFeed items={DEMO_FEED} />
    </div>
  );
}

function PulseFeed({ items }: { items: PulseFeedItem[] }) {
  return (
    <div className="sc-pulse-feed">
      {items.map((item) => {
        const style = FEED_ICON_STYLES[item.icon];
        const Icon = style.Icon;
        return (
          <div key={item.id} className="sc-feed-item">
            <span
              className="sc-feed-ico"
              style={{ background: style.bg, color: style.color }}
            >
              <Icon strokeWidth={2} />
            </span>
            <span className="sc-feed-text">{item.text}</span>
            <span className="sc-feed-time">{item.time}</span>
          </div>
        );
      })}
    </div>
  );
}

export { CHIP_ACTIONS } from "./ai-welcome-screen-chips";
