// screens/NotificationsScreen.tsx

import {
  TFilter,
  useGetNotifications,
  useGetPendingRequests,
  useMarkNotificationReadMutation,
} from "@/src/features/profile/notification.hooks";
import { TNotification } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { timeAgo } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { FlatList, RefreshControl } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const FILTERS: TFilter[] = ["", "likes", "subscriptions", "tips"];
const VERIFIED_COLOR = "#1DA1F2";

interface ListHeaderComponentProps {
  pendingRequestsData: ReturnType<typeof useGetPendingRequests>["data"];
}

const ListHeaderComponent = ({
  pendingRequestsData,
}: ListHeaderComponentProps) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const allRequests =
    pendingRequestsData?.pages?.flatMap((page) => page.data.requests) ?? [];
  const totalCount =
    pendingRequestsData?.pages?.[0]?.data?.pagination?.total ?? 0;

  if (allRequests.length === 0) {
    return null;
  }

  const firstRequest = allRequests[0];
  const remainingCount = totalCount - 1;

  const handleViewAllRequests = () => {
    router.push({
      pathname: "/pending-requests",
    });
  };

  return (
    <Pressable
      onPress={handleViewAllRequests}
      style={styles.pendingRequestsContainer}
    >
      <View style={styles.requestCard}>
        <Image
          source={{ uri: firstRequest.avatar }}
          style={styles.pendingRequestAvatar}
        />

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              Follow request
            </Text>
            {firstRequest.verified_user && (
              <Ionicons name="checkmark-circle" size={16} color={VERIFIED_COLOR} />
            )}
          </View>
          <Text style={styles.pendingRequestUsername} numberOfLines={1}>
            @{firstRequest.username}{" "}
            {remainingCount > 0 && `+ ${remainingCount} other`}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.primary}
          onPress={handleViewAllRequests}
        />
      </View>
    </Pressable>
  );
};

const FILTER_CONFIG: Record<
  TFilter,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon?: keyof typeof Ionicons.glyphMap;
  }
> = {
  "": {
    label: "All",
    icon: "notifications-outline",
    activeIcon: "notifications",
  },
  likes: {
    label: "Likes",
    icon: "heart-outline",
    activeIcon: "heart",
  },
  subscriptions: {
    label: "Subs",
    icon: "person-add-outline",
    activeIcon: "person-add",
  },
  tips: {
    label: "Tips",
    icon: "wallet-outline",
    activeIcon: "wallet",
  },
};

interface AnimatedTabProps {
  filterKey: TFilter;
  config: (typeof FILTER_CONFIG)[TFilter];
  isActive: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  theme: AppTheme;
}

function AnimatedTab({
  filterKey,
  config,
  isActive,
  onPress,
  onLayout,
  theme,
}: AnimatedTabProps) {
  const styles = createStyles(theme);
  const scale = useSharedValue(1);
  const progress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, {
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [isActive]);

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        progress.value,
        [0, 1],
        [theme.colors.textSecondary, theme.colors.textPrimary]
      ),
      transform: [
        {
          scale: withSpring(scale.value, {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(scale.value * (0.9 + progress.value * 0.1), {
            damping: 15,
            stiffness: 150,
          }),
        },
      ],
    };
  });

  const handlePressIn = () => {
    scale.value = 0.92;
  };

  const handlePressOut = () => {
    scale.value = 1;
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={onLayout}
      style={styles.tab}
    >
      <Animated.View style={animatedIconStyle}>
        <Ionicons
          name={isActive && config.activeIcon ? config.activeIcon : config.icon}
          size={22}
          color={isActive ? theme.colors.textPrimary : theme.colors.textSecondary}
        />
      </Animated.View>

      <Animated.Text
        style={[
          styles.tabText,
          animatedTextStyle,
          isActive && styles.activeTabText,
        ]}
      >
        {config.label}
      </Animated.Text>
    </Pressable>
  );
}

interface AnimatedTabBarProps {
  filter: TFilter;
  onFilterChange: (filter: TFilter) => void;
}

function AnimatedTabBar({ filter, onFilterChange }: AnimatedTabBarProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [tabLayouts, setTabLayouts] = useState<{
    [key: string]: { x: number; width: number };
  }>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const filters = Object.keys(FILTER_CONFIG) as TFilter[];

  React.useEffect(() => {
    const layout = tabLayouts[filter];
    if (layout) {
      const actualIndicatorWidth = layout.width * 0.6;
      const offsetX = (layout.width - actualIndicatorWidth) / 2;

      indicatorX.value = withSpring(layout.x + offsetX, {
        damping: 20,
        stiffness: 200,
        mass: 0.8,
      });

      indicatorWidth.value = withSpring(actualIndicatorWidth, {
        damping: 20,
        stiffness: 200,
        mass: 0.8,
      });
    }
  }, [filter, tabLayouts]);

  const indicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: indicatorX.value }],
      width: indicatorWidth.value,
    };
  });

  const handleTabLayout = (key: TFilter) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    setTabLayouts((prev) => ({
      ...prev,
      [key]: { x, width },
    }));
  };

  return (
    <View style={styles.tabContainer}>
      {filters.map((key) => {
        const isActive = key === filter;
        const config = FILTER_CONFIG[key];

        return (
          <AnimatedTab
            key={key}
            filterKey={key}
            config={config}
            isActive={isActive}
            onPress={() => onFilterChange(key)}
            onLayout={handleTabLayout(key)}
            theme={theme}
          />
        );
      })}

      <Animated.View style={[styles.activeIndicator, indicatorStyle]} />
    </View>
  );
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [filter, setFilter] = useState<TFilter>("");

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    isRefetching,
  } = useGetNotifications(filter);

  const {
    data: pendingRequestsData,
    refetch: refetchPendingRequests,
    isRefetching: isRefetchingPendingRequests,
  } = useGetPendingRequests();

  const handleRefresh = useCallback(() => {
    refetch();
    refetchPendingRequests();
  }, [refetch, refetchPendingRequests]);

  const isRefreshingAny = isRefetching || isRefetchingPendingRequests;

  const markReadMutation = useMarkNotificationReadMutation();
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(
    new Set()
  );

  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const isFlushingRef = useRef(false);
  const lastFlushAtRef = useRef(0);

  const FLUSH_COOLDOWN_MS = 1500;

  const flushPendingReads = useCallback(() => {
    const now = Date.now();

    if (isFlushingRef.current) return;
    if (now - lastFlushAtRef.current < FLUSH_COOLDOWN_MS) return;

    const ids = Array.from(pendingReadIdsRef.current);
    if (!ids.length) return;

    pendingReadIdsRef.current.clear();
    isFlushingRef.current = true;
    lastFlushAtRef.current = now;

    markReadMutation.mutate(ids, {
      onError: () => {
        ids.forEach((id) => pendingReadIdsRef.current.add(id));
      },
      onSettled: () => {
        isFlushingRef.current = false;
      },
    });
  }, [markReadMutation]);

  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 80,
      minimumViewTime: 1200,
    }),
    []
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const newlyRead: string[] = [];

      for (const v of viewableItems) {
        const item = v.item as TNotification | undefined;
        if (!item) continue;

        const alreadyRead = item.read || optimisticReadIds.has(item.id);
        if (alreadyRead) continue;

        if (!pendingReadIdsRef.current.has(item.id)) {
          pendingReadIdsRef.current.add(item.id);
          newlyRead.push(item.id);
        }
      }

      if (newlyRead.length) {
        setOptimisticReadIds((prev) => {
          const next = new Set(prev);
          newlyRead.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  ).current;

  const notifications = useMemo(() => {
    return data?.pages.flatMap((page) => page.data.notifications) ?? [];
  }, [data]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = ({ item }: { item: TNotification }) => {
    const profilePic = item.from_user.avatar;
    const isRead = item.read || optimisticReadIds.has(item.id);

    return (
      <View style={[styles.notificationItem, !isRead && styles.unreadItem]}>
        <Image source={{ uri: profilePic }} style={styles.avatar} />

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.username}>@{item.from_user?.username}</Text>
            <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          </View>

          <Text style={styles.message}>{item.message}</Text>
        </View>

        {!isRead && <View style={styles.unreadDot} />}
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={theme.colors.textSecondary} />
      </View>
    );
  };

  React.useEffect(() => {
    return () => flushPendingReads();
  }, [flushPendingReads]);

  return (
    <View style={styles.container}>
      <AnimatedTabBar filter={filter} onFilterChange={setFilter} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.textSecondary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <ListHeaderComponent pendingRequestsData={pendingRequestsData} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onMomentumScrollEnd={flushPendingReads}
          onScrollEndDrag={flushPendingReads}
          refreshing={isRefreshingAny}
          onRefresh={handleRefresh}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingAny}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No notifications found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },

    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 100,
    },

    emptyText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },

    footerLoader: {
      paddingVertical: theme.spacing.xl,
    },

    notificationContent: {
      flex: 1,
      marginLeft: theme.spacing.md,
    },

    notificationHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },

    notificationItem: {
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
    },

    unreadItem: {
      backgroundColor: theme.colors.surface,
    },

    message: {
      fontSize: 14,
      marginBottom: 4,
      color: theme.colors.textPrimary,
    },

    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.border,
    },

    tabContainer: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      position: "relative",
      backgroundColor: theme.colors.background,
    },

    username: {
      fontWeight: "700",
      fontSize: 14,
      color: theme.colors.textPrimary,
    },

    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.primary,
      marginLeft: theme.spacing.sm,
    },

    time: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },

    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },

    tabText: {
      fontSize: 11,
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontWeight: "500",
    },

    activeTabText: {
      color: theme.colors.textPrimary,
      fontWeight: "600",
    },

    activeIndicator: {
      position: "absolute",
      bottom: 0,
      left: 0,
      height: 2,
      backgroundColor: theme.colors.textPrimary,
      borderRadius: 2,
    },

    pendingRequestsContainer: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },

    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },

    requestCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
    },

    pendingRequestAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.border,
    },

    userInfo: {
      flex: 1,
      marginLeft: theme.spacing.md,
      marginRight: theme.spacing.sm,
    },

    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    name: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      flexShrink: 1,
    },

    pendingRequestUsername: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },

    pendingRequestButtonsContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },

    acceptButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.sm,
    },

    acceptButtonText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "600",
    },

    rejectButton: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.sm,
    },

    rejectButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },

    viewMoreContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },

    viewMoreText: {
      fontSize: 14,
      color: theme.colors.primary,
      fontWeight: "500",
      marginRight: 4,
    },
  });