"use client";

import { useEffect, useRef, useState } from "react";

import type { ClientCategorySuggestionState } from "@/components/forms/client-category-suggestion";
import {
  classifyClientCategoryAction,
  getClientCategoryClassificationCapabilitiesAction,
} from "@/features/clients/classify-category-action";
import type { ClientClassificationSource } from "@/lib/clients/classify-client-category-types";

export const CLIENT_CATEGORY_PAUSE_MESSAGE =
  "Auto-suggest paused — change name to re-classify";

type UseClientCategoryClassificationOptions = {
  companyName: string;
  country?: string;
  website?: string;
  clientId?: string;
  /** When true, return stored approved classification without re-running pipeline */
  useStoredApproved?: boolean;
  enabled?: boolean;
  onClassified?: (result: ClientCategorySuggestionState) => void;
};

const sessionResultCache = new Map<string, ClientCategorySuggestionState>();

export function useClientCategoryClassification({
  companyName,
  country,
  website,
  clientId,
  useStoredApproved = false,
  enabled = true,
  onClassified,
}: UseClientCategoryClassificationOptions) {
  const [classifying, setClassifying] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ClientCategorySuggestionState | null>(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const requestIdRef = useRef(0);
  const lastSuccessKeyRef = useRef("");
  const prevCompanyNameRef = useRef(companyName);
  const onClassifiedRef = useRef(onClassified);
  onClassifiedRef.current = onClassified;

  useEffect(() => {
    let cancelled = false;

    void getClientCategoryClassificationCapabilitiesAction().then((capabilities) => {
      if (!cancelled) {
        setAiAvailable(capabilities.aiAvailable);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = companyName.trim();
    if (prevCompanyNameRef.current.trim() !== trimmed) {
      lastSuccessKeyRef.current = "";
      setSuggestionApplied(false);
      prevCompanyNameRef.current = companyName;
    }

    if (!enabled || trimmed.length < 3) {
      setClassifying(false);
      setMessage(null);
      setSuggestion(null);
      return;
    }

    const requestKey = `${trimmed}|${country ?? ""}|${website ?? ""}|${clientId ?? ""}|${useStoredApproved}`;
    const cached = sessionResultCache.get(requestKey);
    if (cached) {
      setClassifying(false);
      setSuggestion(cached);
      if (requestKey !== lastSuccessKeyRef.current) {
        lastSuccessKeyRef.current = requestKey;
        if (!suggestionApplied) {
          onClassifiedRef.current?.(cached);
        }
      }
      return;
    }

    if (requestKey === lastSuccessKeyRef.current) {
      setClassifying(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setClassifying(true);
    setMessage(null);

    const debounceMs = aiAvailable ? 900 : 700;

    const timer = window.setTimeout(async () => {
      try {
        const result = await classifyClientCategoryAction({
          name: trimmed,
          country: country || undefined,
          website: website || undefined,
          clientId,
          useStoredApproved,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!result.ok || !result.categorySlug || !result.subcategorySlug) {
          setSuggestion(null);
          setMessage(
            result.message ??
              "No automatic match — choose category below if needed."
          );
          return;
        }

        lastSuccessKeyRef.current = requestKey;
        const classified: ClientCategorySuggestionState = {
          categorySlug: result.categorySlug,
          subcategorySlug: result.subcategorySlug,
          confidence: result.confidence ?? 0,
          source: (result.source ?? "fallback") as ClientClassificationSource,
          reason: result.reason,
        };

        sessionResultCache.set(requestKey, classified);
        setSuggestion(classified);

        if (!suggestionApplied) {
          onClassifiedRef.current?.(classified);
        }
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSuggestion(null);
        setMessage("Classification unavailable — choose category below.");
      } finally {
        if (requestId === requestIdRef.current) {
          setClassifying(false);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [
    companyName,
    country,
    website,
    clientId,
    useStoredApproved,
    enabled,
    aiAvailable,
  ]);

  function resetClassificationRequest() {
    lastSuccessKeyRef.current = "";
    requestIdRef.current += 1;
    setClassifying(false);
    setMessage(null);
    setSuggestion(null);
    setSuggestionApplied(false);
  }

  function acceptSuggestion() {
    if (!suggestion) {
      return;
    }
    setSuggestionApplied(true);
    onClassifiedRef.current?.(suggestion);
  }

  function overrideSuggestion() {
    setSuggestionApplied(false);
    setSuggestion(null);
    lastSuccessKeyRef.current = "";
  }

  const classifyingLabel =
    classifying && aiAvailable ? "Classifying with AI…" : classifying ? "Classifying…" : null;

  return {
    classifying,
    classifyingLabel,
    aiAvailable,
    message,
    suggestion,
    suggestionApplied,
    acceptSuggestion,
    overrideSuggestion,
    resetClassificationRequest,
  };
}
