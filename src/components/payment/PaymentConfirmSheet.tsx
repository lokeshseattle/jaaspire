import JaasiStar from "@/assets/svg/JaasiStar";
import IapLegalFooter, {
  subscriptionAutoRenewDisclosure,
} from "@/src/components/wallet/IapLegalFooter";
import { useNotificationCounts } from "@/src/features/profile/notification.hooks";
import type { SubscriptionAvailabilityBlocked } from "@/src/features/wallet/wallet.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Button from "../ui/button";

export type PaymentAction = "buy_post" | "subscribe" | "tip" | "unlock_message";

export interface PaymentConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onConfirmIap?: (sku: string) => void;
  action: PaymentAction;
  username: string;
  amount: number;
  iapSku?: string | null;
  iapStarsAmount?: number | null;
  iapUsdAmount?: string | null;
  starsPerUsd?: number;
  loading?: boolean;
  /** Subscribe flow: availability API in flight (shown instead of slider). */
  checkingAvailability?: boolean;
  /** Subscribe flow: `available: false` or availability request failed — replaces slider. */
  availabilityUnavailable?: SubscriptionAvailabilityBlocked | null;
  /** When true, only show Apple/Google Pay (no wallet option). */
  iapOnly?: boolean;
  /** __DEV__ only: availability `sku_key` shown under price for subscribe debugging. */
  devAvailabilitySkuKey?: string | null;
}

const THUMB_SIZE = 52;
const TRACK_HEIGHT = 60;
const CONFIRM_THRESHOLD = 0.85;

/** Backdrop darkness (previous screen dims, not a second screen sliding in). */
const OVERLAY_OPACITY_MAX = 0.6;
/** Fallback slide distance before `onLayout` measures the real sheet height (see Reanimated bottom sheet pattern). */
const SHEET_SLIDE_FALLBACK = 100;

/** One shared 0→1 curve drives overlay + sheet so they never go out of sync (reduces flicker). */
const OPEN_PROGRESS_ENTER_MS = 360;
const OPEN_PROGRESS_EXIT_MS = 300;

/** Smooth deceleration in / acceleration out (screen-style sheet). */
const SHEET_ENTER_EASING = Easing.bezier(0.33, 1, 0.68, 1);
const SHEET_EXIT_EASING = Easing.bezier(0.42, 0, 1, 1);

/**
 * Dev-only: when `__DEV__` is true, set to `true` to force the insufficient-balance flow or
 * `false` to force the proceed (slider) flow. When `__DEV__` is false (production), this is
 * ignored and real wallet data always applies.
 *
 * Use `'auto'` for normal behavior in development.
 */
const DEV_PAYMENT_BALANCE_OVERRIDE: boolean | "auto" = "auto";

const ACTION_CONFIG: Record<
  PaymentAction,
  { title: string; icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  buy_post: {
    title: "Unlock Post",
    icon: "lock-open-outline",
    label: "One-time purchase",
  },
  subscribe: {
    title: "Subscribe",
    icon: "star-outline",
    label: "Monthly subscription",
  },
  tip: {
    title: "Send Tip",
    icon: "gift-outline",
    label: "Send a gift",
  },
  unlock_message: {
    title: "Unlock Message",
    icon: "lock-open-outline",
    label: "Unlock attachment",
  },
};

function formatStars(amount: number): string {
  if (Number.isInteger(amount)) return amount.toLocaleString();
  return amount.toFixed(2);
}

function formatUsdFromStars(stars: number, starsPerUsd: number): string {
  return `$${(stars / starsPerUsd).toFixed(2)}`;
}

function formatSubscriptionUsdPrice(
  amount: number,
  iapUsdAmount: string | null,
): string {
  const fromSku = iapUsdAmount ? Number.parseFloat(iapUsdAmount) : NaN;
  const value =
    Number.isFinite(fromSku) && fromSku > 0
      ? fromSku
      : Number.isFinite(amount) && amount > 0
        ? amount
        : null;
  if (value == null) return "—";
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

/** Aligns with `app/(app)/wallet.tsx` — API may return number or string. */
function parseWalletBalance(raw: number | string | undefined): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

interface SlideToConfirmProps {
  onConfirm: () => void | Promise<void>;
  loading: boolean;
  theme: AppTheme;
}

function SlideToConfirm({ onConfirm, loading, theme }: SlideToConfirmProps) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const trackWidth = useSharedValue(0);
  const confirmed = useSharedValue(false);
  const [pending, setPending] = useState(false);
  const wasBusyRef = useRef(false);
  const isBusy = loading || pending;

  useEffect(() => {
    if (wasBusyRef.current && !isBusy) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      confirmed.value = false;
    }
    wasBusyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    if (pending && loading) {
      setPending(false);
    }
  }, [pending, loading]);

  const triggerConfirm = useCallback(() => {
    setPending(true);
    void Promise.resolve(onConfirm()).finally(() => {
      setPending(false);
    });
  }, [onConfirm]);

  const pan = Gesture.Pan()
    .enabled(!isBusy)
    .activeOffsetX([-8, 8])
    .onBegin(() => {
      "worklet";
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      "worklet";
      const max = trackWidth.value - THUMB_SIZE - 8;
      const next = startX.value + e.translationX;
      translateX.value = Math.max(0, Math.min(next, max));
    })
    .onEnd(() => {
      "worklet";
      if (confirmed.value) return;
      const max = trackWidth.value - THUMB_SIZE - 8;
      if (max > 0 && translateX.value / max >= CONFIRM_THRESHOLD) {
        confirmed.value = true;
        translateX.value = withSpring(max, { damping: 20, stiffness: 200 });
        runOnJS(triggerConfirm)();
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const styles = sliderStyles(theme);

  return (
    <View
      style={styles.track}
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
    >
      <Text style={styles.trackLabel}>Slide to confirm</Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          {isBusy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const sliderStyles = (theme: AppTheme) =>
  StyleSheet.create({
    track: {
      height: TRACK_HEIGHT,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
      paddingHorizontal: 4,
      overflow: "hidden",
    },
    trackLabel: {
      position: "absolute",
      alignSelf: "center",
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: "500",
      letterSpacing: 0.3,
    },
    thumb: {
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 4,
    },
  });

export default function PaymentConfirmSheet({
  visible,
  onClose,
  onConfirm, //for wallet payment
  onConfirmIap, //for iap payment
  action,
  username,
  amount,
  iapSku = null,
  iapStarsAmount = null,
  iapUsdAmount = null,
  starsPerUsd,
  loading = false,
  checkingAvailability = false,
  availabilityUnavailable = null,
  iapOnly = false,
  devAvailabilitySkuKey = null,
}: PaymentConfirmSheetProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const sheetSlidePadding = theme.spacing.md;

  const [modalMounted, setModalMounted] = useState(false);

  /** True after first open; used so we don't run exit when the sheet was never shown. */
  const hasOpenedRef = useRef(false);

  /** 0 = dismissed, 1 = fully open — single source for overlay fade + sheet slide. */
  const openProgress = useSharedValue(0);

  /** Measured sheet height — translate uses this like Reanimated’s bottom sheet example (slide by full height). */
  const sheetHeightSv = useSharedValue(SHEET_SLIDE_FALLBACK);

  const markFullyClosed = useCallback(() => {
    setModalMounted(false);
    hasOpenedRef.current = false;
  }, []);

  /**
   * Drive open/close from `visible` only. Do NOT depend on `modalMounted` here: when we call
   * `setModalMounted(true)` after opening, a second effect run would reset `openProgress` and
   * restart the enter animation (felt like the sheet vanishing ~20–30% into the motion).
   */
  useLayoutEffect(() => {
    if (visible) {
      hasOpenedRef.current = true;
      cancelAnimation(openProgress);
      openProgress.value = 0;
      setModalMounted(true);

      const raf = requestAnimationFrame(() => {
        openProgress.value = withTiming(1, {
          duration: OPEN_PROGRESS_ENTER_MS,
          easing: SHEET_ENTER_EASING,
        });
      });

      return () => {
        cancelAnimationFrame(raf);
        cancelAnimation(openProgress);
      };
    }

    if (!hasOpenedRef.current) return undefined;

    cancelAnimation(openProgress);
    openProgress.value = withTiming(
      0,
      {
        duration: OPEN_PROGRESS_EXIT_MS,
        easing: SHEET_EXIT_EASING,
      },
      (finished) => {
        if (finished) runOnJS(markFullyClosed)();
      },
    );

    return () => {
      cancelAnimation(openProgress);
    };
  }, [visible]);

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: openProgress.value * OVERLAY_OPACITY_MAX,
  }));

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          (1 - openProgress.value) * (sheetHeightSv.value + sheetSlidePadding),
      },
    ],
  }));

  const config = ACTION_CONFIG[action];
  const isBuyPostAction = action === "buy_post";
  const isUnlockMessageAction = action === "unlock_message";
  const isWalletIapPurchaseAction = isBuyPostAction || isUnlockMessageAction;
  const isSubscribeAction = action === "subscribe";
  const formattedAmount = `${formatStars(amount)}`;

  const descriptionText =
    action === "tip"
      ? `This will send ${formattedAmount} as a gift to @${username} from your wallet.`
      : action === "unlock_message"
        ? `This will deduct ${formattedAmount} from your wallet to unlock this message.`
        : `This will deduct ${formattedAmount} from your wallet balance.`;

  const {
    data: countsData,
    isPending: balancePending,
    isError: balanceError,
  } = useNotificationCounts();

  const walletBalance = useMemo(
    () => parseWalletBalance(countsData?.data?.wallet_balance),
    [countsData?.data?.wallet_balance],
  );

  const balanceKnown = !balancePending && !balanceError;
  const walletSufficientReal =
    balanceKnown && walletBalance + Number.EPSILON >= amount;

  const devOverrideActive =
    __DEV__ &&
    DEV_PAYMENT_BALANCE_OVERRIDE !== "auto" &&
    typeof DEV_PAYMENT_BALANCE_OVERRIDE === "boolean";

  const walletAvailable = devOverrideActive
    ? DEV_PAYMENT_BALANCE_OVERRIDE !== true
    : walletSufficientReal;

  /** When dev override is on, treat balance as “known” for gating so you can preview either flow without waiting on the API. */
  const balanceGateReady = devOverrideActive ? true : balanceKnown;

  const canUseIap = Boolean(onConfirmIap && iapSku);

  const showWalletOption = !iapOnly && balanceGateReady && walletAvailable;
  /** Apple Pay / Google Pay when IAP is configured (post/message unlock or creator subscription). */
  const showIapRow =
    iapOnly || isWalletIapPurchaseAction || isSubscribeAction;

  const [selectedMethod, setSelectedMethod] = useState<"wallet" | "iap">(
    "wallet",
  );

  useEffect(() => {
    if (iapOnly || !showWalletOption) {
      setSelectedMethod("iap");
      return;
    }
    if (showWalletOption) {
      setSelectedMethod("wallet");
    }
  }, [iapOnly, showWalletOption, showIapRow]);

  const handleGoToWallet = useCallback(() => {
    onClose();
    router.push("/wallet");
  }, [onClose]);

  const canConfirm =
    selectedMethod === "wallet"
      ? balanceGateReady && showWalletOption
      : showIapRow && canUseIap;

  const showMethodSelector =
    (iapOnly && showIapRow) ||
    ((isWalletIapPurchaseAction || isSubscribeAction) &&
      (showWalletOption || showIapRow));
  const hasAvailabilityBlock = Boolean(availabilityUnavailable);
  const showNoMethodCard =
    (iapOnly || isWalletIapPurchaseAction || isSubscribeAction) &&
    (iapOnly
      ? !canUseIap && !loading && !checkingAvailability && !hasAvailabilityBlock
      : balanceGateReady) &&
    !showWalletOption &&
    !canUseIap;
  const showBalanceErrorUi = balanceError && !devOverrideActive;
  const showLegacyInsufficientCard =
    !isWalletIapPurchaseAction &&
    !isSubscribeAction &&
    balanceGateReady &&
    !showWalletOption;
  const showCheckingWalletPlaceholder =
    !iapOnly &&
    (isWalletIapPurchaseAction || isSubscribeAction) &&
    selectedMethod === "wallet" &&
    balancePending &&
    !devOverrideActive;
  const showCheckingSubscriptionPlaceholder =
    iapOnly && isSubscribeAction && checkingAvailability;
  const showAvailabilityUnavailableUi =
    iapOnly &&
    isSubscribeAction &&
    !checkingAvailability &&
    hasAvailabilityBlock;

  const handleConfirmAction = useCallback(async () => {
    if (selectedMethod === "iap") {
      if (!onConfirmIap || !iapSku) {
        return;
      }
      await Promise.resolve(onConfirmIap(iapSku));
      return;
    }
    await Promise.resolve(onConfirm());
  }, [iapSku, onConfirm, onConfirmIap, selectedMethod]);

  return (
    <Modal
      transparent
      visible={modalMounted || visible}
      animationType="none"
      presentationStyle={Platform.OS === "ios" ? "overFullScreen" : undefined}
      statusBarTranslucent={Platform.OS === "android"}
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.modalRoot} collapsable={false}>
        <Pressable style={styles.overlayHitTarget} onPress={onClose}>
          <Animated.View
            pointerEvents="none"
            style={[styles.overlayFill, overlayAnimatedStyle]}
          />
        </Pressable>

        <Animated.View
          collapsable={false}
          style={[styles.sheet, sheetAnimatedStyle]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) sheetHeightSv.value = h;
          }}
        >
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header: title + close */}
          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <View style={styles.iconBadge}>
                <Ionicons
                  name={config.icon}
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <View>
                <Text style={styles.title} numberOfLines={1}>
                  {config.title}
                </Text>
                <Text style={styles.titleSub}>from @{username}</Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
              disabled={loading}
            >
              <Ionicons
                name="close"
                size={26}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Price (no breakdown table) */}
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>
              {isSubscribeAction
                ? "1 month subscription"
                : isBuyPostAction
                  ? "Post price"
                  : isUnlockMessageAction
                    ? "Unlock price"
                    : "Amount"}
            </Text>
            <View style={styles.priceRow}>
              {isSubscribeAction && iapOnly ? (
                <Text style={styles.priceValue}>
                  {formatSubscriptionUsdPrice(amount, iapUsdAmount ?? null)}
                  <Text style={styles.pricePeriod}>/month</Text>
                </Text>
              ) : (
                <>
                  <JaasiStar width={28} height={28} />
                  <Text style={styles.priceValue}>{formatStars(amount)}</Text>
                </>
              )}
            </View>
            <Text style={styles.priceSub}>@{username}</Text>
            {__DEV__ && isSubscribeAction && devAvailabilitySkuKey ? (
              <Text style={styles.devSkuKey} selectable>
                SKU: {devAvailabilitySkuKey}
              </Text>
            ) : null}
          </View>

          {/* Description */}
          {/* <Text style={styles.description}>{descriptionText}</Text> */}

          {showMethodSelector && (
            <View style={styles.methodCard}>
              {showWalletOption && (
                <Pressable
                  onPress={() => setSelectedMethod("wallet")}
                  style={[
                    styles.methodRow,
                    showIapRow && styles.methodRowDividerBottom,
                    selectedMethod === "wallet" && styles.methodRowActive,
                  ]}
                >
                  <View style={styles.radioOuter}>
                    {selectedMethod === "wallet" && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Ionicons
                    name="wallet-outline"
                    size={18}
                    color={theme.colors.textPrimary}
                  />
                  <Text style={styles.methodLabel}>Wallet</Text>
                </Pressable>
              )}

              {showIapRow && (
                <Pressable
                  onPress={() => canUseIap && setSelectedMethod("iap")}
                  disabled={!canUseIap}
                  style={[
                    styles.methodRow,
                    selectedMethod === "iap" && styles.methodRowActive,
                    !canUseIap && styles.methodRowDisabled,
                  ]}
                >
                  <View style={styles.radioOuter}>
                    {selectedMethod === "iap" && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                  <Ionicons
                    name={Platform.OS === "ios" ? "logo-apple" : "logo-google"}
                    size={18}
                    color={theme.colors.textPrimary}
                  />
                  <View style={styles.methodTextWrap}>
                    <Text style={styles.methodLabel}>
                      {Platform.OS === "ios" ? "App Store" : "Google Play"}
                    </Text>
                    {isSubscribeAction && iapUsdAmount ? (
                      <Text style={styles.methodHint}>
                        {iapUsdAmount}/month via App Store
                      </Text>
                    ) : null}
                    {!isSubscribeAction &&
                      iapStarsAmount != null &&
                      starsPerUsd != null &&
                      starsPerUsd > 0 && (
                        <Text style={styles.methodHint}>
                          Buy {formatStars(iapStarsAmount)} stars (
                          {formatUsdFromStars(iapStarsAmount, starsPerUsd)})
                        </Text>
                      )}
                    {!isSubscribeAction &&
                      iapStarsAmount != null &&
                      (starsPerUsd == null || starsPerUsd <= 0) && (
                        <Text style={styles.methodHint}>
                          Buy {formatStars(iapStarsAmount)} stars
                        </Text>
                      )}
                    {!canUseIap && (
                      <Text style={styles.methodHint}>
                        Temporarily unavailable
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
            </View>
          )}

          {showNoMethodCard && (
            <View style={styles.insufficientCard}>
              <View style={styles.insufficientHeading}>
                <Ionicons
                  name="wallet-outline"
                  size={22}
                  color={theme.colors.tint}
                />
                <Text style={styles.insufficientTitle}>
                  No payment method available
                </Text>
              </View>
              <Text style={styles.insufficientBody}>
                {isSubscribeAction && iapOnly
                  ? "Subscribe with the App Store or Google Play when available."
                  : isSubscribeAction
                    ? "Subscribe with the App Store, or add Stars to your wallet."
                    : isUnlockMessageAction
                      ? "Add more Stars in your wallet or use the App Store to unlock this message."
                      : "Add more Stars in your wallet to unlock this post."}
              </Text>
            </View>
          )}

          {showBalanceErrorUi && (
            <View style={styles.insufficientCard}>
              <View style={styles.insufficientHeading}>
                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color={theme.colors.tint}
                />
                <Text style={styles.insufficientTitle}>
                  Could not verify balance
                </Text>
              </View>
              <Text style={styles.insufficientBody}>
                Open your wallet to top up, then try again.
              </Text>
            </View>
          )}

          {showLegacyInsufficientCard && (
            <View style={styles.insufficientCard}>
              <View style={styles.insufficientHeading}>
                <Ionicons
                  name="wallet-outline"
                  size={22}
                  color={theme.colors.tint}
                />
                <Text style={styles.insufficientTitle}>
                  Insufficient balance
                </Text>
              </View>
              <Text style={styles.insufficientBody}>
                You have {formatStars(walletBalance)} stars but this costs{" "}
                {formatStars(amount)} stars. Top up your wallet and try again.
              </Text>
            </View>
          )}

          {isSubscribeAction && !showAvailabilityUnavailableUi ? (
            <IapLegalFooter
              theme={theme}
              variant="subscribe"
              subscribeDisclosure={subscriptionAutoRenewDisclosure()}
            />
          ) : null}

          {!isSubscribeAction &&
          showIapRow &&
          canUseIap &&
          (selectedMethod === "iap" || iapOnly) &&
          !showAvailabilityUnavailableUi ? (
            <IapLegalFooter theme={theme} variant="consumable" />
          ) : null}

          {showAvailabilityUnavailableUi && availabilityUnavailable ? (
            <View style={styles.insufficientCard}>
              <View style={styles.insufficientHeading}>
                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color={theme.colors.tint}
                />
                <Text style={styles.insufficientTitle}>
                  Subscription unavailable
                </Text>
              </View>
              <Text style={styles.insufficientBody}>
                {availabilityUnavailable.message}
              </Text>
              {availabilityUnavailable.reason ? (
                <Text style={styles.insufficientReason}>
                  {availabilityUnavailable.reason}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Slide to confirm */}
          {canConfirm ? (
            <SlideToConfirm
              onConfirm={handleConfirmAction}
              loading={loading}
              theme={theme}
            />
          ) : showCheckingWalletPlaceholder ||
            showCheckingSubscriptionPlaceholder ? (
            <View style={styles.sliderPlaceholder}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.sliderPlaceholderText}>
                {showCheckingSubscriptionPlaceholder
                  ? "Checking subscription…"
                  : "Checking wallet…"}
              </Text>
            </View>
          ) : null}

          {!iapOnly &&
          (showNoMethodCard ||
            showLegacyInsufficientCard ||
            showBalanceErrorUi) ? (
            <Button
              title="Go to wallet"
              variant="primary"
              onPress={handleGoToWallet}
              disabled={loading}
            />
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    modalRoot: {
      flex: 1,
    },
    overlayHitTarget: {
      flex: 1,
    },
    overlayFill: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#000",
    },
    sheet: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xl + theme.spacing.lg,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      gap: theme.spacing.lg,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.border,
      alignSelf: "center",
      marginBottom: theme.spacing.xs,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    titleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      // backgroundColor: "red",
    },
    closeButton: {
      padding: theme.spacing.xs,
      marginRight: -theme.spacing.xs,
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    priceBlock: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    priceLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    priceValue: {
      fontSize: 32,
      fontWeight: "800",
      color: theme.colors.textPrimary,
    },
    priceStarsSuffix: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    priceSub: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    devSkuKey: {
      fontSize: 11,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: theme.colors.tint,
      marginTop: 2,
    },
    description: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      textAlign: "center",
    },
    methodCard: {
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      overflow: "hidden",
    },
    methodRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    methodRowDividerBottom: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    methodRowActive: {
      backgroundColor: theme.colors.card,
    },
    methodRowDisabled: {
      opacity: 0.5,
    },
    methodTextWrap: {
      flex: 1,
      gap: 2,
    },
    methodLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    methodHint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    radioOuter: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
    },
    insufficientCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    insufficientHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    insufficientTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    insufficientBody: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
    },
    insufficientReason: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      fontStyle: "italic",
    },
    sliderPlaceholder: {
      height: TRACK_HEIGHT + theme.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      flexDirection: "row",
    },
    sliderPlaceholderText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    titleSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    pricePeriod: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
  });
