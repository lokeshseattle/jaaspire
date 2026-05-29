import type {
  PendingIapRecord,
  StartPurchaseParams,
} from "@/src/features/wallet/iap.types";
import type {
  Product,
  ProductSubscription,
} from "expo-iap";
import { createContext, useContext } from "react";

export type IapContextValue = {
  connected: boolean;
  reconnect: () => Promise<boolean>;
  fetchProducts: (params: {
    skus: string[];
    type?: "in-app" | "subs" | "all";
  }) => Promise<void>;
  products: Product[];
  subscriptions: ProductSubscription[];
  startPurchase: (params: StartPurchaseParams) => Promise<void>;
  retryFailedPurchase: (recordId: string) => Promise<void>;
  dismissFailedPurchase: (recordId: string) => Promise<void>;
  pendingApproval: boolean;
  failedRecords: PendingIapRecord[];
  isProcessing: boolean;
};

export const IapContext = createContext<IapContextValue | null>(null);

export function useIap(): IapContextValue {
  const context = useContext(IapContext);
  if (!context) {
    throw new Error("useIap must be used within IapProvider");
  }
  return context;
}

/** Safe variant for screens that may render outside the provider (e.g. web). */
export function useIapOptional(): IapContextValue | null {
  return useContext(IapContext);
}
