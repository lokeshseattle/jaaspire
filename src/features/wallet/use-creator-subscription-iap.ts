import { useIap } from "@/src/features/wallet/iap.context";
import {
  getSubscriptionAvailabilityBlocked,
  useCheckSubscriptionAvailability,
} from "@/src/features/wallet/wallet.hooks";
import type { SubscriptionAvailabilitySku } from "@/src/services/api/api.types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Alert, Platform } from "react-native";
import type { ProductSubscription } from "expo-iap";

type UseCreatorSubscriptionIapOptions = {
  enabled?: boolean;
  onSuccess?: () => void;
};

function storeProductIdFromAvailabilitySku(
  sku: SubscriptionAvailabilitySku,
): string {
  return Platform.OS === "ios" ? sku.apple_sku : sku.google_product_id;
}

/** Google Play requires an offer token per base plan when purchasing subscriptions. */
function pickAndroidSubscriptionOffer(
  subscriptions: ProductSubscription[],
  googleProductId: string,
  basePlanId: string,
): { sku: string; offerToken: string } | null {
  const sub = subscriptions.find((s) => s.id === googleProductId);
  if (!sub) return null;

  const matching =
    sub.subscriptionOffers?.filter(
      (offer) =>
        offer.basePlanIdAndroid === basePlanId &&
        typeof offer.offerTokenAndroid === "string" &&
        offer.offerTokenAndroid.length > 0,
    ) ?? [];

  if (matching.length > 0) {
    const preferred =
      matching.find((offer) => !offer.id) ??
      matching.find((offer) => offer.type !== "promotional") ??
      matching[0];
    return {
      sku: googleProductId,
      offerToken: preferred.offerTokenAndroid!,
    };
  }

  if (sub.platform === "android") {
    const legacy = sub.subscriptionOfferDetailsAndroid.filter(
      (offer) => offer.basePlanId === basePlanId && offer.offerToken,
    );
    const preferred = legacy.find((offer) => !offer.offerId) ?? legacy[0];
    if (preferred) {
      return { sku: googleProductId, offerToken: preferred.offerToken };
    }
  }

  return null;
}

export function useCreatorSubscriptionIap(
  username: string,
  options?: UseCreatorSubscriptionIapOptions,
) {
  const enabled = options?.enabled ?? true;
  const onSuccessRef = useRef(options?.onSuccess);

  useEffect(() => {
    onSuccessRef.current = options?.onSuccess;
  }, [options?.onSuccess]);

  const {
    connected: isIapConnected,
    subscriptions,
    fetchProducts,
    startPurchase,
    isProcessing: isIapProcessing,
  } = useIap();

  const {
    data: availability,
    isPending: isCheckingAvailability,
    isError: availabilityError,
    error: availabilityQueryError,
  } = useCheckSubscriptionAvailability(username, enabled);

  const assignedSku = availability?.available
    ? (availability.sku ?? null)
    : null;

  const storeProductId = useMemo(
    () => (assignedSku ? storeProductIdFromAvailabilitySku(assignedSku) : null),
    [assignedSku],
  );

  const androidSubscriptionOffer = useMemo(() => {
    if (Platform.OS !== "android" || !assignedSku || !storeProductId) {
      return null;
    }
    const basePlanId = assignedSku.google_base_plan_id?.trim();
    if (!basePlanId) return null;
    return pickAndroidSubscriptionOffer(
      subscriptions,
      storeProductId,
      basePlanId,
    );
  }, [assignedSku, storeProductId, subscriptions]);

  const availabilityBlocked = useMemo(
    () =>
      isCheckingAvailability
        ? null
        : getSubscriptionAvailabilityBlocked(
            availability,
            availabilityError,
            availabilityQueryError,
          ),
    [
      availability,
      availabilityError,
      availabilityQueryError,
      isCheckingAvailability,
    ],
  );

  useEffect(() => {
    if (!isIapConnected || !storeProductId) return;
    void fetchProducts({
      skus: [storeProductId],
      type: "subs",
    });
  }, [isIapConnected, storeProductId, fetchProducts]);

  const handleConfirmIap = useCallback(async () => {
    if (!assignedSku || !storeProductId) {
      Alert.alert(
        "Subscription unavailable",
        "Could not load the store subscription. Try again later.",
      );
      return;
    }
    if (!isIapConnected) {
      Alert.alert("Store unavailable", "Please try again in a moment.");
      return;
    }

    if (Platform.OS === "android" && !androidSubscriptionOffer) {
      Alert.alert(
        "Subscription unavailable",
        "Could not load the Play Store subscription offer. Try again in a moment.",
      );
      return;
    }

    try {
      await startPurchase({
        intent: {
          kind: "subscribe",
          creatorUsername: username,
          sku: assignedSku,
        },
        storeProductId,
        purchaseType: "subs",
        subscriptionOffers: androidSubscriptionOffer
          ? [androidSubscriptionOffer]
          : undefined,
        onSuccess: () => onSuccessRef.current?.(),
      });
    } catch (e) {
      Alert.alert(
        "Could not start purchase",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    }
  }, [
    androidSubscriptionOffer,
    assignedSku,
    isIapConnected,
    startPurchase,
    storeProductId,
    username,
  ]);

  const iapReady =
    Platform.OS === "ios" || Platform.OS === "android"
      ? Boolean(
          assignedSku &&
          storeProductId &&
          isIapConnected &&
          !availabilityError &&
          availability?.available === true &&
          (Platform.OS !== "android" || androidSubscriptionOffer != null),
        )
      : false;

  return {
    assignedSku,
    storeProductId,
    availability,
    isCheckingAvailability,
    availabilityError,
    availabilityBlocked,
    iapReady,
    isIapProcessing,
    handleConfirmIap,
  };
}
