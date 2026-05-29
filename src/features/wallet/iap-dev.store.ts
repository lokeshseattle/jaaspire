import type { IapSubscribeRequest } from "@/src/services/api/api.types";
import type { Purchase } from "expo-iap";
// import { create } from "zustand";

/** Console prefix for creator subscription debugging (production-safe). */
export const SUBSCRIPTION_DEBUG_LOG = "[subscription-debug]";

export type IapDevPhase =
  | "availability"
  | "purchase"
  | "verify"
  | "subscribe"
  | "ui"
  | "error";

export type IapDevEntry = {
  id: string;
  at: string;
  phase: IapDevPhase;
  status: "success" | "failure";
  summary: string;
  payload: unknown;
};

type IapDevStore = {
  last: IapDevEntry | null;
  history: IapDevEntry[];
  record: (entry: Omit<IapDevEntry, "id" | "at">) => void;
  clear: () => void;
};

// function createEntry(entry: Omit<IapDevEntry, "id" | "at">): IapDevEntry {
//   return {
//     ...entry,
//     id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
//     at: new Date().toISOString(),
//   };
// }

// export const useIapDevStore = create<IapDevStore>((set) => ({
//   last: null,
//   history: [],
//   record: (entry) => {
//     const full = createEntry(entry);
//     console.log(
//       SUBSCRIPTION_DEBUG_LOG,
//       full.phase,
//       full.status,
//       full.summary,
//       full.payload,
//     );
//     set((state) => ({
//       last: full,
//       history: [full, ...state.history].slice(0, 50),
//     }));
//   },
//   clear: () => {
//     console.log(SUBSCRIPTION_DEBUG_LOG, "clear debug log");
//     set({ last: null, history: [] });
//   },
// }));

/** Dev-only store stub (Settings → Subscription debug screen). */
export const useIapDevStore = <T,>(
  selector: (state: IapDevStore) => T,
): T =>
  selector({
    last: null,
    history: [],
    record: () => {},
    clear: () => {},
  });

export function recordIapDev(_entry: Omit<IapDevEntry, "id" | "at">) {
  // useIapDevStore.getState().record(entry);
}

/** Logs to console and optionally persists to Settings → Subscription debug. */
export function logSubscriptionDebug(
  _step: string,
  _detail?: unknown,
  _entry?: Omit<IapDevEntry, "id" | "at">,
) {
  // if (detail !== undefined) {
  //   console.log(SUBSCRIPTION_DEBUG_LOG, step, detail);
  // } else {
  //   console.log(SUBSCRIPTION_DEBUG_LOG, step);
  // }
  // if (entry) recordIapDev(entry);
}

export function sanitizeSubscribeRequestForLog(
  body: IapSubscribeRequest,
): Record<string, unknown> {
  if (body.platform === "apple") {
    const jws = body.jws;
    return {
      ...body,
      jws:
        typeof jws === "string" && jws.length > 64
          ? `${jws.slice(0, 64)}… (${jws.length} chars)`
          : jws,
    };
  }
  if (body.platform === "google") {
    const token = body.purchase_token;
    return {
      ...body,
      purchase_token:
        typeof token === "string" && token.length > 64
          ? `${token.slice(0, 64)}… (${token.length} chars)`
          : token,
    };
  }
  return body as Record<string, unknown>;
}

export function sanitizePurchaseForDev(purchase: Purchase) {
  const token = purchase.purchaseToken;
  return {
    productId: purchase.productId,
    transactionId: purchase.transactionId,
    id: purchase.id,
    platform: purchase.platform,
    store: purchase.store,
    purchaseState: purchase.purchaseState,
    isAutoRenewing: purchase.isAutoRenewing,
    transactionDate: purchase.transactionDate,
    purchaseTokenPreview:
      typeof token === "string" && token.length > 96
        ? `${token.slice(0, 96)}…`
        : token,
  };
}

/** Full StoreKit / Play payload for dev inspection (includes JWS when present). */
export function purchaseToDevPayload(purchase: Purchase): Record<string, unknown> {
  // const raw = purchase as unknown as Record<string, unknown>;
  // return {
  //   ...purchase,
  //   purchaseToken: purchase.purchaseToken ?? null,
  //   ids: purchase.ids ?? null,
  //   quantity: purchase.quantity,
  //   jwsRepresentationIos:
  //     typeof raw.jwsRepresentationIos === "string"
  //       ? raw.jwsRepresentationIos
  //       : null,
  //   jwsRepresentation:
  //     typeof raw.jwsRepresentation === "string" ? raw.jwsRepresentation : null,
  //   orderId: typeof raw.orderId === "string" ? raw.orderId : null,
  //   originalTransactionIdentifierIOS:
  //     typeof raw.originalTransactionIdentifierIOS === "string"
  //       ? raw.originalTransactionIdentifierIOS
  //       : null,
  //   expirationDateIOS: raw.expirationDateIOS ?? null,
  //   environmentIOS: raw.environmentIOS ?? null,
  //   rawKeys: Object.keys(raw),
  // };
  return { productId: purchase.productId };
}
