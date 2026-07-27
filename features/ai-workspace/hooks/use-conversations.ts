"use client";

import { useCallback, useEffect, useState } from "react";

import { parseApiError } from "@/lib/security/api-error";

import type { ConversationListItem } from "../types";

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? conversations.length > 0;

    if (!background) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/ai/conversations");
      if (!response.ok) {
        const parsed = await parseApiError(response, "Failed to load conversations");
        throw new Error(parsed.message);
      }
      const data = (await response.json()) as { conversations: ConversationListItem[] };
      setConversations(data.conversations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [conversations.length]);

  useEffect(() => {
    void refresh({ background: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  return { conversations, loading, error, refresh };
}
