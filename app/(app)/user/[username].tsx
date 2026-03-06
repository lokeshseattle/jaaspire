// app/(app)/profile/[username].tsx

import UserProfileHeader from "@/src/components/profile/UserProfileHeader";
import { AnimatedTabBar } from "@/src/components/ui/animated-tabbar";
import { useGetUserFeedQuery } from "@/src/features/post/post.hooks";
import { usePostStore } from "@/src/features/post/post.store";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, View } from "react-native";
const { width } = Dimensions.get("window");
const ITEM_SIZE = width / 3;
const NUM_COLUMNS = 3;

type GridItem = {
  id: string;
  postId: number;
  image: string;
  type: "image" | "video";
};
export type TabConfig = {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
};
const tabs: Record<string, TabConfig> = {
  gallery: {
    icon: "grid-outline",
    activeIcon: "grid",
  },
  home_feed: {
    icon: "layers-outline",
    activeIcon: "layers",
  },
  premium: {
    icon: "heart-circle-outline",
    activeIcon: "heart",
  },
};

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: username,
    })
  }, [username])

  const [activeTab, setActiveTab] = useState<"gallery" | "home_feed" | "premium">("gallery");

  const {
    data: feedData,
    refetch: refetchFeed,
    isRefetching: isRefetchingFeed,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetUserFeedQuery(username);

  // Get posts from Zustand store
  const posts = usePostStore((state) => state.posts);

  // Get post IDs from query
  const postIds = useMemo(() => {
    if (!feedData?.pages) return [];
    return feedData.pages.flatMap((page) => page.data.posts);
  }, [feedData?.pages]);

  // Transform post IDs into grid items using store data
  const gridData = useMemo<GridItem[]>(() => {
    const items: GridItem[] = [];

    for (const postId of postIds) {
      const post = posts[postId];
      if (!post?.attachments) continue;

      for (const att of post.attachments) {
        const mediaType = getMediaType(att.type);
        items.push({
          id: att.id,
          postId: post.id,
          image: mediaType === "image" ? att.path : att.thumbnail,
          type: mediaType as "image" | "video",
        });
      }
    }

    return items;
  }, [postIds, posts]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refetchFeed();
  }, [refetchFeed]);

  // Handle pagination
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle grid item press - navigate to post
  const handleItemPress = useCallback((postId: number) => {
    router.push(`/post/${postId}`);
  }, []);

  // Render grid item
  const renderItem = useCallback(
    ({ item }: { item: GridItem }) => (
      <Pressable onPress={() => handleItemPress(item.postId)}>
        <View style={styles.gridItemContainer}>
          <Image
            source={{ uri: item.image }}
            style={styles.gridImage}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
          {item.type === "video" && (
            <View style={styles.videoIndicator}>
              <Ionicons name="play" size={14} color="white" />
            </View>
          )}
        </View>
      </Pressable>
    ),
    [styles, handleItemPress]
  );

  const keyExtractor = (item: GridItem) => item.id.toString();

  // List header component
  const ListHeader = useMemo(
    () => (
      <>
        <UserProfileHeader username={username} />
        <AnimatedTabBar tabs={tabs} activeKey={activeTab} onTabChange={setActiveTab} />
      </>
    ),
    [username, activeTab]
  );



  // List footer component
  const ListFooter = useMemo(
    () =>
      isFetchingNextPage ? (
        <ActivityIndicator style={styles.loader} />
      ) : null,
    [isFetchingNextPage, styles.loader]
  );

  console.log(gridData)

  return (
    <View style={styles.container}>
      {activeTab === "gallery" && <FlatList

        data={gridData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={NUM_COLUMNS}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        onRefresh={handleRefresh}
        refreshing={isRefetchingFeed}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // estimatedItemSize={ITEM_SIZE}
        showsVerticalScrollIndicator={false}
        extraData={activeTab}
      />}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    gridItemContainer: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      padding: 1,
    },
    gridImage: {
      flex: 1,
      backgroundColor: theme.colors.surface ?? "#1a1a1a",
    },
    videoIndicator: {
      position: "absolute",
      top: 6,
      right: 6,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 4,
      padding: 3,
    },
    loader: {
      padding: 20,
    },
  });
