import {
  buildIapRestoreBodyFromPurchase,
  isCreatorSubscriptionProductId,
} from "@/src/features/wallet/iap-subscription.utils";
import type {
  IapPurchaseIntent,
  IapProcessorResult,
} from "@/src/features/wallet/iap.types";
import {
  buildIapSubscribeBody,
  postIapRestore,
  postIapSubscribe,
  verifyWalletIapOnServer,
} from "@/src/features/wallet/wallet.hooks";
import { messengerMessagesQueryKey } from "@/src/features/messenger/messenger-query-keys";
import { usePostStore } from "@/src/features/post/post.store";
import { apiClient } from "@/src/services/api/api.client";
import type {
  IapSubscribeRequest,
  IapSubscribeResponse,
  MessengerMessagesResponse,
  TipResponse,
  UnlockMessageResponse,
  UnlockPostResponse,
} from "@/src/services/api/api.types";
import type { InfiniteData } from "@tanstack/react-query";
import type { Purchase } from "expo-iap";
import { queryClient } from "@/src/lib/query-client";
import { notificationCountsQueryKey } from "@/src/features/profile/notification.hooks";

/** Server verify attempts (1 initial + retries only after failure). */
const SUBSCRIBE_VERIFY_MAX_ATTEMPTS = 2;
const SUBSCRIBE_VERIFY_RETRY_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postIapSubscribeWithRetries(
  body: IapSubscribeRequest,
): Promise<IapSubscribeResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SUBSCRIBE_VERIFY_MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      await sleep(SUBSCRIBE_VERIFY_RETRY_DELAY_MS);
    }
    try {
      return await postIapSubscribe(body);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

async function unlockPostOnServer(postId: number): Promise<void> {
  const { data } = await apiClient.post<UnlockPostResponse>(
    `/wallet/posts/${postId}/unlock`,
  );
  if (!data.success) {
    throw new Error("Could not unlock post after purchase.");
  }

  const unlockedPath = data.path.find(
    (path) => typeof path === "string" && path.trim().length > 0,
  );

  usePostStore.getState().updatePost(postId, (post) => ({
    ...post,
    is_locked: false,
    viewer: {
      ...post.viewer,
      has_purchased: true,
    },
    attachments: post.attachments.map((attachment, index) =>
      index === 0
        ? {
            ...attachment,
            path: unlockedPath ?? attachment.path,
          }
        : attachment,
    ),
  }));
}

async function unlockMessageOnServer(
  messageId: number,
  peerId: number,
): Promise<void> {
  const { data } = await apiClient.post<UnlockMessageResponse>(
    `/wallet/messages/${messageId}/unlock`,
  );
  if (!data.success) {
    throw new Error("Could not unlock message after purchase.");
  }

  const unlockedPath = data.path.find(
    (p) => typeof p === "string" && p.trim().length > 0,
  );

  queryClient.setQueryData<InfiniteData<MessengerMessagesResponse>>(
    messengerMessagesQueryKey(peerId),
    (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          data: {
            ...page.data,
            messages: page.data.messages.map((m) => {
              if (Number(m.id) !== messageId) return m;
              return {
                ...m,
                hasUserUnlockedMessage: true,
                attachments: m.attachments?.map((a, index) =>
                  index === 0 && unlockedPath
                    ? { ...a, path: unlockedPath }
                    : a,
                ),
              };
            }),
          },
        })),
      };
    },
  );

  void queryClient.invalidateQueries({
    queryKey: notificationCountsQueryKey,
  });
}

async function tipUserOnServer(
  username: string,
  sku_key: string,
): Promise<void> {
  const { data } = await apiClient.post<TipResponse>(
    `/wallet/users/${username}/tip`,
    { sku_key },
  );
  if (!data.success) {
    throw new Error("Could not send tip after purchase.");
  }
}

async function processOrphanPurchase(
  purchase: Purchase,
): Promise<IapProcessorResult> {
  if (isCreatorSubscriptionProductId(purchase.productId)) {
    const body = buildIapRestoreBodyFromPurchase(purchase);
    if (!body) {
      throw new Error("Missing subscription data for restore.");
    }
    const response = await postIapRestore(body);
    if ("restored" in response && response.restored) {
      return {
        isConsumable: false,
        restoredUsernames: [response.subscription.creator.username],
      };
    }
    if ("orphan" in response && response.orphan) {
      throw new Error(
        response.message ||
          "Purchase could not be linked automatically. Contact support.",
      );
    }
    throw new Error("Purchase could not be restored.");
  }

  await verifyWalletIapOnServer(purchase);
  return { isConsumable: true, invalidateWallet: true };
}

/**
 * Route a store purchase to the correct backend action.
 * If unlock/tip intent is lost but consumable verify succeeds, stars are credited
 * and the user can retry the action manually from wallet balance.
 */
export async function processIapPurchase(
  purchase: Purchase,
  intent: IapPurchaseIntent | null,
): Promise<IapProcessorResult> {
  if (!intent) {
    return processOrphanPurchase(purchase);
  }

  switch (intent.kind) {
    case "wallet_topup": {
      await verifyWalletIapOnServer(purchase);
      return { isConsumable: true, invalidateWallet: true };
    }
    case "subscribe": {
      const body = buildIapSubscribeBody(
        purchase,
        intent.creatorUsername,
        intent.sku,
        intent.attemptId,
      );
      await postIapSubscribeWithRetries(body);
      return {
        isConsumable: false,
        restoredUsernames: [intent.creatorUsername],
      };
    }
    case "unlock_post": {
      await verifyWalletIapOnServer(purchase);
      await unlockPostOnServer(intent.postId);
      return { isConsumable: true, invalidateWallet: true };
    }
    case "unlock_message": {
      await verifyWalletIapOnServer(purchase);
      await unlockMessageOnServer(intent.messageId, intent.peerId);
      return { isConsumable: true, invalidateWallet: true };
    }
    case "tip": {
      await verifyWalletIapOnServer(purchase);
      await tipUserOnServer(intent.username, intent.sku_key);
      return { isConsumable: true, invalidateWallet: true };
    }
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}
