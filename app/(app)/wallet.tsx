import JaasiStar from "@/assets/svg/JaasiStar";
import IapLegalFooter, {
  VirtualCurrencyDisclaimer,
} from "@/src/components/wallet/IapLegalFooter";
import { useNotificationCounts } from "@/src/features/profile/notification.hooks";
import { getStarsForWalletSku } from "@/src/features/wallet/iap.constants";
import { useIap } from "@/src/features/wallet/iap.context";
import {
  useCreatorDashboardStartLink,
  useIapSkus,
} from "@/src/features/wallet/wallet.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import type { Product } from "expo-iap";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function parseWalletBalance(raw: number | string | undefined): number {
  const n = typeof raw === "string" ? parseFloat(raw) : Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function formatBalance(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(Math.floor(value));
}

export default function WalletScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [purchasingSku, setPurchasingSku] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } =
    useNotificationCounts();
  const {
    data: iapSkusResponse,
    isPending: iapSkusPending,
    isError: iapSkusError,
    refetch: refetchIapSkus,
  } = useIapSkus("consumable");

  const {
    mutateAsync: createDashboardStartLink,
    isPending: isOpeningDashboard,
  } = useCreatorDashboardStartLink();

  const {
    connected: isConnected,
    reconnect,
    fetchProducts,
    products,
    startPurchase,
    isProcessing,
  } = useIap();

  useEffect(() => {
    if (purchasingSku != null && !isProcessing) {
      setPurchasingSku(null);
    }
  }, [isProcessing, purchasingSku]);

  useEffect(() => {
    if (!isConnected) return;
    const productIds =
      iapSkusResponse?.skus.map((sku) =>
        Platform.OS === "ios" ? sku.apple_sku : sku.google_product_id,
      ) ?? [];
    if (!productIds.length) return;
    void fetchProducts({
      skus: productIds,
      type: "in-app",
    });
  }, [isConnected, fetchProducts, iapSkusResponse?.skus]);

  const orderedProducts = useMemo(() => {
    const sourceProductIds =
      iapSkusResponse?.skus.map((sku) =>
        Platform.OS === "ios" ? sku.apple_sku : sku.google_product_id,
      ) ?? [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return sourceProductIds
      .map((id) => byId.get(id))
      .filter((p): p is Product => p != null);
  }, [products, iapSkusResponse?.skus]);

  const balance = parseWalletBalance(data?.data?.wallet_balance);

  const purchaseDisabled =
    !isConnected ||
    purchasingSku != null ||
    isProcessing ||
    orderedProducts.length === 0 ||
    iapSkusError;

  const handlePurchaseProduct = async (sku: string) => {
    if (!isConnected || purchasingSku != null || isProcessing) return;
    setPurchasingSku(sku);
    try {
      await startPurchase({
        intent: { kind: "wallet_topup" },
        storeProductId: sku,
        purchaseType: "in-app",
        onSuccess: () => setPurchasingSku(null),
      });
    } catch (e) {
      setPurchasingSku(null);
      if (__DEV__) {
        // console.warn("[wallet iap] startPurchase failed", e);
      }
      Alert.alert(
        "Could not start purchase",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    }
  };

  const handleOpenCreatorDashboard = async () => {
    if (isOpeningDashboard) return;
    try {
      const response = await createDashboardStartLink();
      if (!response.success || !response.url) {
        throw new Error(
          response.message || "Dashboard link was not available.",
        );
      }
      await Linking.openURL(response.url);
    } catch (e) {
      Alert.alert(
        "Could not open dashboard",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    }
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Balance</Text>
      <Text style={styles.screenSubtitle}>
        Your balance across the app. Top up when needed.
      </Text>

      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Available</Text>
          <Pressable
            onPress={() => refetch()}
            disabled={isRefetching || isLoading}
            hitSlop={12}
            style={styles.refreshButton}
          >
            {isRefetching && !isLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.textSecondary}
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={18}
                color={theme.colors.textSecondary}
              />
            )}
          </Pressable>
        </View>
        {isLoading ? (
          <ActivityIndicator
            color={theme.colors.primary}
            style={styles.balanceLoader}
          />
        ) : (
          <View style={styles.balanceValueRow}>
            <JaasiStar width={48} height={48} />
            <Text style={styles.balanceValue}>{formatBalance(balance)}</Text>
          </View>
        )}
        {isError ? (
          <Pressable onPress={() => refetch()} hitSlop={12}>
            <Text style={styles.retry}>Tap to retry</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => void handleOpenCreatorDashboard()}
        disabled={isOpeningDashboard}
        hitSlop={12}
        style={({ pressed }) => [
          styles.dashboardLink,
          pressed && !isOpeningDashboard && styles.dashboardLinkPressed,
          isOpeningDashboard && styles.dashboardLinkDisabled,
        ]}
      >
        <Text style={styles.dashboardLinkText}>
          {isOpeningDashboard
            ? "Opening dashboard..."
            : "Open Creator Dashboard"}
        </Text>
        <Ionicons name="open-outline" size={16} color={theme.colors.primary} />
      </Pressable>

      {Platform.OS === "web" ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Purchases on mobile</Text>
          <Text style={styles.noticeBody}>
            Add wallet credit in the iOS or Android app. Purchases are not
            available on web.
          </Text>
        </View>
      ) : !isConnected ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Store unavailable</Text>
          <Text style={styles.noticeBody}>
            Check your connection and that the App Store or Play Store is
            reachable, then try again.
          </Text>
          <Pressable
            onPress={() => reconnect()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>Retry connection</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>
            Choose a pack to add Jaasi Stars
          </Text>
          <VirtualCurrencyDisclaimer
            theme={theme}
            style={styles.virtualCurrencyDisclaimer}
          />
          {iapSkusError ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>
                Could not load purchase options
              </Text>
              <Text style={styles.noticeBody}>
                We could not load products right now. Please try again.
              </Text>
              <Pressable
                onPress={() => refetchIapSkus()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
              >
                <Text style={styles.primaryButtonLabel}>Retry</Text>
              </Pressable>
            </View>
          ) : iapSkusPending || orderedProducts.length === 0 ? (
            <View style={styles.productsLoading}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.productsLoadingLabel}>Loading options…</Text>
            </View>
          ) : (
            <View style={styles.productList}>
              {orderedProducts.map((product) => {
                const busy = purchasingSku === product.id;
                const disabled = purchaseDisabled || busy;
                const title = product.displayName ?? product.title;
                const starsAmount = getStarsForWalletSku(
                  product.id,
                  iapSkusResponse?.skus ?? [],
                );
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => void handlePurchaseProduct(product.id)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.productChip,
                      disabled && styles.productChipDisabled,
                      pressed && !disabled && styles.productChipPressed,
                    ]}
                  >
                    {busy ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                        style={styles.productBusy}
                      />
                    ) : (
                      <View style={styles.productChipRow}>
                        <View style={styles.productStarsRow}>
                          <JaasiStar width={18} height={18} />
                          <Text style={styles.productStarsText}>
                            {starsAmount ?? title}
                          </Text>
                        </View>
                        <Text style={styles.productPrice}>
                          {product.displayPrice}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      {Platform.OS === "ios" || Platform.OS === "android" ? (
        <IapLegalFooter
          theme={theme}
          variant="consumable"
          style={styles.legalFooter}
        />
      ) : null}
    </ScrollView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    screenTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      letterSpacing: -0.5,
      marginBottom: theme.spacing.xs,
    },
    screenSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xl,
    },
    balanceCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    balanceHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm,
    },
    refreshButton: {
      padding: 4,
    },
    balanceLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    balanceValue: {
      fontSize: 40,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      letterSpacing: -1,
    },
    balanceValueRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      flexWrap: "wrap",
      alignItems: "center",
    },
    balanceLoader: {
      marginVertical: theme.spacing.md,
    },
    retry: {
      marginTop: theme.spacing.sm,
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: "600",
    },
    dashboardLink: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      backgroundColor: "transparent",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.xl,
    },
    dashboardLinkPressed: {
      opacity: 0.7,
    },
    dashboardLinkDisabled: {
      opacity: 0.55,
    },
    dashboardLinkText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    noticeCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    noticeTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    noticeBody: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
    primaryButton: {
      alignSelf: "flex-start",
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.sm + 2,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
    },
    primaryButtonPressed: {
      opacity: 0.88,
    },
    primaryButtonLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: "#FFFFFF",
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: theme.spacing.sm,
    },
    virtualCurrencyDisclaimer: {
      marginBottom: theme.spacing.md,
    },
    productsLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
    },
    productsLoadingLabel: {
      fontSize: 15,
      color: theme.colors.textSecondary,
    },
    productList: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    productChip: {
      width: "48%",
      minHeight: 46,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#D8EEFF",
      justifyContent: "center",
    },
    productChipPressed: {
      opacity: 0.92,
    },
    productChipDisabled: {
      opacity: 0.5,
    },
    productChipRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    productPrice: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textSecondary,
    },
    productStarsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    productStarsText: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    productBusy: {
      alignSelf: "center",
    },
    legalFooter: {
      marginTop: theme.spacing.lg,
    },
  });
