import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { usePaymentsQuery } from "@/src/features/settings/settings.hooks";
import { Payment } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

function formatDate(raw: string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function toTitleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPostUnlockType(type: string): boolean {
  return type.toLowerCase().includes("post-unlock");
}

function isSubscriptionType(type: string): boolean {
  return type.toLowerCase().includes("subscription");
}

function isDepositType(type: string): boolean {
  return type.toLowerCase() === "deposit";
}

function isRefundedOrCanceledStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === "refunded" || normalized === "canceled";
}

function getStatusTone(theme: AppTheme, status: string) {
  const normalized = status.toLowerCase();
  if (
    normalized === "approved" ||
    normalized === "completed" ||
    normalized === "success"
  ) {
    return { bg: "#16a34a1a", text: "#16a34a" };
  }
  if (normalized === "pending" || normalized === "processing") {
    return { bg: "#f59e0b1a", text: "#d97706" };
  }
  if (
    normalized === "failed" ||
    normalized === "declined" ||
    normalized === "canceled"
  ) {
    return { bg: "#ef44441a", text: "#ef4444" };
  }
  return { bg: theme.colors.surface, text: theme.colors.textSecondary };
}

export default function ManagePaymentsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { data: profileData } = useGetProfile();
  const myUserId = profileData?.data?.id;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Manage payments",
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.textPrimary,
      headerTitleStyle: { color: theme.colors.textPrimary },
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors.background, theme.colors.textPrimary]);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaymentsQuery();

  const payments = useMemo(
    () => data?.pages.flatMap((page) => page.data.payments ?? []) ?? [],
    [data?.pages],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Payment }) => {
      const receiverId = item.receiver?.id ?? null;
      const senderId = item.sender?.id ?? null;
      const receiverUsername = item.receiver?.username ?? "";
      const isDeposit = isDepositType(item.type);
      const isDepositRefundedOrCanceled =
        isDeposit && isRefundedOrCanceledStatus(item.status);

      const isReceived = myUserId != null && receiverId === myUserId;
      const isSpent = myUserId != null && senderId === myUserId;
      const amountColor = isDepositRefundedOrCanceled
        ? theme.colors.textSecondary
        : isDeposit
          ? "#16a34a"
          : isReceived
            ? "#16a34a"
            : isSpent
              ? "#ef4444"
              : theme.colors.textPrimary;
      const counterparty = isSpent
        ? (item.receiver ?? item.sender)
        : (item.sender ?? item.receiver);
      const showSeePost =
        isSpent && isPostUnlockType(item.type) && item.post_id != null;
      const showSubscriptionUser = isSpent && isSubscriptionType(item.type);
      const statusTone = getStatusTone(theme, item.status);

      return (
        <View style={styles.row}>
          <Image source={{ uri: counterparty?.avatar }} style={styles.avatar} />
          <View style={styles.mainInfo}>
            <View style={styles.rowTop}>
              <Text
                style={[styles.amountText, { color: amountColor }]}
                numberOfLines={1}
              >
                {item.provider === "credit"
                  ? item.stars + " Stars"
                  : formatCurrency(item.amount, item.currency)}
              </Text>
              {showSeePost ? (
                <Pressable
                  onPress={() => router.push(`/post/${item.post_id}`)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                >
                  <Text style={styles.actionButtonText}>See post</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.typeText} numberOfLines={1}>
                {toTitleCase(item.type)}
              </Text>
              <View
                style={[styles.statusPill, { backgroundColor: statusTone.bg }]}
              >
                <Text style={[styles.statusText, { color: statusTone.text }]}>
                  {toTitleCase(item.status)}
                </Text>
              </View>
            </View>
            {showSubscriptionUser && !!receiverUsername ? (
              <Pressable
                onPress={() => router.push(`/user/${receiverUsername}`)}
              >
                <Text style={styles.linkText}>@{receiverUsername}</Text>
              </Pressable>
            ) : (
              <Text style={styles.partiesText} numberOfLines={1}>
                {counterparty?.name ?? "Unknown user"}
              </Text>
            )}
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>
      );
    },
    [myUserId, styles, theme.colors.textPrimary],
  );

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching && !isFetchingNextPage}
      onRefresh={() => refetch()}
      tintColor={theme.colors.primary}
      colors={Platform.OS === "android" ? [theme.colors.primary] : undefined}
      progressBackgroundColor={
        Platform.OS === "android" ? theme.colors.surface : undefined
      }
    />
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyWrap}>
        <Ionicons
          name="receipt-outline"
          size={40}
          color={theme.colors.primary}
        />
        <Text style={styles.emptyTitle}>No payments yet</Text>
        <Text style={styles.emptySubtitle}>
          Transactions from subscriptions, tips, and unlocked content will
          appear here.
        </Text>
      </View>
    ),
    [styles, theme.colors.primary],
  );

  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      payments.length === 0 && !isLoading && styles.listContentEmpty,
    ],
    [isLoading, payments.length, styles.listContent, styles.listContentEmpty],
  );

  return (
    <View style={styles.root}>
      {isLoading && payments.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.textSecondary} size="large" />
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          refreshControl={refreshControl}
          contentContainerStyle={listContentStyle}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={theme.colors.textSecondary} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      flexGrow: 1,
      paddingBottom: theme.spacing.md,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    mainInfo: {
      flex: 1,
      minWidth: 0,
    },
    rowTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    amountText: {
      fontSize: 16,
      fontWeight: "700",
      flex: 1,
    },
    typeText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      flex: 1,
      marginRight: theme.spacing.sm,
    },
    metaRow: {
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
    },
    statusPill: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    partiesText: {
      marginTop: 2,
      color: theme.colors.textPrimary,
      fontSize: 13,
    },
    dateText: {
      marginTop: 2,
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    linkText: {
      marginTop: 2,
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "600",
    },
    actionButton: {
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      backgroundColor: theme.colors.primary + "1f",
    },
    actionButtonPressed: {
      opacity: 0.85,
    },
    actionButtonText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
    },
    emptyWrap: {
      flex: 1,
      minHeight: 280,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
    },
    emptySubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    footerLoader: {
      paddingVertical: theme.spacing.md,
    },
  });
