import { messengerMessagesQueryKey } from "@/src/features/messenger/messenger-query-keys";
import { notificationCountsQueryKey } from "@/src/features/profile/notification.hooks";
// Dev subscription / IAP debug (commented out for production)
// import {
//   logSubscriptionDebug,
//   recordIapDev,
//   sanitizeSubscribeRequestForLog,
//   SUBSCRIPTION_DEBUG_LOG,
// } from "@/src/features/wallet/iap-dev.store";
import { apiClient } from "@/src/services/api/api.client";
import { ApiError } from "@/src/services/api/api.error";
import type {
  CreatorDashboardStartLinkResponse,
  IapAppleVerifyRequest,
  IapGoogleVerifyRequest,
  IapRestoreErrorCode,
  IapRestoreRequest,
  IapRestoreResponse,
  IapSkuCategory,
  IapSkusResponse,
  IapSubscribeAttemptRequest,
  IapSubscribeAttemptResponse,
  IapSubscribeRequest,
  IapSubscribeResponse,
  IapVerifyResponse,
  MessengerMessagesResponse,
  SubscribeResponse,
  SubscriptionAvailabilityResponse,
  SubscriptionAvailabilitySku,
  TipResponse,
  UnlockMessageResponse,
  UnlockPostResponse,
} from "@/src/services/api/api.types";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import {
  useMutation,
  useQuery,
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
  let recorded = false;
  try {
    const { data } = await apiClient.post<IapVerifyResponse>(url, body);
    if (!data.success) {
      const message = data.message || "Purchase could not be verified.";
      // recordIapDev({
      //   phase: "verify",
      //   status: "failure",
      //   summary: message,
      //   payload: { request: body, response: data },
      // });
      recorded = true;
      throw new Error(message);
    }
    // recordIapDev({
    //   phase: "verify",
    //   status: "success",
    //   summary: url,
    //   payload: { request: body, response: data },
    // });
    recorded = true;
    return data;
  } catch (e) {
    if (!recorded) {
      // recordIapDev({
      //   phase: "verify",
      //   status: "failure",
      //   summary: e instanceof Error ? e.message : "IAP verify request failed",
      //   payload: { request: body, error: e },
      // });
    }
    throw e;
  }
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

export function iapSkusQueryKey(category: IapSkuCategory) {
  return ["iap", "sku", category] as const;
}

export function useIapSkus(category: IapSkuCategory) {
  return useQuery({
    queryKey: iapSkusQueryKey(category),
    queryFn: () =>
      apiClient
        .get<IapSkusResponse>("/iap/sku", { params: { category } })
        .then((res) => res.data),
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });
}

export function subscriptionAvailabilityQueryKey(username: string) {
  return ["iap", "subscription", "availability", username] as const;
}

export function useCheckSubscriptionAvailability(
  username: string,
  enabled = true,
) {
  return useQuery({
    queryKey: subscriptionAvailabilityQueryKey(username),
    queryFn: () =>
      apiClient
        .get<SubscriptionAvailabilityResponse>(
          `/iap/subscription/${encodeURIComponent(username)}/availability`,
        )
        .then((res) => res.data),
    // queryFn: async () => {
    //   const path = `/iap/subscription/${encodeURIComponent(username)}/availability`;
    //   logSubscriptionDebug("availability:request", { username, path });
    //   try {
    //     const { data } = await apiClient.get<SubscriptionAvailabilityResponse>(
    //       path,
    //     );
    //     logSubscriptionDebug("availability:response", data, {
    //       phase: "availability",
    //       status: data.available ? "success" : "failure",
    //       summary: data.available
    //         ? `Available: ${data.sku?.sku_key ?? "sku"}`
    //         : "Subscriptions unavailable",
    //       payload: data,
    //     });
    //     return data;
    //   } catch (e) {
    //     logSubscriptionDebug("availability:error", e, {
    //       phase: "availability",
    //       status: "failure",
    //       summary:
    //         e instanceof Error
    //           ? e.message
    //           : "Availability check failed",
    //       payload: { username, error: e },
    //     });
    //     throw e;
    //   }
    // },
    enabled: enabled && username.trim().length > 0,
    staleTime: 0,
    retry: 1,
  });
}

export type SubscriptionAvailabilityBlocked = {
  message: string;
  reason?: string;
};

/** User-facing copy when GET availability returns `available: false` or the request fails. */
export function getSubscriptionAvailabilityBlocked(
  availability: SubscriptionAvailabilityResponse | undefined,
  availabilityError: boolean,
  queryError: unknown,
): SubscriptionAvailabilityBlocked | null {
  if (availabilityError) {
    if (queryError instanceof ApiError && queryError.message.trim()) {
      return { message: queryError.message.trim() };
    }
    if (queryError instanceof Error && queryError.message.trim()) {
      return { message: queryError.message.trim() };
    }
    return {
      message:
        "Could not check subscription availability. Try again later.",
    };
  }

  if (!availability || availability.available) return null;

  const message =
    availability.message?.trim() ||
    "Subscriptions are temporarily unavailable.";
  const reason = availability.reason?.trim();

  return reason ? { message, reason } : { message };
}

export function iapPlatform(): "apple" | "google" {
  if (Platform.OS === "ios") return "apple";
  if (Platform.OS === "android") return "google";
  throw new Error(
    "In-app purchases are only available on the iOS or Android app.",
  );
}

export async function postIapSubscribeAttempt(
  body: IapSubscribeAttemptRequest,
): Promise<IapSubscribeAttemptResponse> {
  const { data } = await apiClient.post<IapSubscribeAttemptResponse>(
    "/iap/subscribe/attempt",
    body,
  );
  if (!data.success) {
    throw new Error("Subscription attempt could not be started.");
  }
  return data;
}

export function buildIapSubscribeBody(
  purchase: Purchase,
  creatorUsername: string,
  sku: SubscriptionAvailabilitySku,
  attemptId?: number | null,
): IapSubscribeRequest {
  // console.log(SUBSCRIPTION_DEBUG_LOG, "buildIapSubscribeBody:start", {
  //   creatorUsername,
  //   sku_key: sku.sku_key,
  //   productId: purchase.productId,
  //   platform: Platform.OS,
  // });

  if (Platform.OS === "ios") {
    const jws = getAppleWalletIapJws(purchase);
    if (!jws) {
      // console.warn(SUBSCRIPTION_DEBUG_LOG, "buildIapSubscribeBody:missing JWS");
      throw new Error(
        "Missing Apple transaction data. Please try again or contact support.",
      );
    }
    const product_id =
      firstNonEmptyString(purchase.productId, sku.apple_sku) ?? "";
    if (!product_id) {
      throw new Error("Missing product for this purchase.");
    }
    return {
      platform: "apple",
      creator_username: creatorUsername,
      jws,
      product_id,
      ...(attemptId != null ? { attempt_id: attemptId } : {}),
    };
    // console.log(
    //   SUBSCRIPTION_DEBUG_LOG,
    //   "buildIapSubscribeBody:apple",
    //   sanitizeSubscribeRequestForLog(body),
    // );
  }

  if (Platform.OS === "android") {
    const purchase_token = firstNonEmptyString(purchase.purchaseToken);
    if (!purchase_token) {
      throw new Error(
        "Missing Google Play purchase data. Please try again or contact support.",
      );
    }
    const google_product_id = sku.google_product_id?.trim();
    const base_plan_id = sku.google_base_plan_id?.trim();
    if (!google_product_id || !base_plan_id) {
      throw new Error("Missing subscription product configuration.");
    }
    return {
      platform: "google",
      creator_username: creatorUsername,
      purchase_token,
      google_product_id,
      base_plan_id,
      ...(attemptId != null ? { attempt_id: attemptId } : {}),
    };
    // console.log(
    //   SUBSCRIPTION_DEBUG_LOG,
    //   "buildIapSubscribeBody:google",
    //   sanitizeSubscribeRequestForLog(body),
    // );
  }

  throw new Error(
    "In-app purchases are only available on the iOS or Android app.",
  );
}

export async function postIapSubscribe(
  body: IapSubscribeRequest,
): Promise<IapSubscribeResponse> {
  // const safeBody = sanitizeSubscribeRequestForLog(body);
  // console.log(SUBSCRIPTION_DEBUG_LOG, "postIapSubscribe:request", safeBody);
  try {
    const { data } = await apiClient.post<IapSubscribeResponse>(
      "/iap/subscribe",
      body,
    );
    // console.log(SUBSCRIPTION_DEBUG_LOG, "postIapSubscribe:response", data);
    if (!data.success) {
      const message = data.message || "Subscription could not be verified.";
      // recordIapDev({
      //   phase: "subscribe",
      //   status: "failure",
      //   summary: message,
      //   payload: { request: body, response: data },
      // });
      throw new Error(message);
    }
    // recordIapDev({
    //   phase: "subscribe",
    //   status: "success",
    //   summary: "POST /iap/subscribe",
    //   payload: { request: body, response: data },
    // });
    return data;
  } catch (e) {
    // recordIapDev({
    //   phase: "subscribe",
    //   status: "failure",
    //   summary:
    //     e instanceof Error ? e.message : "IAP subscribe request failed",
    //   payload: { request: body, error: e },
    // });
    throw e;
  }
}

export class IapRestoreError extends Error {
  code: IapRestoreErrorCode;

  constructor(code: IapRestoreErrorCode, message: string) {
    super(message);
    this.name = "IapRestoreError";
    this.code = code;
  }
}

function parseIapRestoreErrorCode(data: unknown): IapRestoreErrorCode | null {
  if (!data || typeof data !== "object") return null;
  const code = (data as { code?: unknown }).code;
  if (
    code === "RECEIPT_INVALID" ||
    code === "BUYER_MISMATCH" ||
    code === "UPSTREAM_UNAVAILABLE"
  ) {
    return code;
  }
  return null;
}

export async function postIapRestore(
  body: IapRestoreRequest,
): Promise<IapRestoreResponse> {
  try {
    const { data } = await apiClient.post<IapRestoreResponse>(
      "/iap/restore",
      body,
    );
    if (!data.success) {
      throw new Error("Purchase could not be restored.");
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) {
      const code = parseIapRestoreErrorCode(e.data);
      if (code) {
        throw new IapRestoreError(code, e.message);
      }
    }
    throw e;
  }
}

export function invalidateCreatorSubscriptionCaches(
  queryClient: QueryClient,
  usernames: string[],
): void {
  const uniqueUsernames = [...new Set(usernames.map((u) => u.trim()).filter(Boolean))];

  const { posts, updatePost } = usePostStore.getState();
  for (const post of Object.values(posts)) {
    if (!uniqueUsernames.includes(post.user.username)) continue;
    updatePost(post.id, (currentPost) => ({
      ...currentPost,
      viewer: {
        ...currentPost.viewer,
        has_subscription: true,
      },
    }));
  }

  void queryClient.invalidateQueries({
    queryKey: notificationCountsQueryKey,
  });
  void queryClient.invalidateQueries({
    queryKey: ["settings", "subscriptions"],
  });

  for (const username of uniqueUsernames) {
    void queryClient.invalidateQueries({
      queryKey: ["profile", username],
    });
    void queryClient.invalidateQueries({
      queryKey: ["user_feed", username],
    });
  }
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
  { username: string; sku_key: string }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ username, sku_key }) =>
      apiClient
        .post<TipResponse>(`/wallet/users/${username}/tip`, { sku_key })
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
  { username: string; sku_key: string }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ username, sku_key }) =>
      apiClient
        .post<SubscribeResponse>(`/wallet/users/${username}/subscribe`, {
          sku_key,
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
