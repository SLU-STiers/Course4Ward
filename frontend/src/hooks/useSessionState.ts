import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { readSessionState, writeSessionState } from '../lib/sessionState';

/**
 * `useState` whose value survives the component being unmounted.
 *
 * Pass a stable `key` (see `lib/sessionState`) and the value is restored the
 * next time the component mounts — a dashboard tab switch no longer resets the
 * list underneath it. `key: null` behaves exactly like plain `useState`, which
 * is what a table without a `stateKey` uses.
 */
export function useSessionState<T>(
  key: string | null,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const fallback =
      typeof initial === 'function' ? (initial as () => T)() : initial;
    return key ? readSessionState(key, fallback) : fallback;
  });

  useEffect(() => {
    if (key) writeSessionState(key, value);
  }, [key, value]);

  return [value, setValue];
}
