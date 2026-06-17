import NetInfo from "@react-native-community/netinfo";
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

async function fetchUpdateIfAvailable(): Promise<void> {
  if (!Updates.isEnabled) return;

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
    }
  } catch (error) {
    if (__DEV__) {
      console.warn("[expo-updates] check failed", error);
    }
  }
}

/**
 * Checks for OTA updates on startup, foreground resume, and network recovery.
 * Downloads updates in the background; applies on next cold launch (no forced reload).
 * Call once from root layout.
 */
export function useExpoUpdates(): void {
  const appStateRef = useRef(AppState.currentState);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    if (__DEV__ || Platform.OS === "web" || !Updates.isEnabled) {
      return;
    }

    void fetchUpdateIfAvailable();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        void fetchUpdateIfAvailable();
      }
      appStateRef.current = nextState;
    });

    const netInfoSub = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      if (wasOfflineRef.current && isConnected) {
        void fetchUpdateIfAvailable();
      }
      wasOfflineRef.current = !isConnected;
    });

    return () => {
      appStateSub.remove();
      netInfoSub();
    };
  }, []);
}
