import PaymentConfirmSheet from "@/src/components/payment/PaymentConfirmSheet";
// import { logSubscriptionDebug } from "@/src/features/wallet/iap-dev.store";
import { useCreatorSubscriptionIap } from "@/src/features/wallet/use-creator-subscription-iap";
import React, { useCallback, useMemo } from "react";

export interface SubscribePaymentConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  username: string;
  /** Display fallback from profile; IAP price comes from availability when loaded. */
  amount: number;
  onSuccess?: () => void;
}

export default function SubscribePaymentConfirmSheet({
  visible,
  onClose,
  username,
  amount,
  onSuccess,
}: SubscribePaymentConfirmSheetProps) {
  const {
    assignedSku,
    storeProductId,
    isCheckingAvailability,
    availabilityBlocked,
    iapReady,
    isIapProcessing,
    handleConfirmIap,
  } = useCreatorSubscriptionIap(username, {
    enabled: visible,
    onSuccess,
  });

  // useEffect(() => {
  //   if (!visible) return;
  //   logSubscriptionDebug(
  //     "SubscribePaymentConfirmSheet:open",
  //     { username, amount },
  //     {
  //       phase: "ui",
  //       status: "success",
  //       summary: `Subscribe sheet opened @${username}`,
  //       payload: { username, amount },
  //     },
  //   );
  // }, [visible, username, amount]);

  // useEffect(() => {
  //   if (!visible) return;
  //   logSubscriptionDebug("SubscribePaymentConfirmSheet:iap state", {
  //     username,
  //     iapReady,
  //     isCheckingAvailability,
  //     isIapProcessing,
  //     storeProductId,
  //     availabilityError,
  //     availabilityMessage,
  //     sku_key: assignedSku?.sku_key,
  //   });
  // }, [
  //   visible,
  //   username,
  //   iapReady,
  //   isCheckingAvailability,
  //   isIapProcessing,
  //   storeProductId,
  //   availabilityError,
  //   availabilityMessage,
  //   assignedSku?.sku_key,
  // ]);

  const displayAmount = useMemo(() => {
    const fromSku = assignedSku?.usd_amount
      ? Number.parseFloat(assignedSku.usd_amount)
      : NaN;
    if (Number.isFinite(fromSku) && fromSku > 0) return fromSku;
    return amount;
  }, [assignedSku?.usd_amount, amount]);

  const handleConfirmIapWrapped = useCallback(async () => {
    if (isCheckingAvailability || availabilityBlocked) return;
    await handleConfirmIap();
  }, [availabilityBlocked, handleConfirmIap, isCheckingAvailability]);

  return (
    <PaymentConfirmSheet
      visible={visible}
      onClose={onClose}
      onConfirm={() => {}}
      onConfirmIap={iapReady ? handleConfirmIapWrapped : undefined}
      action="subscribe"
      username={username}
      amount={displayAmount}
      iapSku={storeProductId}
      iapUsdAmount={assignedSku?.usd_amount ?? null}
      loading={isIapProcessing}
      checkingAvailability={isCheckingAvailability}
      availabilityUnavailable={availabilityBlocked}
      iapOnly
      devAvailabilitySkuKey={assignedSku?.sku_key ?? null}
    />
  );
}
