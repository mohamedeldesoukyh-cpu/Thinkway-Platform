"use client";

import { useEffect, useRef, useState } from "react";

import {
  isMediaProxyApiUrl,
  maxMediaProxyClientRetries,
  mediaProxyRetryDelayMs,
  withMediaProxyRetryBust,
} from "@/lib/creators/media-proxy-client-recovery";

/**
 * Retries media-proxy img URLs after Phase 2 fail-fast 404s so background
 * after() warm can paint once the process cache is positive.
 */
export function useMediaProxyImageRecovery(baseSrc: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attemptRef.current = 0;
    setAttempt(0);
    setExhausted(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [baseSrc]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const displaySrc =
    baseSrc && attempt > 0 ? withMediaProxyRetryBust(baseSrc, attempt) : baseSrc;

  const onError = () => {
    if (!baseSrc || !isMediaProxyApiUrl(baseSrc)) {
      setExhausted(true);
      return;
    }
    const current = attemptRef.current;
    if (current >= maxMediaProxyClientRetries()) {
      setExhausted(true);
      return;
    }
    const delay = mediaProxyRetryDelayMs(current);
    if (delay == null) {
      setExhausted(true);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    const next = current + 1;
    timerRef.current = setTimeout(() => {
      attemptRef.current = next;
      setAttempt(next);
    }, delay);
  };

  return {
    displaySrc,
    exhausted,
    attempt,
    onError,
  };
}
