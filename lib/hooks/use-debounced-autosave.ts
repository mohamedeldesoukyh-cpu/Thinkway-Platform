"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

/**
 * Debounced autosave: call `schedule(payload)` on every change; the latest
 * payload is persisted after `delayMs` of quiet. Exposes a status for a
 * saving/saved indicator. No manual save button required (spec §11).
 */
export function useDebouncedAutosave<T>(
  save: (payload: T) => Promise<{ ok: boolean; message?: string }>,
  delayMs = 700
) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<T | null>(null);
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flush = useCallback(async () => {
    if (latest.current == null) return;
    const payload = latest.current;
    setStatus("saving");
    setError(null);
    try {
      const res = await saveRef.current(payload);
      if (res.ok) {
        setStatus("saved");
      } else {
        setStatus("error");
        setError(res.message ?? "Save failed.");
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  }, []);

  const schedule = useCallback(
    (payload: T) => {
      latest.current = payload;
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, delayMs);
    },
    [delayMs, flush]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { status, error, schedule };
}
