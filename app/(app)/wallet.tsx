import { useNotificationCounts } from "@/src/features/profile/notification.hooks";
import { WALLET_IAP_PRODUCT_IDS } from "@/src/features/wallet/iap.constants";
import {
  useCreatorDashboardStartLink,
  useVerifyWalletIapPurchase,
} from "@/src/features/wallet/wallet.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { ErrorCode, useIAP, type Product, type Purchase } from "expo-iap";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  return n;
}

function formatBalance(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function WalletScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [purchasingSku, setPurchasingSku] = useState<string | null>(null);
  const finishTransactionRef = useRef<
    | ((args: { purchase: Purchase; isConsumable?: boolean }) => Promise<void>)
    | null
  >(null);

  const { data, isLoading, isError, refetch, isRefetching } =
    useNotificationCounts();

  const { mutateAsync: verifyWalletIapPurchase } = useVerifyWalletIapPurchase();
  const {
    mutateAsync: createDashboardStartLink,
    isPending: isOpeningDashboard,
  } = useCreatorDashboardStartLink();

  const {
    connected: isConnected,
    reconnect,
    fetchProducts,
    products,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onError: (error) => {
      if (__DEV__) {
        console.warn("[wallet iap]", error.message);
      }
    },
    onPurchaseSuccess: async (purchase: Purchase) => {
      if (__DEV__) {
        console.log("[wallet iap] purchase success", purchase.productId);
      }
      try {
        if (Platform.OS === "ios" || Platform.OS === "android") {
          await verifyWalletIapPurchase(purchase);
        }
        await finishTransactionRef.current?.({
          purchase,
          isConsumable: true,
        });
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "We could not confirm this purchase with the server.";
        Alert.alert("Verification failed", message);
        if (__DEV__) {
          console.warn("[wallet iap] verify or finish failed", e);
        }
      } finally {
        setPurchasingSku(null);
      }
    },
    onPurchaseError: (error) => {
      setPurchasingSku(null);
      if (error.code === ErrorCode.UserCancelled) return;
      Alert.alert(
        "Purchase failed",
        error.message ?? "Could not complete purchase. Try again later.",
      );
    },
  });

  useEffect(() => {
    finishTransactionRef.current = finishTransaction;
  }, [finishTransaction]);

  useEffect(() => {
    if (!isConnected) return;
    void fetchProducts({
      skus: WALLET_IAP_PRODUCT_IDS,
      type: "in-app",
    });
  }, [isConnected, fetchProducts]);

  const orderedProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return WALLET_IAP_PRODUCT_IDS.map((id) => byId.get(id)).filter(
      (p): p is Product => p != null,
    );
  }, [products]);

  const balance = parseWalletBalance(data?.data?.wallet_balance);

  const purchaseDisabled =
    !isConnected || purchasingSku != null || orderedProducts.length === 0;

  const handlePurchaseProduct = async (sku: string) => {
    if (!isConnected || purchasingSku != null) return;
    setPurchasingSku(sku);
    try {
      await requestPurchase({
        type: "in-app",
        request: {
          apple: { sku },
          google: { skus: [sku] },
        },
      });
    } catch (e) {
      setPurchasingSku(null);
      if (__DEV__) {
        console.warn("[wallet iap] requestPurchase failed", e);
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
      <Text style={styles.screenTitle}>Wallet</Text>
      <Text style={styles.screenSubtitle}>
        Use your balance across the app. Top up when you need more.
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
          <Text style={styles.balanceValue}>${formatBalance(balance)}</Text>
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
          <Text style={styles.sectionLabel}>Add credit</Text>
          {orderedProducts.length === 0 ? (
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
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => void handlePurchaseProduct(product.id)}
                    disabled={disabled}
                    style={({ pressed }) => [
                      styles.productRow,
                      disabled && styles.productRowDisabled,
                      pressed && !disabled && styles.productRowPressed,
                    ]}
                  >
                    <View style={styles.productRowMain}>
                      <Text style={styles.productTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      {busy ? (
                        <ActivityIndicator
                          size="small"
                          color={theme.colors.primary}
                          style={styles.productBusy}
                        />
                      ) : (
                        <Text style={styles.productPrice}>
                          {product.displayPrice}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.productChevron}>›</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
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
      gap: theme.spacing.sm,
    },
    productRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    productRowPressed: {
      opacity: 0.92,
    },
    productRowDisabled: {
      opacity: 0.5,
    },
    productRowMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.md,
    },
    productTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    productPrice: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.colors.primary,
    },
    productBusy: {
      marginRight: theme.spacing.xs,
    },
    productChevron: {
      marginLeft: theme.spacing.sm,
      fontSize: 22,
      fontWeight: "300",
      color: theme.colors.textSecondary,
    },
  });
