"use client";

import { useEffect, useMemo, useRef } from "react";

// `run` and `cancel` keep the same identity across renders, and `run` always calls
// the latest `callback`.
const useDebouncedCallback = <Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
) => {
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debounced = useMemo(() => {
    const cancel = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    const run = (...args: Args) => {
      cancel();
      timerRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
    };
    return { run, cancel };
  }, [delayMs]);

  useEffect(() => debounced.cancel, [debounced]);

  return debounced;
};

export default useDebouncedCallback;
