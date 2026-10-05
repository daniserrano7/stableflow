import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and while hydrating, true afterwards. Values only the browser knows (its
 * timezone, its locale) must wait for true: rendering them during hydration makes the markup
 * differ from the server's, and React then throws the server HTML away and re-renders the page.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
