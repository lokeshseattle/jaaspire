import { getAppleWalletIapJws } from "@/src/features/wallet/wallet.hooks";
import type {
  IapRestoreRequest,
} from "@/src/services/api/api.types";
import type { ActiveSubscription, Purchase } from "expo-iap";
import { Platform } from "react-native";

const CREATOR_SUBSCRIPTION_PRODUCT_RE =
  /^com\.convoia\.jaaspire\.g\d+(?:\.sub_t\d+)?$/i;

const CREATOR_SUBSCRIPTION_GROUP_RE = /^com\.convoia\.jaaspire\.g\d+$/i;

export function isCreatorSubscriptionProductId(productId: string): boolean {
  const id = productId.trim();
  return (
    CREATOR_SUBSCRIPTION_PRODUCT_RE.test(id) ||
    CREATOR_SUBSCRIPTION_GROUP_RE.test(id)
  );
}

export function dedupeKeyFromPurchase(purchase: Purchase): string | null {
  const ios = purchase as Purchase & {
    originalTransactionIdentifierIOS?: string | null;
  };
  const original = ios.originalTransactionIdentifierIOS?.trim();
  if (original) return `apple:${original}`;

  const token = purchase.purchaseToken?.trim();
  if (token) return `google:${token}`;

  const txId = (purchase.transactionId ?? purchase.id)?.trim();
  if (txId) return `tx:${txId}:${purchase.productId}`;
  return null;
}

export function dedupeKeyFromActiveSubscription(
  sub: ActiveSubscription,
): string {
  const token = sub.purchaseToken?.trim() ?? sub.purchaseTokenAndroid?.trim();
  if (token) return `google:${token}`;
  const txId = sub.transactionId?.trim();
  if (txId) return `apple:${txId}`;
  return `product:${sub.productId}`;
}

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

/** Prefer currentPlanId — matches Play line item used for server verification. */
function googleBasePlanIdFromPurchase(purchase: Purchase): string | undefined {
  return firstNonEmptyString(
    purchase.currentPlanId,
    (purchase as Purchase & { basePlanIdAndroid?: string }).basePlanIdAndroid,
  );
}

function googleBasePlanIdFromActiveSubscription(
  sub: ActiveSubscription,
): string | undefined {
  return firstNonEmptyString(sub.currentPlanId, sub.basePlanIdAndroid);
}

function buildGoogleIapRestoreBody(
  purchase?: Purchase,
  sub?: ActiveSubscription,
): IapRestoreRequest | null {
  const purchase_token = firstNonEmptyString(
    purchase?.purchaseToken,
    sub?.purchaseToken,
    sub?.purchaseTokenAndroid,
  );
  const google_product_id = firstNonEmptyString(
    purchase?.productId,
    sub?.productId,
  );
  const base_plan_id = firstNonEmptyString(
    purchase ? googleBasePlanIdFromPurchase(purchase) : undefined,
    sub ? googleBasePlanIdFromActiveSubscription(sub) : undefined,
  );
  if (!purchase_token || !google_product_id || !base_plan_id) return null;
  return {
    platform: "google",
    purchase_token,
    google_product_id,
    base_plan_id,
  };
}

export function findActiveSubscriptionForPurchase(
  purchase: Purchase,
  activeSubscriptions: ActiveSubscription[],
): ActiveSubscription | undefined {
  const dedupe = dedupeKeyFromPurchase(purchase);
  if (dedupe) {
    const match = activeSubscriptions.find(
      (sub) =>
        sub.isActive && dedupeKeyFromActiveSubscription(sub) === dedupe,
    );
    if (match) return match;
  }
  return activeSubscriptions.find(
    (sub) => sub.isActive && sub.productId === purchase.productId,
  );
}

function findPurchaseForActiveSubscription(
  sub: ActiveSubscription,
  purchasesByTxId: Map<string, Purchase>,
): Purchase | undefined {
  const txId = sub.transactionId?.trim();
  if (txId) {
    const byTx = purchasesByTxId.get(txId);
    if (byTx) return byTx;
  }

  const byDedupe = purchasesByTxId.get(dedupeKeyFromActiveSubscription(sub));
  if (byDedupe) return byDedupe;

  const token = firstNonEmptyString(sub.purchaseToken, sub.purchaseTokenAndroid);
  if (token) {
    const byToken = purchasesByTxId.get(`google:${token}`);
    if (byToken) return byToken;
  }

  return [...purchasesByTxId.values()].find((p) => p.productId === sub.productId);
}

export function buildIapRestoreBodyFromPurchase(
  purchase: Purchase,
  activeSub?: ActiveSubscription,
): IapRestoreRequest | null {
  if (!isCreatorSubscriptionProductId(purchase.productId)) return null;

  if (Platform.OS === "ios") {
    const jws = getAppleWalletIapJws(purchase);
    if (!jws) return null;
    return { platform: "apple", jws };
  }

  if (Platform.OS === "android") {
    return buildGoogleIapRestoreBody(purchase, activeSub);
  }

  return null;
}

export function buildIapRestoreBodyFromActiveSubscription(
  sub: ActiveSubscription,
  purchasesByTxId: Map<string, Purchase>,
): IapRestoreRequest | null {
  if (!sub.isActive || !isCreatorSubscriptionProductId(sub.productId)) {
    return null;
  }

  const purchase = findPurchaseForActiveSubscription(sub, purchasesByTxId);

  if (Platform.OS === "ios") {
    if (purchase) {
      const body = buildIapRestoreBodyFromPurchase(purchase);
      if (body) return body;
    }
    return null;
  }

  if (Platform.OS === "android") {
    return buildGoogleIapRestoreBody(purchase, sub);
  }

  return null;
}

export function indexPurchasesByTransactionId(
  purchases: Purchase[],
): Map<string, Purchase> {
  const map = new Map<string, Purchase>();
  for (const purchase of purchases) {
    const txId = (purchase.transactionId ?? purchase.id)?.trim();
    if (txId) map.set(txId, purchase);
    const dedupe = dedupeKeyFromPurchase(purchase);
    if (dedupe) map.set(dedupe, purchase);
  }
  return map;
}
