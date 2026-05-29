import {
  buildIapRestoreBodyFromActiveSubscription,
  buildIapRestoreBodyFromPurchase,
  dedupeKeyFromActiveSubscription,
  dedupeKeyFromPurchase,
  findActiveSubscriptionForPurchase,
  indexPurchasesByTransactionId,
  isCreatorSubscriptionProductId,
} from "@/src/features/wallet/iap-subscription.utils";
import {
  IapRestoreError,
  postIapRestore,
  verifyWalletIapOnServer,
} from "@/src/features/wallet/wallet.hooks";
import type { IapRestoreRequest } from "@/src/services/api/api.types";
import {
  finishTransaction,
  getActiveSubscriptions,
  getAvailablePurchases,
  restorePurchases,
  type ActiveSubscription,
  type Purchase,
} from "expo-iap";

export type SyncCreatorSubscriptionsOutcome = {
  restored: number;
  orphans: number;
  skipped: number;
  buyerMismatch: boolean;
  upstreamUnavailable: boolean;
  otherErrors: string[];
  restoredUsernames: string[];
};

export type SyncStorePurchasesOutcome = SyncCreatorSubscriptionsOutcome & {
  walletVerified: number;
  walletSkipped: number;
};

export type CollectRestoreBodiesResult = {
  restoreBodies: IapRestoreRequest[];
  purchasesToFinish: Purchase[];
  skipped: number;
};

function bodyDedupeKey(body: IapRestoreRequest): string {
  if (body.platform === "apple") {
    return `apple:${body.jws.slice(0, 48)}`;
  }
  return `google:${body.purchase_token}`;
}

/** Backend embeds Play's actual base plan in RECEIPT_INVALID messages. */
function parseGoogleBasePlanFromReceiptInvalid(message: string): string | null {
  const match = message.match(/Google returned:\s*\([^,]+,\s*([^)]+)\)/i);
  const plan = match?.[1]?.trim();
  return plan && plan.length > 0 ? plan : null;
}

async function postIapRestoreWithGooglePlanRetry(
  body: IapRestoreRequest,
): Promise<Awaited<ReturnType<typeof postIapRestore>>> {
  try {
    return await postIapRestore(body);
  } catch (e) {
    if (
      body.platform !== "google" ||
      !(e instanceof IapRestoreError) ||
      e.code !== "RECEIPT_INVALID"
    ) {
      throw e;
    }

    const correctedBasePlan = parseGoogleBasePlanFromReceiptInvalid(e.message);
    if (!correctedBasePlan || correctedBasePlan === body.base_plan_id) {
      throw e;
    }

    return await postIapRestore({
      ...body,
      base_plan_id: correctedBasePlan,
    });
  }
}

async function fetchStorePurchasesForSync(): Promise<{
  availablePurchases: Purchase[];
  activeSubscriptions: ActiveSubscription[];
}> {
  await restorePurchases();
  const [availablePurchases, activeSubscriptions] = await Promise.all([
    getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
      includeSuspendedAndroid: false,
    }),
    getActiveSubscriptions(),
  ]);
  return { availablePurchases, activeSubscriptions };
}

export async function collectCreatorSubscriptionRestoreBodies(
  availablePurchases: Purchase[],
  activeSubscriptions: ActiveSubscription[],
): Promise<CollectRestoreBodiesResult> {

  const purchasesByTxId = indexPurchasesByTransactionId(availablePurchases);
  const restoreBodies: IapRestoreRequest[] = [];
  const purchasesToFinish: Purchase[] = [];
  const seenBodies = new Set<string>();
  let skipped = 0;

  for (const sub of activeSubscriptions) {
    if (!sub.isActive || !isCreatorSubscriptionProductId(sub.productId)) {
      continue;
    }
    const body = buildIapRestoreBodyFromActiveSubscription(
      sub,
      purchasesByTxId,
    );
    if (!body) {
      skipped += 1;
      if (__DEV__) {
        console.warn(
          "[iap-sync] skipped active sub (missing restore payload)",
          sub.productId,
        );
      }
      continue;
    }
    const key = bodyDedupeKey(body);
    if (seenBodies.has(key)) continue;
    seenBodies.add(key);
    restoreBodies.push(body);
  }

  for (const purchase of availablePurchases) {
    if (!isCreatorSubscriptionProductId(purchase.productId)) continue;

    const matchingSub = findActiveSubscriptionForPurchase(
      purchase,
      activeSubscriptions,
    );
    const body = buildIapRestoreBodyFromPurchase(purchase, matchingSub);
    if (!body) continue;

    const key = bodyDedupeKey(body);
    if (seenBodies.has(key)) {
      purchasesToFinish.push(purchase);
      continue;
    }

    const purchaseDedupe = dedupeKeyFromPurchase(purchase);
    const coveredByActive =
      purchaseDedupe != null &&
      activeSubscriptions.some(
        (sub) =>
          sub.isActive &&
          dedupeKeyFromActiveSubscription(sub) === purchaseDedupe,
      );
    if (coveredByActive && seenBodies.has(key)) {
      purchasesToFinish.push(purchase);
      continue;
    }

    seenBodies.add(key);
    restoreBodies.push(body);
    purchasesToFinish.push(purchase);
  }

  return { restoreBodies, purchasesToFinish, skipped };
}

export async function finishProcessedPurchases(
  purchases: Purchase[],
  isConsumable = false,
): Promise<void> {
  for (const purchase of purchases) {
    try {
      await finishTransaction({ purchase, isConsumable });
    } catch {
      // Non-fatal
    }
  }
}

function isAlreadyVerifiedError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already") ||
    normalized.includes("duplicate") ||
    normalized.includes("processed")
  );
}

export async function syncWalletConsumables(
  availablePurchases: Purchase[],
): Promise<{
  verified: number;
  skipped: number;
  errors: string[];
  purchasesToFinish: Purchase[];
}> {
  const result = {
    verified: 0,
    skipped: 0,
    errors: [] as string[],
    purchasesToFinish: [] as Purchase[],
  };
  const seen = new Set<string>();

  for (const purchase of availablePurchases) {
    if (isCreatorSubscriptionProductId(purchase.productId)) continue;
    if (purchase.purchaseState === "pending") continue;

    const dedupeKey = dedupeKeyFromPurchase(purchase);
    if (dedupeKey) {
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
    }

    try {
      await verifyWalletIapOnServer(purchase);
      result.verified += 1;
      result.purchasesToFinish.push(purchase);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Wallet verify failed for one purchase.";
      if (isAlreadyVerifiedError(message)) {
        result.skipped += 1;
        result.purchasesToFinish.push(purchase);
        continue;
      }
      result.skipped += 1;
      result.errors.push(message);
      if (__DEV__) {
        console.warn("[iap-sync] wallet consumable verify failed", message);
      }
      break;
    }
  }

  return result;
}

export async function syncCreatorSubscriptions(): Promise<SyncCreatorSubscriptionsOutcome> {
  const full = await syncStorePurchases();
  const {
    walletVerified: _w,
    walletSkipped: _s,
    ...subscriptionOutcome
  } = full;
  return subscriptionOutcome;
}

export async function syncStorePurchases(): Promise<SyncStorePurchasesOutcome> {
  const outcome: SyncStorePurchasesOutcome = {
    restored: 0,
    orphans: 0,
    skipped: 0,
    buyerMismatch: false,
    upstreamUnavailable: false,
    otherErrors: [],
    restoredUsernames: [],
    walletVerified: 0,
    walletSkipped: 0,
  };

  const { availablePurchases, activeSubscriptions } =
    await fetchStorePurchasesForSync();

  const { restoreBodies, purchasesToFinish, skipped } =
    await collectCreatorSubscriptionRestoreBodies(
      availablePurchases,
      activeSubscriptions,
    );
  outcome.skipped = skipped;

  let restoreAborted = false;

  for (const body of restoreBodies) {
    try {
      const response = await postIapRestoreWithGooglePlanRetry(body);
      if ("orphan" in response && response.orphan) {
        outcome.orphans += 1;
        continue;
      }
      if ("restored" in response && response.restored) {
        outcome.restored += 1;
        outcome.restoredUsernames.push(response.subscription.creator.username);
      }
    } catch (e) {
      if (e instanceof IapRestoreError) {
        if (e.code === "BUYER_MISMATCH") {
          outcome.buyerMismatch = true;
          restoreAborted = true;
          break;
        }
        if (e.code === "UPSTREAM_UNAVAILABLE") {
          outcome.upstreamUnavailable = true;
          restoreAborted = true;
          break;
        }
        if (e.code === "RECEIPT_INVALID") {
          outcome.skipped += 1;
          outcome.otherErrors.push(e.message);
          continue;
        }
        outcome.otherErrors.push(e.message);
        continue;
      }
      outcome.otherErrors.push(
        e instanceof Error ? e.message : "Restore failed for one purchase.",
      );
      restoreAborted = true;
      break;
    }
  }

  if (
    !restoreAborted &&
    !outcome.buyerMismatch &&
    !outcome.upstreamUnavailable
  ) {
    const wallet = await syncWalletConsumables(availablePurchases);
    outcome.walletVerified = wallet.verified;
    outcome.walletSkipped = wallet.skipped;
    if (wallet.errors.length > 0) {
      outcome.otherErrors.push(wallet.errors[0]);
    }
    await finishProcessedPurchases(purchasesToFinish, false);
    await finishProcessedPurchases(wallet.purchasesToFinish, true);
  } else {
    await finishProcessedPurchases(purchasesToFinish, false);
  }

  return outcome;
}

export async function fetchAvailablePurchases(): Promise<Purchase[]> {
  return getAvailablePurchases({
    onlyIncludeActiveItemsIOS: true,
    includeSuspendedAndroid: false,
  });
}
