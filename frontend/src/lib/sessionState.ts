/**
 * State that outlives a component's mount for the rest of the browser session.
 *
 * Dashboard tabs swap whole views, so anything a list keeps in plain `useState`
 * — the search text, the filters, the sort order, the page — is thrown away the
 * moment the user looks at another tab. Views keep that state here under a
 * stable key and read it back when they mount again.
 *
 * Session-only on purpose: a filter is not a preference, so it must not outlive
 * a reload the way `useSummaryModel`'s choice does. `clearSessionState()` runs
 * on sign-out so one account's search terms never surface in the next one's
 * screens.
 */
const store = new Map<string, unknown>();

export function readSessionState<T>(key: string, fallback: T): T {
  return store.has(key) ? (store.get(key) as T) : fallback;
}

export function writeSessionState<T>(key: string, value: T): void {
  store.set(key, value);
}

/** Drop every remembered value — a different account signs in next. */
export function clearSessionState(): void {
  store.clear();
}
