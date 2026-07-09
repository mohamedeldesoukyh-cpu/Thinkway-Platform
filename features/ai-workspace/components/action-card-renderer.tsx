"use client";

import { useState } from "react";
import {
  MegaphoneIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CAMPAIGN_STUDIO_COPY } from "@/features/campaign-studio/constants/copy";
import type { HydrationMapperOptions } from "@/features/campaign-studio/services/creator-hydration-mapper";
import { cn } from "@/lib/utils";

import { decideActionCardAction } from "../actions/action-approval-actions";
import type { AiActionCard } from "../types";
import {
  ActionCardCreatorPreview,
  type ActionCardCreatorItem,
} from "./action-card-creator-preview";

const CARD_ICONS: Record<AiActionCard["type"], typeof SparklesIcon> = {
  campaign: MegaphoneIcon,
  creator_search: SearchIcon,
  shortlist: UsersIcon,
  report: SparklesIcon,
  approval: ShieldCheckIcon,
};

type ActionCardRendererProps = {
  cards: AiActionCard[];
  conversationId: string;
  messageId: string;
  onCardUpdated?: (cardId: string, status: AiActionCard["status"]) => void;
  hydrationOptions?: HydrationMapperOptions;
  /** Show the single campaign approval heading above pending cards (Campaign Studio only). */
  showApprovalHeader?: boolean;
};

function hasPendingApprovalCards(cards: AiActionCard[]): boolean {
  return cards.some((card) => card.requiresApproval && card.status === "pending");
}

function readCardCreators(payload: Record<string, unknown>): ActionCardCreatorItem[] {
  if (!Array.isArray(payload.creators)) return [];
  return payload.creators as ActionCardCreatorItem[];
}

function readCardCreatorIds(payload: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(payload.creatorIds)) return undefined;
  return payload.creatorIds.filter((id): id is string => typeof id === "string");
}

function readCardHydrationOptions(
  payload: Record<string, unknown>,
  fallback?: HydrationMapperOptions
): HydrationMapperOptions | undefined {
  const preferredPlatforms = Array.isArray(payload.preferredPlatforms)
    ? payload.preferredPlatforms.filter((p): p is string => typeof p === "string")
    : fallback?.preferredPlatforms;
  const currency =
    typeof payload.currency === "string" ? payload.currency : fallback?.currency;

  if (!preferredPlatforms?.length && !currency) return fallback;
  return {
    preferredPlatforms: preferredPlatforms ?? fallback?.preferredPlatforms,
    currency: currency ?? fallback?.currency,
  };
}

export function ActionCardRenderer({
  cards,
  conversationId,
  messageId,
  onCardUpdated,
  hydrationOptions,
  showApprovalHeader = false,
}: ActionCardRendererProps) {
  if (cards.length === 0) return null;

  const showHeader = showApprovalHeader && hasPendingApprovalCards(cards);

  return (
    <div className={cn("flex flex-col gap-2", showHeader ? "" : "mt-2.5")}>
      {showHeader ? (
        <div className="mb-1 flex items-center gap-2">
          <TargetIcon className="size-4 text-[#1D9E75]" />
          <p className="text-xs font-semibold">{CAMPAIGN_STUDIO_COPY.approvalRequired}</p>
        </div>
      ) : null}
      {cards.map((card) => (
        <ActionCardItem
          key={card.id}
          card={card}
          conversationId={conversationId}
          messageId={messageId}
          onCardUpdated={onCardUpdated}
          hydrationOptions={hydrationOptions}
        />
      ))}
    </div>
  );
}

function ActionCardItem({
  card,
  conversationId,
  messageId,
  onCardUpdated,
  hydrationOptions,
}: {
  card: AiActionCard;
  conversationId: string;
  messageId: string;
  onCardUpdated?: (cardId: string, status: AiActionCard["status"]) => void;
  hydrationOptions?: HydrationMapperOptions;
}) {
  const Icon = CARD_ICONS[card.type];
  const creators = readCardCreators(card.payload);
  const creatorIds = readCardCreatorIds(card.payload);
  const cardHydration = readCardHydrationOptions(card.payload, hydrationOptions);
  const showCreators = creators.length > 0 || (creatorIds?.length ?? 0) > 0;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/40">
            <Icon className="size-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{card.title}</p>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </div>
        </div>
        <StatusBadge status={card.status} />
      </div>

      {(card.requiresApproval && card.status === "pending") || showCreators ? (
        <div className="space-y-2">
          {card.requiresApproval && card.status === "pending" ? (
            <ApprovalCard
              card={card}
              conversationId={conversationId}
              messageId={messageId}
              onCardUpdated={onCardUpdated}
            />
          ) : null}
          {showCreators ? (
            <ActionCardCreatorPreview
              creators={creators}
              creatorIds={creatorIds}
              hydrationOptions={cardHydration}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: AiActionCard["status"] }) {
  const variants: Record<AiActionCard["status"], string> = {
    pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    approved: "bg-[#1D9E75]/10 text-[#1D9E75]",
    rejected: "bg-destructive/10 text-destructive",
    executed: "bg-[#1D9E75]/10 text-[#1D9E75]",
  };

  return (
    <Badge variant="secondary" className={cn("text-[10px] capitalize", variants[status])}>
      {status}
    </Badge>
  );
}

function ApprovalCard({
  conversationId,
  messageId,
  card,
  onCardUpdated,
}: {
  card: AiActionCard;
  conversationId: string;
  messageId: string;
  onCardUpdated?: (cardId: string, status: AiActionCard["status"]) => void;
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleDecision(decision: "approve" | "reject") {
    setPending(true);
    setFeedback(null);
    const result = await decideActionCardAction({
      conversationId,
      messageId,
      cardId: card.id,
      decision,
    });
    setPending(false);
    setFeedback(result.message);
    if (result.ok && result.cardStatus) {
      onCardUpdated?.(card.id, result.cardStatus);
    }
  }

  return (
    <div className="space-y-2 border-t border-border pt-2">
      <p className="text-xs text-muted-foreground">
        This action modifies data in Thinkway. Review and approve before execution.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          className="h-7 bg-[#1D9E75] text-xs hover:bg-[#178f68]"
          disabled={pending}
          onClick={() => void handleDecision("approve")}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={pending}
          onClick={() => void handleDecision("reject")}
        >
          Reject
        </Button>
      </div>
      {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
    </div>
  );
}

export { ApprovalCard };
