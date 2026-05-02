import { useNotificationCounts } from "@/src/features/profile/notification.hooks";
import { useTipUser } from "@/src/features/wallet/wallet.hooks";
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
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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

export interface TipBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  username: string;
  onSuccess?: () => void;
}

const THUMB_SIZE = 52;
const TRACK_HEIGHT = 60;
const CONFIRM_THRESHOLD = 0.85;
const OVERLAY_OPACITY_MAX = 0.6;
const SHEET_SLIDE_FALLBACK = 100;
const OPEN_PROGRESS_ENTER_MS = 360;
const OPEN_PROGRESS_EXIT_MS = 300;
const SHEET_ENTER_EASING = Easing.bezier(0.33, 1, 0.68, 1);
const SHEET_EXIT_EASING = Easing.bezier(0.42, 0, 1, 1);

function parseWalletBalance(raw: number | string | undefined): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function formatAmount(value: number): string {
  return `$${value.toFixed(2)}`;
}

interface SlideToConfirmProps {
  onConfirm: () => void;
  loading: boolean;
  theme: AppTheme;
  disabled?: boolean;
}

function SlideToConfirm({
  onConfirm,
  loading,
  theme,
  disabled = false,
}: SlideToConfirmProps) {
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
    .enabled(!loading && !disabled)
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
      style={[styles.track, disabled && styles.trackDisabled]}
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
    >
      <Text style={styles.trackLabel}>Slide to send tip</Text>
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
    trackDisabled: {
      opacity: 0.4,
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

export default function TipBottomSheet({
  visible,
  onClose,
  username,
  onSuccess,
}: TipBottomSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const sheetSlidePadding = theme.spacing.md;

  const [modalMounted, setModalMounted] = useState(false);
  const [amountText, setAmountText] = useState("");
  const hasOpenedRef = useRef(false);
  const openProgress = useSharedValue(0);
  const sheetHeightSv = useSharedValue(SHEET_SLIDE_FALLBACK);

  const { mutateAsync: tipUser, isPending: isTipping } = useTipUser();

  const {
    data: countsData,
    isPending: balancePending,
    isError: balanceError,
  } = useNotificationCounts();

  const walletBalance = useMemo(
    () => parseWalletBalance(countsData?.data?.wallet_balance),
    [countsData?.data?.wallet_balance],
  );

  const parsedAmount = useMemo(() => {
    const n = parseFloat(amountText);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountText]);

  const balanceKnown = !balancePending && !balanceError;
  const insufficientFunds =
    balanceKnown && parsedAmount > 0 && parsedAmount > walletBalance;
  const canConfirm =
    balanceKnown && parsedAmount > 0 && !insufficientFunds && !isTipping;

  const markFullyClosed = useCallback(() => {
    setModalMounted(false);
    hasOpenedRef.current = false;
  }, []);

  useLayoutEffect(() => {
    if (visible) {
      hasOpenedRef.current = true;
      cancelAnimation(openProgress);
      openProgress.value = 0;
      setModalMounted(true);
      setAmountText("");

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
      { duration: OPEN_PROGRESS_EXIT_MS, easing: SHEET_EXIT_EASING },
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

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;
    try {
      await tipUser({ username, amount: parsedAmount });
      onClose();
      onSuccess?.();
      Alert.alert(
        "Tip sent!",
        `You sent ${formatAmount(parsedAmount)} to @${username}.`,
      );
    } catch (e) {
      Alert.alert(
        "Tip failed",
        e instanceof Error ? e.message : "Could not send tip. Try again.",
      );
    }
  }, [canConfirm, tipUser, username, parsedAmount, onClose, onSuccess]);

  const handleGoToWallet = useCallback(() => {
    onClose();
    router.push("/wallet");
  }, [onClose]);

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
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
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
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <View style={styles.iconBadge}>
              <Ionicons
                name="gift-outline"
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.title}>Send Tip</Text>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Ionicons
                name="person-outline"
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.detailLabel}>Recipient</Text>
              <Text style={styles.detailValue}>@{username}</Text>
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

          <View style={styles.amountInputContainer}>
            <Text style={styles.amountPrefix}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="decimal-pad"
              maxLength={10}
              editable={!isTipping}
            />
          </View>

          {parsedAmount > 0 && (
            <Text style={styles.description}>
              This will send {formatAmount(parsedAmount)} as a gift to @
              {username} from your wallet.
            </Text>
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
                {formatAmount(parsedAmount)}. Top up your wallet first.
              </Text>
            </View>
          )}

          {balancePending ? (
            <View style={styles.sliderPlaceholder}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.sliderPlaceholderText}>
                Checking wallet…
              </Text>
            </View>
          ) : (
            <SlideToConfirm
              onConfirm={handleConfirm}
              loading={isTipping}
              theme={theme}
              disabled={!canConfirm}
            />
          )}

          {insufficientFunds || balanceError ? (
            <>
              <Button
                title="Go to wallet"
                variant="primary"
                onPress={handleGoToWallet}
                disabled={isTipping}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={onClose}
                style={styles.cancelButton}
                disabled={isTipping}
              />
            </>
          ) : (
            <Button
              title="Cancel"
              variant="outline"
              onPress={onClose}
              style={styles.cancelButton}
              disabled={isTipping}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
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
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.md,
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
    amountInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    amountPrefix: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    amountInput: {
      flex: 1,
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      padding: 0,
    },
    description: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      textAlign: "center",
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
    cancelButton: {
      marginTop: theme.spacing.xs,
    },
  });
