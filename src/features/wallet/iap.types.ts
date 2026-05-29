import type { SubscriptionAvailabilitySku } from "@/src/services/api/api.types";

/** Intent stored after subscribe attempt is created. */
export type IapPurchaseIntent =
  | { kind: "wallet_topup" }
  | {
      kind: "subscribe";
      creatorUsername: string;
      sku: SubscriptionAvailabilitySku;
      attemptId: number;
    }
  | { kind: "unlock_post"; postId: number }
  | { kind: "unlock_message"; messageId: number; peerId: number }
  | { kind: "tip"; username: string; sku_key: string; stars: number };

/** Intent passed into startPurchase (subscribe attempt is created by the provider). */
export type StartPurchaseIntent =
  | { kind: "wallet_topup" }
  | {
      kind: "subscribe";
      creatorUsername: string;
      sku: SubscriptionAvailabilitySku;
    }
  | { kind: "unlock_post"; postId: number }
  | { kind: "unlock_message"; messageId: number; peerId: number }
  | { kind: "tip"; username: string; sku_key: string; stars: number };

export type PendingIapStatus =
  | "awaiting_store"
  | "awaiting_verify"
  | "pending_approval"
  | "failed";

export type PendingIapRecord = {
  id: string;
  intent: IapPurchaseIntent;
  storeProductId: string;
  purchaseType: "in-app" | "subs";
  status: PendingIapStatus;
  purchaseDedupeKey?: string;
  lastError?: string;
  retryCount: number;
  createdAt: string;
};

export type AndroidSubscriptionOffer = {
  sku: string;
  offerToken: string;
};

export type StartPurchaseParams = {
  intent: StartPurchaseIntent;
  storeProductId: string;
  purchaseType: "in-app" | "subs";
  subscriptionOffers?: AndroidSubscriptionOffer[];
  onSuccess?: () => void;
};

export type IapProcessorResult = {
  isConsumable: boolean;
  restoredUsernames?: string[];
  invalidateWallet?: boolean;
};

export const ACTIVE_PENDING_STATUSES: PendingIapStatus[] = [
  "awaiting_store",
  "awaiting_verify",
  "pending_approval",
];

export const MAX_MANUAL_RETRY_COUNT = 3;
