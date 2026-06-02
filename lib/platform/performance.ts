import { useRef } from "react";

/** Shallow compare for primitive-only dependency arrays. */
export function shallowEqualDeps(deps: readonly unknown[]): boolean {
  return deps.length === 0;
}

/**
 * Returns previous value when deps unchanged — reduces redundant object creation.
 */
export function useStableMemo<T>(factory: () => T, deps: unknown[]): T {
  const ref = useRef<{ deps: unknown[]; value: T } | null>(null);

  if (
    ref.current &&
    ref.current.deps.length === deps.length &&
    ref.current.deps.every((d, i) => Object.is(d, deps[i]))
  ) {
    return ref.current.value;
  }

  const value = factory();
  ref.current = { deps: [...deps], value };
  return value;
}

/** Prevents state updates when serialized value unchanged. */
export function shouldSkipStateUpdate<T>(prev: T, next: T): boolean {
  if (Object.is(prev, next)) return true;
  if (typeof prev === "object" && prev !== null && typeof next === "object" && next !== null) {
    try {
      return JSON.stringify(prev) === JSON.stringify(next);
    } catch {
      return false;
    }
  }
  return false;
}
