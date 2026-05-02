import { useNotificationCounts } from "@/src/features/profile/notification.hooks";
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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
  action: PaymentAction;
  username: string;
  amount: number;
  loading?: boolean;
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

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Aligns with `app/(app)/wallet.tsx` — API may return number or string. */
function parseWalletBalance(raw: number | string | undefined): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

interface SlideToConfirmProps {
  onConfirm: () => void;
  loading: boolean;
  theme: AppTheme;
}

function SlideToConfirm({ onConfirm, loading, theme }: SlideToConfirmProps) {
  const translateX = useSharedValue(0);
  const trackWidth = useSharedValue(0);
  const confirmed = useSharedValue(false);

  useEffect(() => {
    if (!loading) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      confirmed.value = false;
    }
  }, [loading]);

  const triggerConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const pan = Gesture.Pan()
    .enabled(!loading)
    .onChange((e) => {
      "worklet";
      const max = trackWidth.value - THUMB_SIZE - 8;
      const next = translateX.value + e.changeX;
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
          {loading ? (
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
  onConfirm,
  action,
  username,
  amount,
  loading = false,
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
  const formattedAmount = formatAmount(amount);

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
  const insufficientFundsReal =
    balanceKnown && walletBalance + Number.EPSILON < amount;

  const devOverrideActive =
    __DEV__ &&
    DEV_PAYMENT_BALANCE_OVERRIDE !== "auto" &&
    typeof DEV_PAYMENT_BALANCE_OVERRIDE === "boolean";

  const insufficientFunds = devOverrideActive
    ? DEV_PAYMENT_BALANCE_OVERRIDE === true
    : insufficientFundsReal;

  /** When dev override is on, treat balance as “known” for gating so you can preview either flow without waiting on the API. */
  const balanceGateReady = devOverrideActive ? true : balanceKnown;

  const handleGoToWallet = useCallback(() => {
    onClose();
    router.push("/wallet");
  }, [onClose]);

  const canConfirm = balanceGateReady && !insufficientFunds;

  /** Hide API error chrome while a dev override is active so only the forced insufficient / slider path shows. */
  const showBalanceErrorUi = balanceError && !devOverrideActive;

  const showCheckingWalletPlaceholder = balancePending && !devOverrideActive;

  const showDescription =
    !insufficientFunds && (!balanceError || devOverrideActive);

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
      <View style={styles.modalRoot} collapsable={false}>
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

          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={styles.iconBadge}>
              <Ionicons
                name={config.icon}
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.title}>{config.title}</Text>
          </View>

          {/* Detail card */}
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Ionicons
                name="person-outline"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.detailLabel}>User</Text>
              <Text style={styles.detailValue}>@{username}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Ionicons
                name={config.icon}
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.detailLabel}>Action</Text>
              <Text style={styles.detailValue}>{config.label}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Ionicons
                name="wallet-outline"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.amountValue}>{formattedAmount}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Ionicons
                name="cash-outline"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.detailLabel}>Your balance</Text>
              {balancePending ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : balanceError ? (
                <Text style={styles.balanceUnavailable}>Unavailable</Text>
              ) : (
                <Text style={styles.balanceValue}>
                  {formatAmount(walletBalance)}
                </Text>
              )}
            </View>
          </View>

          {/* Description */}
          {showDescription && (
            <Text style={styles.description}>{descriptionText}</Text>
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

          {insufficientFunds && (
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
                You have {formatAmount(walletBalance)} but this costs{" "}
                {formattedAmount}. Top up your wallet first, then return here to
                confirm.
              </Text>
            </View>
          )}

          {/* Slide to confirm */}
          {canConfirm ? (
            <SlideToConfirm
              onConfirm={onConfirm}
              loading={loading}
              theme={theme}
            />
          ) : showCheckingWalletPlaceholder ? (
            <View style={styles.sliderPlaceholder}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.sliderPlaceholderText}>Checking wallet…</Text>
            </View>
          ) : null}

          {/* Cancel */}
          {insufficientFunds || showBalanceErrorUi ? (
            <>
              <Button
                title="Go to wallet"
                variant="primary"
                onPress={handleGoToWallet}
                disabled={loading}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={onClose}
                style={styles.cancelButton}
                disabled={loading}
              />
            </>
          ) : (
            <Button
              title="Cancel"
              variant="outline"
              onPress={onClose}
              style={styles.cancelButton}
              disabled={loading}
            />
          )}
        </Animated.View>
      </View>
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
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
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
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    detailCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    detailLabel: {
      flex: 1,
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    detailValue: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    amountValue: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.md,
    },
    description: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      textAlign: "center",
    },
    cancelButton: {
      marginTop: theme.spacing.xs,
    },
    balanceValue: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    balanceUnavailable: {
      fontSize: 13,
      color: theme.colors.textSecondary,
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
  });
