"use client";

import { useEffect, useState } from "react";

export const SEARCH_DEBOUNCE_MS = 150;

/**
 * Returns `value`, but updates only after it has stopped changing for
 * `delayMs` (ISSUE-11a).
 *
 * A timer is used instead of `useDeferredValue` deliberately: the work order
 * asks for ~150 ms debounce semantics. `useDeferredValue` only lowers the
 * re-render's priority — on an idle main thread it still runs the O(N) filter
 * for every keystroke — whereas a timer coalesces a fast typing burst into a
 * single filter pass. Consumers keep their inputs controlled by the raw
 * state, so typing stays instant; only the derived filter query lags.
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
