// screens/NotificationsScreen.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { TFilter, useGetNotifications } from "@/src/features/profile/notification.hooks";
import { TNotification } from "@/src/services/api/api.types";
import { timeAgo } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
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

const FILTER_CONFIG: Record<
  TFilter,
  { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon?: keyof typeof Ionicons.glyphMap }
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

// Animated Icon Component
const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

interface AnimatedTabProps {
  filterKey: TFilter;
  config: typeof FILTER_CONFIG[TFilter];
  isActive: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

function AnimatedTab({ filterKey, config, isActive, onPress, onLayout }: AnimatedTabProps) {
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
        ['#999', '#000']
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
          color={isActive ? "#000" : "#999"}
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

// Animated Tab Bar Component
interface AnimatedTabBarProps {
  filter: TFilter;
  onFilterChange: (filter: TFilter) => void;
}

function AnimatedTabBar({ filter, onFilterChange }: AnimatedTabBarProps) {
  const [tabLayouts, setTabLayouts] = useState<{ [key: string]: { x: number; width: number } }>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const filters = Object.keys(FILTER_CONFIG) as TFilter[];

  React.useEffect(() => {
    const layout = tabLayouts[filter];
    if (layout) {
      // Calculate indicator position (60% of tab width, centered)
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
          />
        );
      })}

      {/* Animated Indicator */}
      <Animated.View style={[styles.activeIndicator, indicatorStyle]} />
    </View>
  );
}

export default function NotificationsScreen() {
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

  // Flatten paginated data
  const notifications = useMemo(() => {
    return data?.pages.flatMap((page) => page.data.notifications) ?? [];
  }, [data]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = ({ item }: { item: TNotification }) => {
    const profilePic = item.from_user.avatar
    return (
      <View style={[styles.notificationItem, !item.read && styles.unreadItem]}>
        {/* Profile Picture */}
        <Image
          source={{ uri: profilePic }}
          style={styles.avatar}
        />

        {/* Content */}
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={styles.username}>@{item.from_user?.username}</Text>
            <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          </View>

          <Text style={styles.message}
          >
            {item.message}
          </Text>
        </View>

        {/* Unread Indicator Dot */}
        {!item.read && <View style={styles.unreadDot} />}
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={{ paddingVertical: 20 }}>
        <ActivityIndicator />
      </View>
    );
  };

  // if (isLoading) {
  //   return (
  //     <View style={styles.center}>
  //       <ActivityIndicator size="large" />
  //     </View>
  //   );
  // }

  return (
    <View style={styles.container}>
      {/* ANIMATED FILTER TABS */}
      <AnimatedTabBar filter={filter} onFilterChange={setFilter} />

      {/* LIST */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshing={isRefetching}
          onRefresh={refetch}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching ?? false}
              onRefresh={refetch}
              colors={['#007AFF']}        // Android
              tintColor="#007AFF"         // iOS
            />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No notifications found</Text>
            </View>
          }
        />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  }, notificationContent: {
    flex: 1,
    marginLeft: 12,
  },

  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  notificationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#f1f1f1",
    flexDirection: "row",
    alignItems: "center",
  },

  unreadItem: {
    backgroundColor: "#f6f9ff",
  },



  message: {
    fontSize: 14,
    marginBottom: 4,
  },

  date: {
    fontSize: 12,
    color: "#999",
  }, avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0f0f0",
  },

  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#eee",
    position: "relative",
  }, username: {
    fontWeight: "700",
    fontSize: 14,
    color: "#555",
  }, unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
    marginLeft: 8,
  },

  time: {
    fontSize: 12,
    color: "#999",
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
    color: "#999",
    fontWeight: "500",
  },

  activeTabText: {
    color: "#000",
    fontWeight: "600",
  },

  activeIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: "#000",
    borderRadius: 2,
  },
});