import { AnimatedTabBar } from "@/src/components/ui/animated-tabbar";
import { useSubscriptionsQuery } from "@/src/features/settings/settings.hooks";
import { Subscription, SubscriptionActiveTab } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

const STORE_SUBSCRIPTIONS_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions?package=com.convoia.jaaspire";

const TABS: Record<SubscriptionActiveTab, { label: string }> = {
  subscriptions: { label: "Subscriptions" },
  subscribers: { label: "Subscribers" },
};

function formatDate(raw: string | null): string {
  if (!raw) return "";
  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2);
}

function getStatusTone(theme: AppTheme, status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "completed") {
    return { bg: "#16a34a1a", text: "#16a34a" };
  }
  if (normalized === "canceled") {
    return { bg: "#ef44441a", text: "#ef4444" };
  }
  if (normalized === "suspended") {
    return { bg: "#f59e0b1a", text: "#f59e0b" };
  }
  return { bg: theme.colors.surface, text: theme.colors.textSecondary };
}

export default function ManageSubscriptionsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<SubscriptionActiveTab>("subscriptions");

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Manage subscriptions",
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
  } = useSubscriptionsQuery(activeTab);

  const list = useMemo(
    () => data?.pages.flatMap((page) => page.data.subscriptions ?? []) ?? [],
    [data?.pages],
  );

  const subscribersCount = data?.pages?.[0]?.data?.subscribers_count ?? 0;

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: Subscription }) => {
      const statusTone = getStatusTone(theme, item.status);
      const statusLabel = item.status.charAt(0).toUpperCase() + item.status.slice(1);

      return (
        <View style={styles.row}>
          <Pressable
            style={styles.rowMain}
            onPress={() => router.push(`/user/${item.user.username.trim()}`)}
          >
            <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {item.user.name}
              </Text>
              <Text style={styles.username} numberOfLines={1}>
                @{item.user.username}
              </Text>
              <Text style={styles.meta}>
                ${formatAmount(item.amount)} · Expires {formatDate(item.expires_at)}
              </Text>
            </View>
          </Pressable>

          <View style={styles.rightColumn}>
            <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
              <Text style={[styles.statusText, { color: statusTone.text }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [styles, theme],
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
        <Ionicons name="card-outline" size={40} color={theme.colors.primary} />
        <Text style={styles.emptyTitle}>
          {activeTab === "subscriptions"
            ? "No subscriptions yet"
            : "No subscribers yet"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === "subscriptions"
            ? "People you subscribe to will appear here."
            : "People who subscribe to you will appear here."}
        </Text>
      </View>
    ),
    [activeTab, styles, theme.colors.primary],
  );

  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      list.length === 0 && !isLoading && styles.listContentEmpty,
    ],
    [isLoading, list.length, styles.listContent, styles.listContentEmpty],
  );

  const handleOpenStoreSubscriptions = useCallback(() => {
    void Linking.openURL(STORE_SUBSCRIPTIONS_URL);
  }, []);

  const listFooter = useMemo(
    () => (
      <View style={styles.storeManageSection}>
        <Text style={styles.storeManageTitle}>Manage in store</Text>
        <Text style={styles.storeManageBody}>
          Cancel or change billing for App Store / Play Store subscriptions.
        </Text>
        <Pressable
          onPress={handleOpenStoreSubscriptions}
          style={({ pressed }) => [
            styles.storeManageButton,
            pressed && styles.storeManageButtonPressed,
          ]}
        >
          <Ionicons
            name="open-outline"
            size={16}
            color={theme.colors.primary}
          />
          <Text style={styles.storeManageButtonLabel}>
            {Platform.OS === "ios"
              ? "Open App Store subscriptions"
              : "Open Play Store subscriptions"}
          </Text>
        </Pressable>
      </View>
    ),
    [handleOpenStoreSubscriptions, styles, theme.colors.primary],
  );

  return (
    <View style={styles.root}>
      <View style={styles.headerInfo}>
        <AnimatedTabBar
          tabs={TABS}
          activeKey={activeTab}
          onTabChange={(next) => setActiveTab(next)}
        />
        <Text style={styles.hintText}>Subscribers: {subscribersCount}</Text>
      </View>

      {isLoading && list.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.textSecondary} size="large" />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          refreshControl={refreshControl}
          contentContainerStyle={listContentStyle}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            <>
              {isFetchingNextPage ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator color={theme.colors.textSecondary} />
                </View>
              ) : null}
              {listFooter}
            </>
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
    headerInfo: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    hintText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
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
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      gap: theme.spacing.sm,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginRight: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    userInfo: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    username: {
      marginTop: 1,
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    meta: {
      marginTop: 2,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    rightColumn: {
      alignItems: "flex-end",
      gap: theme.spacing.xs,
    },
    statusPill: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
    },
    statusText: {
      fontSize: 11,
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
    storeManageSection: {
      marginTop: theme.spacing.lg,
      marginHorizontal: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    storeManageTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    storeManageBody: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
    storeManageButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      alignSelf: "flex-start",
    },
    storeManageButtonPressed: {
      opacity: 0.7,
    },
    storeManageButtonLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
  });
