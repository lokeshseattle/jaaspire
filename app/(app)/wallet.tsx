import { useNotificationCounts } from "@/src/features/profile/notification.hooks";
import { WALLET_IAP_PRODUCT_IDS } from "@/src/features/wallet/iap.constants";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { ErrorCode, useIAP, type Product, type Purchase } from "expo-iap";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
    ((args: {
      purchase: Purchase;
      isConsumable?: boolean;
    }) => Promise<void>) | null
  >(null);
  const productsRef = useRef<Product[]>([]);

  const { data, isLoading, isError, refetch, isRefetching } =
    useNotificationCounts();

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
      const product = productsRef.current.find(
        (p) => p.id === purchase.productId,
      );
      console.log("[wallet iap] purchase success", { purchase, product });
      try {
        await finishTransactionRef.current?.({
          purchase,
          isConsumable: true,
        });
      } catch (e) {
        if (__DEV__) {
          console.warn("[wallet iap] finishTransaction failed", e);
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
    productsRef.current = products;
  }, [products]);

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

  const chipsDisabled =
    !isConnected ||
    purchasingSku != null ||
    orderedProducts.length === 0;

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

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + theme.spacing.xl },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available balance</Text>
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
            <Text style={styles.retry}>Could not load — tap to retry</Text>
          </Pressable>
        ) : null}
        {isRefetching && !isLoading ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.textSecondary}
            style={styles.inlineLoader}
          />
        ) : null}
        {Platform.OS === "web" ? (
          <Text style={styles.iapHint}>
            In-app purchases run in the iOS or Android app (not on web).
          </Text>
        ) : (
          <View style={styles.iapRow}>
            <Text style={[styles.iapStatus, isConnected && styles.iapStatusOk]}>
              {isConnected
                ? "Store: connected"
                : "Store: not connected — check Play/App Store or network"}
            </Text>
            {!isConnected ? (
              <Pressable
                onPress={() => reconnect()}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.iapRetry,
                  pressed && styles.iapRetryPressed,
                ]}
              >
                <Text style={styles.iapRetryLabel}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>

      <Text style={styles.fieldLabel}>Top up</Text>
      {Platform.OS === "web" ? (
        <Text style={styles.iapHint}>
          Open the app on a device to buy wallet credit.
        </Text>
      ) : isConnected && orderedProducts.length === 0 ? (
        <View style={styles.productsLoading}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.productsLoadingLabel}>Loading store products…</Text>
        </View>
      ) : (
        <View style={styles.chipWrap}>
          {orderedProducts.map((product) => {
            const busy = purchasingSku === product.id;
            const disabled = chipsDisabled || busy;
            return (
              <Pressable
                key={product.id}
                onPress={() => void handlePurchaseProduct(product.id)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.chip,
                  disabled && styles.chipDisabled,
                  pressed && !disabled && styles.chipPressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.primary}
                  />
                ) : (
                  <>
                    <Text style={styles.chipPrice}>{product.displayPrice}</Text>
                    <Text style={styles.chipTitle} numberOfLines={2}>
                      {product.displayName ?? product.title}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
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
      paddingTop: theme.spacing.lg,
    },
    balanceCard: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    balanceLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: theme.spacing.sm,
    },
    balanceValue: {
      fontSize: 34,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      letterSpacing: -0.5,
    },
    balanceLoader: {
      marginVertical: theme.spacing.md,
    },
    inlineLoader: {
      marginTop: theme.spacing.sm,
    },
    retry: {
      marginTop: theme.spacing.sm,
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: "500",
    },
    iapHint: {
      marginTop: theme.spacing.md,
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    iapRow: {
      marginTop: theme.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    iapStatus: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      flexShrink: 1,
    },
    iapStatusOk: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
    iapRetry: {
      paddingVertical: 4,
      paddingHorizontal: theme.spacing.sm,
    },
    iapRetryPressed: {
      opacity: 0.7,
    },
    iapRetryLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    fieldLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    productsLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    productsLoadingLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    chip: {
      minWidth: 140,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    chipPressed: {
      opacity: 0.92,
    },
    chipDisabled: {
      opacity: 0.55,
    },
    chipPrice: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    chipTitle: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
  });
