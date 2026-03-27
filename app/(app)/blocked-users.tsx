import {
  useBlockedUsersQuery,
  useUnblockUserMutation,
} from "@/src/features/profile/profile.hooks";
import { BlockedUser } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

/** Parses API datetime like "2026-03-19 22:54:54" and formats for display. */
function formatBlockedDateTime(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return trimmed;

  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
  const timeLine = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);

  return `${dateLine} · ${timeLine}`;
}

export default function BlockedUsersScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Blocked users",
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
  } = useBlockedUsersQuery();

  const unblockMutation = useUnblockUserMutation();

  const list = useMemo(
    () => data?.pages.flatMap((page) => page.data.blocked_users ?? []) ?? [],
    [data?.pages],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const confirmUnblock = useCallback(
    (item: BlockedUser) => {
      Alert.alert(
        "Unblock user",
        `Unblock @${item.username.trim()}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            onPress: () =>
              unblockMutation.mutate(item.username, {
                onError: () => {
                  Alert.alert("Error", "Couldn't unblock. Try again.");
                },
              }),
          },
        ],
        { cancelable: true },
      );
    },
    [unblockMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: BlockedUser }) => {
      const isUnblocking =
        unblockMutation.isPending &&
        unblockMutation.variables === item.username;

      const blockedLabel = formatBlockedDateTime(item.blocked_at);

      return (
        <View style={styles.row}>
          <Pressable
            onPress={() => router.push(`/user/${item.username.trim()}`)}
            style={styles.rowMain}
          >
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.userInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name.trim()}
                </Text>
                {item.verified_user ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={theme.colors.primary}
                  />
                ) : null}
              </View>
              <Text style={styles.username} numberOfLines={1}>
                @{item.username.trim()}
              </Text>
              {blockedLabel ? (
                <Text style={styles.meta} numberOfLines={2}>
                  Blocked {blockedLabel}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => confirmUnblock(item)}
            disabled={isUnblocking}
            style={({ pressed }) => [
              styles.unblockButton,
              { borderColor: theme.colors.border },
              pressed && styles.unblockButtonPressed,
              isUnblocking && styles.unblockButtonDisabled,
            ]}
          >
            {isUnblocking ? (
              <ActivityIndicator color={theme.colors.primary} size="small" />
            ) : (
              <Text style={styles.unblockText}>Unblock</Text>
            )}
          </Pressable>
        </View>
      );
    },
    [
      confirmUnblock,
      styles,
      theme.colors.border,
      theme.colors.primary,
      unblockMutation.isPending,
      unblockMutation.variables,
    ],
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
      <View style={styles.emptyOuter}>
        <View style={styles.emptyCard}>
          <View
            style={[
              styles.emptyIconRing,
              { borderColor: theme.colors.primary + "40" },
            ]}
          >
            <View
              style={[
                styles.emptyIconInner,
                { backgroundColor: theme.colors.card },
              ]}
            >
              <Ionicons
                name="ban-outline"
                size={34}
                color={theme.colors.primary}
              />
            </View>
          </View>
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptySubtitle}>
            People you block can't see your profile, posts, or message you.
            They'll show up here so you can manage your list anytime.
          </Text>
          <View style={styles.emptyHintRow}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={theme.colors.textSecondary}
            />
            <Text style={styles.emptyHint}>Pull down to refresh this list</Text>
          </View>
        </View>
      </View>
    ),
    [styles, theme],
  );

  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      list.length === 0 && !isLoading && styles.listContentEmpty,
    ],
    [isLoading, list.length, styles.listContent, styles.listContentEmpty],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {isLoading && list.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.textSecondary} size="large" />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={list}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          refreshControl={refreshControl}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={theme.colors.textSecondary} />
              </View>
            ) : null
          }
          contentContainerStyle={listContentStyle}
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
    },
    list: {
      flex: 1,
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
    },
    rowMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      minWidth: 0,
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
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    name: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    username: {
      marginTop: 1,
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    meta: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 16,
      color: theme.colors.textSecondary,
    },
    unblockButton: {
      marginLeft: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs + 2,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      minWidth: 84,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    unblockButtonPressed: {
      opacity: 0.88,
    },
    unblockButtonDisabled: {
      opacity: 0.55,
    },
    unblockText: {
      fontWeight: "600",
      fontSize: 13,
      color: theme.colors.primary,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.spacing.lg,
    },
    emptyOuter: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
      minHeight: 360,
    },
    emptyCard: {
      width: "100%",
      maxWidth: 340,
      alignItems: "center",
      paddingVertical: theme.spacing.xl + 8,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    emptyIconRing: {
      padding: 3,
      borderRadius: 48,
      borderWidth: 2,
      marginBottom: theme.spacing.lg,
    },
    emptyIconInner: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "700",
      letterSpacing: -0.3,
      color: theme.colors.textPrimary,
      textAlign: "center",
    },
    emptySubtitle: {
      marginTop: theme.spacing.sm,
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    emptyHintRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      alignSelf: "stretch",
    },
    emptyHint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    footerLoader: {
      paddingVertical: theme.spacing.md,
    },
  });
