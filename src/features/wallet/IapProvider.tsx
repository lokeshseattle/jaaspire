import { applyIapAccountTokenToPurchaseRequest } from "@/src/features/wallet/iap-account-token";
import { IapContext } from "@/src/features/wallet/iap.context";
import {
  findPendingIapRecordForPurchase,
  getActivePendingIapRecord,
  getFailedPendingIapRecords,
  loadPendingIapRecords,
  removePendingIapRecord,
  updatePendingIapRecord,
  upsertPendingIapRecord,
} from "@/src/features/wallet/iap-pending.storage";
import { processIapPurchase } from "@/src/features/wallet/iap-processor";
import { fetchAvailablePurchases } from "@/src/features/wallet/iap-sync";
import { dedupeKeyFromPurchase } from "@/src/features/wallet/iap-subscription.utils";
import type {
  IapPurchaseIntent,
  PendingIapRecord,
  StartPurchaseParams,
} from "@/src/features/wallet/iap.types";
import type { SubscriptionAvailabilitySku } from "@/src/services/api/api.types";
import { MAX_MANUAL_RETRY_COUNT } from "@/src/features/wallet/iap.types";
import {
  iapPlatform,
  invalidateCreatorSubscriptionCaches,
  postIapSubscribeAttempt,
} from "@/src/features/wallet/wallet.hooks";
import { notificationCountsQueryKey } from "@/src/features/profile/notification.hooks";
import { useQueryClient } from "@tanstack/react-query";
import {
  ErrorCode,
  useIAP,
  type Purchase,
} from "expo-iap";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState, Platform } from "react-native";

const SUBSCRIBE_ATTEMPT_MAX = 3;
const SUBSCRIBE_ATTEMPT_DELAYS_MS = [0, 1000, 2000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPendingRecord(
  params: StartPurchaseParams & { intent: IapPurchaseIntent },
): PendingIapRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    intent: params.intent,
    storeProductId: params.storeProductId,
    purchaseType: params.purchaseType,
    status: "awaiting_store",
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
}

type IapProviderProps = {
  children: React.ReactNode;
};

export function IapProvider({ children }: IapProviderProps) {
  const queryClient = useQueryClient();
  const [failedRecords, setFailedRecords] = useState<PendingIapRecord[]>([]);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const verifiedPurchaseKeysRef = useRef<Set<string>>(new Set());
  const verifyingPurchaseKeyRef = useRef<string | null>(null);
  const recoveryRanRef = useRef(false);
  const onSuccessCallbacksRef = useRef<Map<string, () => void>>(new Map());
  const finishTransactionRef = useRef<
    | ((args: { purchase: Purchase; isConsumable?: boolean }) => Promise<void>)
    | null
  >(null);
  const processPurchaseRef = useRef<
    (purchase: Purchase, record: PendingIapRecord | null) => Promise<void>
  >(() => Promise.resolve());

  const refreshFailedRecords = useCallback(async () => {
    setFailedRecords(await getFailedPendingIapRecords());
    const records = await loadPendingIapRecords();
    setPendingApproval(
      records.some((record) => record.status === "pending_approval"),
    );
  }, []);

  const applyProcessorSideEffects = useCallback(
    async (result: Awaited<ReturnType<typeof processIapPurchase>>) => {
      if (result.invalidateWallet) {
        await queryClient.invalidateQueries({
          queryKey: notificationCountsQueryKey,
        });
      }
      if (result.restoredUsernames?.length) {
        invalidateCreatorSubscriptionCaches(
          queryClient,
          result.restoredUsernames,
        );
      }
    },
    [queryClient],
  );

  const markRecordFailed = useCallback(
    async (record: PendingIapRecord, message: string) => {
      await updatePendingIapRecord(record.id, {
        status: "failed",
        lastError: message,
        retryCount: record.retryCount + 1,
      });
      await refreshFailedRecords();
    },
    [refreshFailedRecords],
  );

  const completeRecord = useCallback(
    async (record: PendingIapRecord) => {
      const callback = onSuccessCallbacksRef.current.get(record.id);
      onSuccessCallbacksRef.current.delete(record.id);
      await removePendingIapRecord(record.id);
      await refreshFailedRecords();
      callback?.();
    },
    [refreshFailedRecords],
  );

  const handlePurchaseProcessing = useCallback(
    async (purchase: Purchase, matchedRecord: PendingIapRecord | null) => {
      if (purchase.purchaseState === "pending") {
        const record =
          matchedRecord ??
          (await findPendingIapRecordForPurchase(
            purchase.productId,
            dedupeKeyFromPurchase(purchase),
          ));
        if (record) {
          await updatePendingIapRecord(record.id, {
            status: "pending_approval",
            purchaseDedupeKey:
              dedupeKeyFromPurchase(purchase) ?? record.purchaseDedupeKey,
          });
          await refreshFailedRecords();
        }
        setIsProcessing(false);
        return;
      }

      const dedupeKey = dedupeKeyFromPurchase(purchase);
      if (!dedupeKey) {
        setIsProcessing(false);
        Alert.alert(
          "Purchase incomplete",
          "Missing transaction data. Try Restore purchases in Settings.",
        );
        return;
      }

      if (verifiedPurchaseKeysRef.current.has(dedupeKey)) {
        setIsProcessing(false);
        return;
      }

      if (verifyingPurchaseKeyRef.current === dedupeKey) {
        return;
      }

      verifyingPurchaseKeyRef.current = dedupeKey;

      const record =
        matchedRecord ??
        (await findPendingIapRecordForPurchase(purchase.productId, dedupeKey));

      if (record) {
        await updatePendingIapRecord(record.id, {
          status: "awaiting_verify",
          purchaseDedupeKey: dedupeKey,
        });
      }

      try {
        const result = await processIapPurchase(
          purchase,
          record?.intent ?? null,
        );
        verifiedPurchaseKeysRef.current.add(dedupeKey);
        await finishTransactionRef.current?.({
          purchase,
          isConsumable: result.isConsumable,
        });
        await applyProcessorSideEffects(result);
        if (record) {
          await completeRecord(record);
        }
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Could not complete purchase. Try again.";
        if (record) {
          await markRecordFailed(record, message);
        }
        Alert.alert("Purchase verification failed", message);
        throw e;
      } finally {
        if (verifyingPurchaseKeyRef.current === dedupeKey) {
          verifyingPurchaseKeyRef.current = null;
        }
        setIsProcessing(false);
      }
    },
    [
      applyProcessorSideEffects,
      completeRecord,
      markRecordFailed,
      refreshFailedRecords,
    ],
  );

  useEffect(() => {
    processPurchaseRef.current = handlePurchaseProcessing;
  }, [handlePurchaseProcessing]);

  const {
    connected,
    reconnect,
    fetchProducts,
    products,
    subscriptions,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const record = await findPendingIapRecordForPurchase(
        purchase.productId,
        dedupeKeyFromPurchase(purchase),
      );
      await processPurchaseRef.current(purchase, record);
    },
    onPurchaseError: (error) => {
      setIsProcessing(false);
      void (async () => {
        const active = await getActivePendingIapRecord();
        if (active?.status === "awaiting_store") {
          await removePendingIapRecord(active.id);
          onSuccessCallbacksRef.current.delete(active.id);
          await refreshFailedRecords();
        }
      })();

      if (error.code === ErrorCode.UserCancelled) return;
      Alert.alert(
        "Purchase failed",
        error.message ?? "Could not complete purchase. Try again later.",
      );
    },
  });

  useEffect(() => {
    finishTransactionRef.current = finishTransaction;
  }, [finishTransaction]);

  const runStartupRecovery = useCallback(async () => {
    if (!connected || recoveryRanRef.current) return;
    recoveryRanRef.current = true;

    const records = await loadPendingIapRecords();
    const purchases = await fetchAvailablePurchases();

    for (const record of records) {
      if (record.status !== "failed" || record.retryCount >= 1) continue;
      const purchase = purchases.find(
        (item) =>
          dedupeKeyFromPurchase(item) === record.purchaseDedupeKey ||
          item.productId === record.storeProductId,
      );
      if (!purchase || purchase.purchaseState === "pending") continue;
      try {
        await handlePurchaseProcessing(purchase, record);
      } catch {
        // Failed records surface in recovery banner.
      }
    }

    for (const purchase of purchases) {
      const dedupeKey = dedupeKeyFromPurchase(purchase);
      const existing = await findPendingIapRecordForPurchase(
        purchase.productId,
        dedupeKey,
      );
      if (existing) {
        if (
          existing.status === "awaiting_store" ||
          existing.status === "pending_approval" ||
          existing.status === "failed"
        ) {
          try {
            await handlePurchaseProcessing(purchase, existing);
          } catch {
            // Leave failed record for manual retry.
          }
        }
        continue;
      }

      // No pending intent — subscription restore is manual via Settings only.
    }

    await refreshFailedRecords();
  }, [connected, handlePurchaseProcessing, refreshFailedRecords]);

  useEffect(() => {
    void runStartupRecovery();
  }, [runStartupRecovery]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !connected) return;
      void (async () => {
        const records = await loadPendingIapRecords();
        const hasPendingApproval = records.some(
          (record) => record.status === "pending_approval",
        );
        if (!hasPendingApproval) return;
        const purchases = await fetchAvailablePurchases();
        for (const record of records) {
          if (record.status !== "pending_approval") continue;
          const purchase = purchases.find(
            (item) =>
              item.productId === record.storeProductId ||
              dedupeKeyFromPurchase(item) === record.purchaseDedupeKey,
          );
          if (!purchase) continue;
          try {
            await handlePurchaseProcessing(purchase, record);
          } catch {
            // Keep banner visible.
          }
        }
      })();
    });
    return () => subscription.remove();
  }, [connected, handlePurchaseProcessing]);

  const startSubscribeAttempt = useCallback(
    async (
      creatorUsername: string,
      groupId: number,
    ): Promise<{ attemptId: number; sku: SubscriptionAvailabilitySku }> => {
      let lastError: unknown;
      for (let i = 0; i < SUBSCRIBE_ATTEMPT_MAX; i++) {
        if (SUBSCRIBE_ATTEMPT_DELAYS_MS[i] > 0) {
          await sleep(SUBSCRIBE_ATTEMPT_DELAYS_MS[i]);
        }
        try {
          const response = await postIapSubscribeAttempt({
            platform: iapPlatform(),
            group_id: groupId,
            creator_username: creatorUsername,
          });
          return { attemptId: response.attempt_id, sku: response.sku };
        } catch (e) {
          lastError = e;
        }
      }
      throw (
        lastError instanceof Error
          ? lastError
          : new Error("Could not start subscription. Try again.")
      );
    },
    [],
  );

  const startPurchase = useCallback(
    async (params: StartPurchaseParams) => {
      if (Platform.OS !== "ios" && Platform.OS !== "android") {
        throw new Error(
          "In-app purchases are only available on the iOS or Android app.",
        );
      }

      if (!connected) {
        throw new Error("Store unavailable. Please try again in a moment.");
      }

      const active = await getActivePendingIapRecord();
      if (active) {
        throw new Error(
          "A purchase is already in progress. Finish or retry it before starting another.",
        );
      }

      let intent: IapPurchaseIntent;
      if (params.intent.kind === "subscribe") {
        const attempt = await startSubscribeAttempt(
          params.intent.creatorUsername,
          params.intent.sku.group_id,
        );
        intent = {
          kind: "subscribe",
          creatorUsername: params.intent.creatorUsername,
          sku: attempt.sku,
          attemptId: attempt.attemptId,
        };
      } else {
        intent = params.intent;
      }

      const record = createPendingRecord({ ...params, intent });
      await upsertPendingIapRecord(record);
      if (params.onSuccess) {
        onSuccessCallbacksRef.current.set(record.id, params.onSuccess);
      }
      await refreshFailedRecords();

      setIsProcessing(true);
      try {
        const purchaseRequest = await applyIapAccountTokenToPurchaseRequest({
          apple: { sku: params.storeProductId },
          google: {
            skus: [params.storeProductId],
            ...(params.subscriptionOffers?.length
              ? { subscriptionOffers: params.subscriptionOffers }
              : {}),
          },
        });

        await requestPurchase({
          type: params.purchaseType === "subs" ? "subs" : "in-app",
          request: purchaseRequest,
        });
      } catch (e) {
        await removePendingIapRecord(record.id);
        onSuccessCallbacksRef.current.delete(record.id);
        setIsProcessing(false);
        throw e;
      }
    },
    [
      connected,
      refreshFailedRecords,
      requestPurchase,
      startSubscribeAttempt,
    ],
  );

  const retryFailedPurchase = useCallback(
    async (recordId: string) => {
      const records = await loadPendingIapRecords();
      const record = records.find((item) => item.id === recordId);
      if (!record || record.status !== "failed") return;

      if (record.retryCount >= MAX_MANUAL_RETRY_COUNT) {
        Alert.alert(
          "Retry limit reached",
          "Contact support if you still need help recovering this purchase.",
        );
        return;
      }

      if (!record.purchaseDedupeKey) {
        Alert.alert(
          "Cannot retry",
          "Missing purchase data. Try Restore purchases in Settings.",
        );
        return;
      }

      setIsProcessing(true);
      try {
        const purchases = await fetchAvailablePurchases();
        const purchase = purchases.find(
          (item) => dedupeKeyFromPurchase(item) === record.purchaseDedupeKey,
        );
        if (!purchase) {
          throw new Error(
            "Purchase not found in the store. Try Restore purchases in Settings.",
          );
        }
        await updatePendingIapRecord(record.id, { status: "awaiting_verify" });
        await handlePurchaseProcessing(purchase, record);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Retry failed. Try again later.";
        Alert.alert("Retry failed", message);
        setIsProcessing(false);
      }
    },
    [handlePurchaseProcessing],
  );

  const dismissFailedPurchase = useCallback(
    async (recordId: string) => {
      await removePendingIapRecord(recordId);
      onSuccessCallbacksRef.current.delete(recordId);
      await refreshFailedRecords();
    },
    [refreshFailedRecords],
  );

  const value = useMemo(
    () => ({
      connected,
      reconnect,
      fetchProducts,
      products,
      subscriptions,
      startPurchase,
      retryFailedPurchase,
      dismissFailedPurchase,
      pendingApproval,
      failedRecords,
      isProcessing,
    }),
    [
      connected,
      reconnect,
      fetchProducts,
      products,
      subscriptions,
      startPurchase,
      retryFailedPurchase,
      dismissFailedPurchase,
      pendingApproval,
      failedRecords,
      isProcessing,
    ],
  );

  return <IapContext.Provider value={value}>{children}</IapContext.Provider>;
}
