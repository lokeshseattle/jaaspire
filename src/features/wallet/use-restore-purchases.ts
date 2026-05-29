import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { notificationCountsQueryKey } from "@/src/features/profile/notification.hooks";
import { useIap } from "@/src/features/wallet/iap.context";
import {
  syncStorePurchases,
  type SyncStorePurchasesOutcome,
} from "@/src/features/wallet/iap-sync";
import { invalidateCreatorSubscriptionCaches } from "@/src/features/wallet/wallet.hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

function showRestoreSummary(outcome: SyncStorePurchasesOutcome): void {
  if (outcome.buyerMismatch) {
    Alert.alert(
      "Cannot restore",
      "These purchases belong to a different Jaaspire account than the one signed into the App Store or Play Store. Sign in with the correct Jaaspire account or use the store account that made the purchase.",
    );
    return;
  }

  if (outcome.upstreamUnavailable) {
    Alert.alert(
      "Store unavailable",
      "Google Play could not be reached. Check your connection and press Sync purchases again when ready.",
    );
    return;
  }

  const nothingFound =
    outcome.restored === 0 &&
    outcome.orphans === 0 &&
    outcome.walletVerified === 0;

  if (nothingFound) {
    Alert.alert(
      "Nothing to sync",
      "No active creator subscriptions or uncredited star packs were found for this Apple or Google account.",
    );
    return;
  }

  const parts: string[] = [];
  if (outcome.restored > 0) {
    parts.push(
      `Synced ${outcome.restored} subscription${outcome.restored === 1 ? "" : "s"}.`,
    );
  }
  if (outcome.walletVerified > 0) {
    parts.push(
      `Credited ${outcome.walletVerified} star pack${outcome.walletVerified === 1 ? "" : "s"}.`,
    );
  }
  if (outcome.orphans > 0) {
    parts.push(
      `${outcome.orphans} subscription${outcome.orphans === 1 ? "" : "s"} could not be linked automatically. Contact support to recover access.`,
    );
  }
  if (outcome.otherErrors.length > 0) {
    parts.push(outcome.otherErrors[0]);
  }

  Alert.alert(
    outcome.orphans > 0 &&
      outcome.restored === 0 &&
      outcome.walletVerified === 0
      ? "Support needed"
      : "Sync complete",
    parts.join("\n\n"),
  );
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();
  const { data: profileData } = useGetProfile();
  const [isRestoring, setIsRestoring] = useState(false);
  const isRestoringRef = useRef(false);
  const { connected } = useIap();

  const restore = useCallback(async () => {
    if (isRestoringRef.current) return;

    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      Alert.alert(
        "Not available",
        "Restore purchases is only available in the iOS or Android app.",
      );
      return;
    }

    if (!profileData?.data?.id) {
      Alert.alert("Sign in required", "Sign in to restore your purchases.");
      return;
    }

    if (!connected) {
      Alert.alert(
        "Store unavailable",
        "Could not connect to the App Store or Play Store. Try again in a moment.",
      );
      return;
    }

    isRestoringRef.current = true;
    setIsRestoring(true);
    try {
      const outcome = await syncStorePurchases();
      if (outcome.restoredUsernames.length > 0) {
        invalidateCreatorSubscriptionCaches(
          queryClient,
          outcome.restoredUsernames,
        );
      }
      if (outcome.walletVerified > 0) {
        await queryClient.invalidateQueries({
          queryKey: notificationCountsQueryKey,
        });
      }
      showRestoreSummary(outcome);
    } catch (e) {
      Alert.alert(
        "Restore failed",
        e instanceof Error
          ? e.message
          : "Could not restore purchases.",
      );
    } finally {
      isRestoringRef.current = false;
      setIsRestoring(false);
    }
  }, [connected, profileData?.data?.id, queryClient]);

  return { restore, isRestoring };
}
