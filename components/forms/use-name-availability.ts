"use client";

import { useEffect, useState } from "react";

type CheckFn = (
  name: string,
  ...args: string[]
) => Promise<{ available: boolean; message?: string }>;

export function useNameAvailability(
  name: string,
  checkFn: CheckFn,
  extraArgs: string[] = [],
  enabled = true
) {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const extraKey = extraArgs.join("|");

  useEffect(() => {
    if (!enabled || !name.trim()) {
      setAvailable(null);
      setMessage(null);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    const timer = setTimeout(async () => {
      try {
        const result = await checkFn(name, ...extraArgs);
        if (cancelled) return;
        setAvailable(result.available);
        setMessage(result.available ? null : (result.message ?? null));
      } catch {
        if (!cancelled) {
          setAvailable(null);
          setMessage(null);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, extraKey, enabled, checkFn]);

  return { checking, available, message, isDuplicate: available === false };
}
