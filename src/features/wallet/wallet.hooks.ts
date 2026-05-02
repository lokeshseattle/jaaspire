import { notificationCountsQueryKey } from "@/src/features/profile/notification.hooks";
import { messengerMessagesQueryKey } from "@/src/features/messenger/messenger-query-keys";
import { apiClient } from "@/src/services/api/api.client";
import { ApiError } from "@/src/services/api/api.error";
import type {
  CreatorDashboardStartLinkResponse,
  IapAppleVerifyRequest,
  IapGoogleVerifyRequest,
  IapVerifyResponse,
  MessengerMessagesResponse,
  SubscribeResponse,
  TipResponse,
  UnlockMessageResponse,
  UnlockPostResponse,
} from "@/src/services/api/api.types";
import type { InfiniteData } from "@tanstack/react-query";
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type { Purchase } from "expo-iap";
import { Platform } from "react-native";
import { usePostStore } from "../post/post.store";

function firstNonEmptyString(
  ...candidates: (string | null | undefined)[]
): string | undefined {
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (t.length > 0) return t;
  }
  return undefined;
}

/**
 * StoreKit 2 JWS for server verification. expo-iap exposes this on
 * `PurchaseCommon.purchaseToken` for iOS ("Unified purchase token").
 */
export function getAppleWalletIapJws(purchase: Purchase): string | undefined {
  const fromPurchase = firstNonEmptyString(purchase.purchaseToken);
  if (fromPurchase && fromPurchase.split(".").length >= 3) return fromPurchase;

  const rec = purchase as unknown as Record<string, unknown>;
  const alt = firstNonEmptyString(
    typeof rec.jwsRepresentationIos === "string"
      ? rec.jwsRepresentationIos
      : undefined,
    typeof rec.jwsRepresentation === "string"
      ? rec.jwsRepresentation
      : undefined,
  );
  return alt;
}

export function buildGoogleWalletIapVerifyBody(
  purchase: Purchase,
): IapGoogleVerifyRequest | null {
  const purchase_token = firstNonEmptyString(purchase.purchaseToken);
  const product_id = firstNonEmptyString(purchase.productId);
  if (!purchase_token || !product_id) return null;

  const rec = purchase as unknown as Record<string, unknown>;
  const order_id =
    firstNonEmptyString(
      typeof rec.orderId === "string" ? rec.orderId : undefined,
      purchase.transactionId,
      purchase.id,
    ) ?? "";

  return { purchase_token, product_id, order_id };
}

async function postIapVerify(
  url: string,
  body: IapAppleVerifyRequest | IapGoogleVerifyRequest,
): Promise<IapVerifyResponse> {
  const { data } = await apiClient.post<IapVerifyResponse>(url, body);
  if (!data.success) {
    throw new Error(data.message || "Purchase could not be verified.");
  }
  return data;
}

export async function verifyWalletIapOnServer(
  purchase: Purchase,
): Promise<IapVerifyResponse> {
  if (Platform.OS === "ios") {
    const jws = getAppleWalletIapJws(purchase);
    if (!jws) {
      throw new Error(
        "Missing Apple transaction data. Please try again or contact support.",
      );
    }
    const productid = purchase.productId?.trim();
    if (!productid) {
      throw new Error("Missing product for this purchase.");
    }
    return postIapVerify("/iap/apple/verify", { jws, product_id: productid });
  }

  if (Platform.OS === "android") {
    const body = buildGoogleWalletIapVerifyBody(purchase);
    if (!body) {
      throw new Error(
        "Missing Google Play purchase data. Please try again or contact support.",
      );
    }
    return postIapVerify("/iap/google/verify", body);
  }

  throw new Error(
    "In-app purchases are only available on the iOS or Android app.",
  );
}

export const useVerifyWalletIapPurchase = (): UseMutationResult<
  IapVerifyResponse,
  ApiError,
  Purchase
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (purchase: Purchase) => verifyWalletIapOnServer(purchase),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationCountsQueryKey,
      });
    },
  });
};

export const useCreatorDashboardStartLink = (): UseMutationResult<
  CreatorDashboardStartLinkResponse,
  ApiError,
  void
> =>
  useMutation({
    mutationFn: () =>
      apiClient
        .post<CreatorDashboardStartLinkResponse>(
          "/creator/dashboard/start-link",
        )
        .then((d) => d.data),
  });

export const useTipUser = (): UseMutationResult<
  TipResponse,
  Error,
  { username: string; amount: number }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ username, amount }) =>
      apiClient
        .post<TipResponse>(`/wallet/users/${username}/tip`, { amount })
        .then((d) => d.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: notificationCountsQueryKey,
      });
    },
  });
};

export const useSubscribeUser = (): UseMutationResult<
  SubscribeResponse,
  Error,
  { username: string }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ username }) =>
      apiClient
        .post<SubscribeResponse>(`/wallet/users/${username}/subscribe`, {
          plan: "1m",
        })
        .then((d) => d.data),
    onSuccess: (_data, { username }) => {
      const { posts, updatePost } = usePostStore.getState();
      Object.values(posts).forEach((post) => {
        if (post.user.username !== username) return;
        updatePost(post.id, (currentPost) => ({
          ...currentPost,
          viewer: {
            ...currentPost.viewer,
            has_subscription: true,
          },
        }));
      });

      void queryClient.invalidateQueries({
        queryKey: notificationCountsQueryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: ["profile", username],
      });
      void queryClient.invalidateQueries({
        queryKey: ["user_feed", username],
      });
    },
  });
};

export const useUnlockPost = (): UseMutationResult<
  UnlockPostResponse,
  Error,
  number
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: number) =>
      apiClient
        .post<UnlockPostResponse>(`/wallet/posts/${postId}/unlock`)
        .then((d) => d.data),

    onSuccess: (data, postId) => {
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

      void queryClient.invalidateQueries({
        queryKey: notificationCountsQueryKey,
      });
    },
  });
};

export const useUnlockMessage = (): UseMutationResult<
  UnlockMessageResponse,
  Error,
  { messageId: number; peerId: number }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId }) =>
      apiClient
        .post<UnlockMessageResponse>(`/wallet/messages/${messageId}/unlock`)
        .then((d) => d.data),

    onSuccess: (data, { messageId, peerId }) => {
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
    },
  });
};