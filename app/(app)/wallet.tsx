import {
  notificationCountsQueryKey,
  useNotificationCounts,
} from "@/src/features/profile/notification.hooks";
import { apiClient } from "@/src/services/api/api.client";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } =
    useNotificationCounts();

  const [amountText, setAmountText] = useState("");

  const balance = parseWalletBalance(data?.data?.wallet_balance);

  const depositMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiClient.post<{ success?: boolean; message?: string }>(
        "/wallet/deposit",
        { amount },
      );
      return res.data;
    },
    onSuccess: () => {
      setAmountText("");
      queryClient.invalidateQueries({ queryKey: notificationCountsQueryKey });
    },
    onError: (err: { message?: string }) => {
      Alert.alert(
        "Deposit failed",
        err.message ?? "Could not complete deposit. Try again later.",
      );
    },
  });

  const handleDeposit = () => {
    const parsed = parseFloat(amountText.replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert("Invalid amount", "Enter a positive number to deposit.");
      return;
    }
    depositMutation.mutate(parsed);
  };

  const busy = depositMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View
        style={[
          styles.container,
          { paddingBottom: insets.bottom + theme.spacing.xl },
        ]}
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
        </View>

        <Text style={styles.fieldLabel}>Deposit amount (USD)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="decimal-pad"
          value={amountText}
          onChangeText={setAmountText}
          editable={!busy}
        />

        <Pressable
          style={({ pressed }) => [
            styles.depositButton,
            pressed && styles.depositButtonPressed,
            busy && styles.depositButtonDisabled,
          ]}
          onPress={handleDeposit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.depositLabel}>Deposit</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
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
    fieldLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    input: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      fontSize: 18,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.lg,
    },
    depositButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
    },
    depositButtonPressed: {
      opacity: 0.9,
    },
    depositButtonDisabled: {
      opacity: 0.6,
    },
    depositLabel: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "600",
    },
  });
