import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Hook to handle app state changes (background ↔ foreground).
 * Calls onForeground when app returns from background.
 * Calls onBackground when app goes to background.
 */
export function useAppState(callbacks: {
  onForeground?: () => void;
  onBackground?: () => void;
}) {
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      // Was in background/inactive, now active
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        callbacks.onForeground?.();
      }

      // Was active, now going to background
      if (
        appState.current === "active" &&
        nextState.match(/inactive|background/)
      ) {
        callbacks.onBackground?.();
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [callbacks.onForeground, callbacks.onBackground]);
}
