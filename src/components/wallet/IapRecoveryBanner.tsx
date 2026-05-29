import { useIap } from "@/src/features/wallet/iap.context";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function IapRecoveryBanner() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const {
    pendingApproval,
    failedRecords,
    retryFailedPurchase,
    dismissFailedPurchase,
    isProcessing,
  } = useIap();

  const failedRecord = failedRecords[0] ?? null;
  const visible = pendingApproval || failedRecord != null;

  if (!visible) return null;

  return (
    <View
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        {pendingApproval ? (
          <>
            <Text style={styles.title}>Payment awaiting approval</Text>
            <Text style={styles.body}>
              We will activate your purchase when the App Store or Play Store
              approves it.
            </Text>
          </>
        ) : failedRecord ? (
          <>
            <Text style={styles.title}>Could not verify purchase</Text>
            <Text style={styles.body} numberOfLines={3}>
              {failedRecord.lastError ??
                "Your payment may have succeeded. Retry verification or contact support."}
            </Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => void retryFailedPurchase(failedRecord.id)}
                disabled={isProcessing}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                  isProcessing && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryLabel}>
                  {isProcessing ? "Retrying…" : "Retry"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void dismissFailedPurchase(failedRecord.id)}
                disabled={isProcessing}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.secondaryLabel}>Dismiss</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 12,
      right: 12,
      zIndex: 100,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      padding: theme.spacing.md,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    body: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    secondaryButton: {
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    primaryLabel: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
    secondaryLabel: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    buttonPressed: {
      opacity: 0.85,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
