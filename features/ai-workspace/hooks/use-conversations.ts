"use client";

import { useCallback, useEffect, useState } from "react";

import type { ConversationListItem } from "../types";

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) return "Failed to load conversations";

  try {
    const payload = JSON.parse(text) as { error?: string; message?: string };
    return payload.error ?? payload.message ?? "Failed to load conversations";
  } catch {
    return text.slice(0, 200) || "Failed to load conversations";
  }
}

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
        throw new Error(await readErrorMessage(response));
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
