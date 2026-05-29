import JaasiStar from "@/assets/svg/JaasiStar";
import IapLegalFooter from "@/src/components/wallet/IapLegalFooter";
import { useNotificationCounts } from "@/src/features/profile/notification.hooks";
import { storeProductIdFromIapSku } from "@/src/features/wallet/iap.constants";
import { useIap } from "@/src/features/wallet/iap.context";
import { useIapSkus, useTipUser } from "@/src/features/wallet/wallet.hooks";
import type { IapSkuListItem } from "@/src/services/api/api.types";
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
  Modal,
  Platform,
  Pressable,
  ScrollView,
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

function formatStars(amount: number): string {
  if (Number.isInteger(amount)) return amount.toLocaleString();
  return amount.toFixed(2);
}

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

interface SlideToConfirmProps {
  onConfirm: () => void | Promise<void>;
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
    .enabled(!isBusy && !disabled)
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
      style={[styles.track, disabled && styles.trackDisabled]}
      onLayout={(e) => {
        trackWidth.value = e.nativeEvent.layout.width;
      }}
    >
      <Text style={styles.trackLabel}>Slide to send tip</Text>
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
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"wallet" | "iap">("iap");
  const hasOpenedRef = useRef(false);
  const openProgress = useSharedValue(0);
  const sheetHeightSv = useSharedValue(SHEET_SLIDE_FALLBACK);

  const { mutateAsync: tipUser, isPending: isTipping } = useTipUser();
  const {
    data: iapSkusResponse,
    isPending: iapSkusPending,
    isError: iapSkusError,
  } = useIapSkus("consumable");

  const {
    data: countsData,
    isPending: balancePending,
    isError: balanceError,
  } = useNotificationCounts();

  const tipProductOptions = useMemo(() => {
    const list = iapSkusResponse?.skus ?? [];
    const consumables = list.filter(
      (s): s is IapSkuListItem & { category: "consumable"; stars: number } =>
        s.category === "consumable" && typeof s.stars === "number",
    );
    return consumables
      .map((s) => ({
        product_id: storeProductIdFromIapSku(s),
        stars: s.stars,
        sku_key: s.sku_key,
      }))
      .sort((a, b) => a.stars - b.stars);
  }, [iapSkusResponse?.skus]);

  const walletBalance = useMemo(
    () => parseWalletBalance(countsData?.data?.wallet_balance),
    [countsData?.data?.wallet_balance],
  );

  const selectedProduct = useMemo(() => {
    if (!selectedSku) return null;
    return tipProductOptions.find((p) => p.product_id === selectedSku) ?? null;
  }, [selectedSku, tipProductOptions]);

  const selectedStars = selectedProduct?.stars ?? 0;

  const balanceKnown = !balancePending && !balanceError;
  const walletSufficient =
    balanceKnown &&
    selectedStars > 0 &&
    walletBalance + Number.EPSILON >= selectedStars;
  const showIapRow = selectedStars > 0 && Boolean(selectedProduct);
  const canUseIap = Boolean(selectedProduct && selectedSku);

  const {
    connected: isIapConnected,
    fetchProducts,
    products,
    startPurchase,
    isProcessing: isIapProcessing,
  } = useIap();

  const tipStoreProductIds = useMemo(
    () => tipProductOptions.map((p) => p.product_id),
    [tipProductOptions],
  );

  useEffect(() => {
    if (!visible || !isIapConnected || tipStoreProductIds.length === 0) return;
    void fetchProducts({
      skus: tipStoreProductIds,
      type: "in-app",
    });
  }, [visible, isIapConnected, fetchProducts, tipStoreProductIds]);

  const storeDisplayPriceByProductId = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      if (product.displayPrice) {
        map.set(product.id, product.displayPrice);
      }
    }
    return map;
  }, [products]);

  const selectedStorePrice = selectedSku
    ? (storeDisplayPriceByProductId.get(selectedSku) ?? null)
    : null;

  const canConfirmWallet =
    selectedMethod === "wallet" &&
    walletSufficient &&
    Boolean(selectedProduct) &&
    !isTipping &&
    !isIapProcessing;

  const canConfirmIap =
    selectedMethod === "iap" &&
    canUseIap &&
    isIapConnected &&
    !isIapProcessing &&
    !isTipping;

  const canConfirm = canConfirmWallet || canConfirmIap;

  const markFullyClosed = useCallback(() => {
    setModalMounted(false);
    hasOpenedRef.current = false;
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (tipProductOptions.length === 0) return;
    setSelectedSku((prev) =>
      prev && tipProductOptions.some((p) => p.product_id === prev)
        ? prev
        : tipProductOptions[0].product_id,
    );
  }, [visible, tipProductOptions]);

  useEffect(() => {
    if (!visible || selectedStars <= 0) return;
    if (walletSufficient) {
      setSelectedMethod("wallet");
      return;
    }
    setSelectedMethod("iap");
  }, [visible, walletSufficient, selectedStars]);

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
    if (!selectedProduct) return;

    if (selectedMethod === "wallet") {
      if (!canConfirmWallet) return;
      try {
        await tipUser({
          username,
          sku_key: selectedProduct.sku_key,
        });
        onClose();
        onSuccess?.();
        Alert.alert(
          "Tip sent!",
          `You sent ${formatStars(selectedStars)} Jaasi Stars to @${username}.`,
        );
      } catch (e) {
        Alert.alert(
          "Tip failed",
          e instanceof Error ? e.message : "Could not send tip. Try again.",
        );
      }
      return;
    }

    if (!canConfirmIap || !selectedSku || !selectedProduct) return;
    if (!isIapConnected) {
      Alert.alert("Store unavailable", "Please try again in a moment.");
      return;
    }

    const stars = selectedStars;
    const sku_key = selectedProduct.sku_key;

    try {
      await startPurchase({
        intent: {
          kind: "tip",
          username,
          sku_key,
          stars,
        },
        storeProductId: selectedSku,
        purchaseType: "in-app",
        onSuccess: () => {
          onClose();
          onSuccess?.();
          Alert.alert(
            "Tip sent!",
            `You sent ${formatStars(stars)} Jaasi Stars to @${username}.`,
          );
        },
      });
    } catch (e) {
      Alert.alert(
        "Could not start purchase",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    }
  }, [
    selectedMethod,
    selectedProduct,
    selectedSku,
    canConfirmWallet,
    canConfirmIap,
    tipUser,
    username,
    selectedStars,
    onClose,
    onSuccess,
    isIapConnected,
    startPurchase,
  ]);

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
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.titleRow}>
              <View style={styles.iconBadge}>
                <Ionicons
                  name="gift-outline"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.title} numberOfLines={1}>
                Send Tip
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeButton}
              disabled={isTipping || isIapProcessing}
            >
              <Ionicons
                name="close"
                size={26}
                color={theme.colors.textSecondary}
              />
            </Pressable>
          </View>

          <Text style={styles.recipient}>@{username}</Text>

          {iapSkusPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading tip options…</Text>
            </View>
          ) : iapSkusError ? (
            <View style={styles.unavailableCard}>
              <Text style={styles.unavailableTitle}>
                Could not load tip options
              </Text>
              <Text style={styles.unavailableBody}>
                Check your connection and try opening this tip again.
              </Text>
            </View>
          ) : tipProductOptions.length === 0 ? (
            <View style={styles.unavailableCard}>
              <Text style={styles.unavailableTitle}>
                No tip amounts available
              </Text>
              <Text style={styles.unavailableBody}>
                We could not load star bundles. Try again later.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Choose an amount</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                keyboardShouldPersistTaps="handled"
              >
                {tipProductOptions.map((p) => {
                  const selected = p.product_id === selectedSku;
                  const storePrice =
                    storeDisplayPriceByProductId.get(p.product_id) ?? null;
                  return (
                    <Pressable
                      key={p.product_id}
                      onPress={() => setSelectedSku(p.product_id)}
                      disabled={isTipping}
                      style={[styles.chip, selected && styles.chipSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <View style={styles.chipTopRow}>
                        <JaasiStar width={16} height={16} />
                        <Text
                          style={[
                            styles.chipAmount,
                            selected && styles.chipAmountSelected,
                          ]}
                        >
                          {formatStars(p.stars)}
                        </Text>
                      </View>
                      {storePrice ? (
                        <Text
                          style={[
                            styles.chipHint,
                            selected && styles.chipHintSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {storePrice}
                        </Text>
                      ) : isIapConnected ? (
                        <Text
                          style={[
                            styles.chipHint,
                            selected && styles.chipHintSelected,
                          ]}
                          numberOfLines={1}
                        >
                          …
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {selectedStars > 0 ? (
                <View style={styles.amountPreview}>
                  <Text style={styles.amountPreviewLabel}>Tip amount</Text>
                  <View style={styles.amountPreviewRow}>
                    <JaasiStar width={28} height={28} />
                    <Text style={styles.amountPreviewValue}>
                      {formatStars(selectedStars)}
                    </Text>
                    {/* <Text style={styles.amountPreviewSuffix}>Jaasi Stars</Text> */}
                  </View>
                </View>
              ) : null}

              {selectedStars > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Pay with</Text>
                  <View style={styles.methodCard}>
                    <Pressable
                      onPress={() =>
                        walletSufficient && setSelectedMethod("wallet")
                      }
                      disabled={
                        isTipping || isIapProcessing || !walletSufficient
                      }
                      style={[
                        styles.methodRow,
                        showIapRow && styles.methodRowDividerBottom,
                        selectedMethod === "wallet" && styles.methodRowActive,
                        !walletSufficient && styles.methodRowDisabled,
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
                      <View style={styles.methodTextWrap}>
                        <Text style={styles.methodLabel}>Wallet</Text>
                        {/* {balanceError ? (
                          <Text style={styles.methodHint}>
                            Balance unavailable
                          </Text>
                        ) : balancePending ? (
                          <Text style={styles.methodHint}>
                            Checking balance…
                          </Text>
                        ) : balanceKnown && !walletSufficient ? (
                          <Text style={styles.methodHint}>
                            Not enough stars
                          </Text>
                        ) : null} */}
                      </View>
                    </Pressable>

                    {showIapRow && (
                      <Pressable
                        onPress={() => canUseIap && setSelectedMethod("iap")}
                        disabled={!canUseIap || isTipping || isIapProcessing}
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
                          name={
                            Platform.OS === "ios" ? "logo-apple" : "logo-google"
                          }
                          size={18}
                          color={theme.colors.textPrimary}
                        />
                        <View style={styles.methodTextWrap}>
                          <Text style={styles.methodLabel}>
                            {Platform.OS === "ios"
                              ? "App Store"
                              : "Google Play"}
                          </Text>
                          {selectedStorePrice ? (
                            <Text style={styles.methodHint}>
                              Buy {formatStars(selectedStars)} stars (
                              {selectedStorePrice})
                            </Text>
                          ) : (
                            <Text style={styles.methodHint}>
                              Buy {formatStars(selectedStars)} stars
                              {isIapConnected ? " (loading price…)" : ""}
                            </Text>
                          )}
                          {!canUseIap && (
                            <Text style={styles.methodHint}>
                              Temporarily unavailable
                            </Text>
                          )}
                          {!isIapConnected && canUseIap && (
                            <Text style={styles.methodHint}>
                              Store connecting…
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    )}
                  </View>
                </>
              ) : null}
            </>
          )}

          {balanceError ? (
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
          ) : null}

          {selectedStars > 0 && showIapRow && canUseIap && (
            <IapLegalFooter
              theme={theme}
              variant="consumable"
              style={styles.legalFooter}
            />
          )}

          {balancePending ? (
            <View style={styles.sliderPlaceholder}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.sliderPlaceholderText}>Checking wallet…</Text>
            </View>
          ) : tipProductOptions.length > 0 ? (
            <SlideToConfirm
              onConfirm={handleConfirm}
              loading={isTipping || isIapProcessing}
              theme={theme}
              disabled={!canConfirm}
            />
          ) : null}

          {balanceError ? (
            <Button
              title="Go to wallet"
              variant="primary"
              onPress={handleGoToWallet}
              disabled={isTipping || isIapProcessing}
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
    recipient: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    chipRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    chip: {
      minWidth: 88,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      gap: 4,
    },
    chipSelected: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
      backgroundColor: theme.colors.card,
    },
    chipTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    chipAmount: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    chipAmountSelected: {
      color: theme.colors.primary,
    },
    chipHint: {
      fontSize: 11,
      fontWeight: "500",
      color: theme.colors.textSecondary,
    },
    chipHintSelected: {
      color: theme.colors.textSecondary,
    },
    amountPreview: {
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
    },
    amountPreviewLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    amountPreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    amountPreviewValue: {
      fontSize: 28,
      fontWeight: "800",
      color: theme.colors.textPrimary,
    },
    amountPreviewSuffix: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textSecondary,
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
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    unavailableCard: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    unavailableTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      textAlign: "center",
    },
    unavailableBody: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textSecondary,
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
    legalFooter: {
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
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
