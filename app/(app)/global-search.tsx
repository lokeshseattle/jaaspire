import { ExploreSearchBar } from "@/src/components/explore/ExploreSearchBar";
import { ProfileFeedView } from "@/src/components/profile/ProfileFeedView";
import {
  useGlobalSearchPostsQuery,
  useGlobalSearchQuery,
} from "@/src/features/post/explore.hooks";
import type { SearchResultUser } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const TAB_LABELS = ["Latest", "People", "Photos", "Videos"] as const;
const PAGER_INDICES = [0, 1, 2, 3] as const;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<number>);

function useNormalizedQueryParam(): string {
  const { q } = useLocalSearchParams<{ q?: string | string[] }>();
  return useMemo(() => {
    if (typeof q === "string") return q.trim();
    if (Array.isArray(q)) return q[0]?.trim() ?? "";
    return "";
  }, [q]);
}

function flattenPostIds(
  data:
    | ReturnType<typeof useGlobalSearchPostsQuery>["data"]
    | undefined,
): number[] {
  if (!data?.pages) return [];
  return data.pages.flatMap((page) =>
    page.data.filter === "people" ? [] : (page.data.posts as number[]),
  );
}

function flattenPeople(
  data: ReturnType<typeof useGlobalSearchQuery>["data"] | undefined,
): SearchResultUser[] {
  if (!data?.pages) return [];
  return data.pages.flatMap((page) =>
    page.data.filter === "people" ? page.data.users : [],
  );
}

function SearchPostsTab({
  postIds,
  refetch,
  isRefetching,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isTabActive,
  isLoading,
  isEmpty,
}: {
  postIds: number[];
  refetch: () => Promise<unknown>;
  isRefetching: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isTabActive: boolean;
  isLoading: boolean;
  isEmpty: boolean;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading && postIds.length === 0) {
    return (
      <View style={styles.tabCenter}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={styles.tabCenter}>
        <Text style={styles.emptyText}>No posts found</Text>
      </View>
    );
  }

  return (
    <ProfileFeedView
      postIds={postIds}
      ListHeaderComponent={<View style={{ height: 0 }} />}
      onRefresh={async () => {
        await refetch();
      }}
      isRefreshing={isRefetching}
      onEndReached={onEndReached}
      isFetchingNextPage={isFetchingNextPage}
      isTabActive={isTabActive}
    />
  );
}

function PeopleSearchTab({
  users,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
}: {
  users: SearchResultUser[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderUser = useCallback(
    ({ item }: ListRenderItemInfo<SearchResultUser>) => (
      <View style={styles.userRow}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.userTextCol}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.userUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        <Pressable
          style={styles.viewProfileBtn}
          onPress={() =>
            router.push({
              pathname: "/user/[username]",
              params: { username: item.username },
            })
          }
        >
          <Text style={styles.viewProfileLabel}>View profile</Text>
        </Pressable>
      </View>
    ),
    [styles],
  );

  if (isLoading && users.length === 0) {
    return (
      <View style={styles.tabCenter}>
        <ActivityIndicator />
      </View>
    );
  }

  if (users.length === 0) {
    return (
      <View style={styles.tabCenter}>
        <Text style={styles.emptyText}>No people found</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderUser}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={{ padding: 16 }} />
        ) : null
      }
    />
  );
}

export default function GlobalSearchScreen() {
  const q = useNormalizedQueryParam();
  const { width: windowWidth } = useWindowDimensions();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [searchDraft, setSearchDraft] = useState(q);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [pagerIndex, setPagerIndex] = useState(0);
  const pagerRef = useRef<FlatList<number> | null>(null);
  const scrollX = useSharedValue(0);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  useEffect(() => {
    if (q.length === 0) {
      router.back();
    }
  }, [q]);

  const handleBarFocus = useCallback(() => setIsSearchFocused(true), []);
  const handleBarBlur = useCallback(() => {
    setIsSearchFocused(false);
    Keyboard.dismiss();
  }, []);
  const handleBarClear = useCallback(() => setSearchDraft(""), []);

  const handleSubmitSearch = useCallback(() => {
    const trimmed = searchDraft.trim();
    Keyboard.dismiss();
    setIsSearchFocused(false);
    if (trimmed.length === 0) {
      router.back();
      return;
    }
    router.setParams({ q: trimmed });
  }, [searchDraft]);

  const latestQ = useGlobalSearchPostsQuery(q, "latest");
  const peopleQ = useGlobalSearchQuery(q, "people");
  const photosQ = useGlobalSearchPostsQuery(q, "photos");
  const videosQ = useGlobalSearchPostsQuery(q, "videos");

  const latestIds = useMemo(() => flattenPostIds(latestQ.data), [latestQ.data]);
  const photosIds = useMemo(() => flattenPostIds(photosQ.data), [photosQ.data]);
  const videosIds = useMemo(() => flattenPostIds(videosQ.data), [videosQ.data]);
  const peopleList = useMemo(() => flattenPeople(peopleQ.data), [peopleQ.data]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const underlineStyle = useAnimatedStyle(() => ({
    width: windowWidth / 4,
    transform: [{ translateX: scrollX.value / 4 }],
  }));

  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / windowWidth);
      setPagerIndex(Math.min(Math.max(idx, 0), 3));
    },
    [windowWidth],
  );

  const goToPage = useCallback(
    (index: number) => {
      setPagerIndex(index);
      pagerRef.current?.scrollToOffset({
        offset: index * windowWidth,
        animated: true,
      });
    },
    [windowWidth],
  );

  const renderPagerPage = useCallback(
    ({ item: index }: ListRenderItemInfo<number>) => {
      const isTabActive = pagerIndex === index;

      if (index === 0) {
        return (
          <View style={{ width: windowWidth, flex: 1 }}>
            <SearchPostsTab
              postIds={latestIds}
              refetch={latestQ.refetch}
              isRefetching={latestQ.isRefetching}
              fetchNextPage={latestQ.fetchNextPage}
              hasNextPage={latestQ.hasNextPage ?? false}
              isFetchingNextPage={latestQ.isFetchingNextPage}
              isTabActive={isTabActive}
              isLoading={latestQ.isLoading}
              isEmpty={!latestQ.isLoading && latestIds.length === 0}
            />
          </View>
        );
      }

      if (index === 1) {
        return (
          <View style={{ width: windowWidth, flex: 1 }}>
            <PeopleSearchTab
              users={peopleList}
              isLoading={peopleQ.isLoading}
              isFetchingNextPage={peopleQ.isFetchingNextPage}
              hasNextPage={peopleQ.hasNextPage ?? false}
              fetchNextPage={peopleQ.fetchNextPage}
            />
          </View>
        );
      }

      if (index === 2) {
        return (
          <View style={{ width: windowWidth, flex: 1 }}>
            <SearchPostsTab
              postIds={photosIds}
              refetch={photosQ.refetch}
              isRefetching={photosQ.isRefetching}
              fetchNextPage={photosQ.fetchNextPage}
              hasNextPage={photosQ.hasNextPage ?? false}
              isFetchingNextPage={photosQ.isFetchingNextPage}
              isTabActive={isTabActive}
              isLoading={photosQ.isLoading}
              isEmpty={!photosQ.isLoading && photosIds.length === 0}
            />
          </View>
        );
      }

      return (
        <View style={{ width: windowWidth, flex: 1 }}>
          <SearchPostsTab
            postIds={videosIds}
            refetch={videosQ.refetch}
            isRefetching={videosQ.isRefetching}
            fetchNextPage={videosQ.fetchNextPage}
            hasNextPage={videosQ.hasNextPage ?? false}
            isFetchingNextPage={videosQ.isFetchingNextPage}
            isTabActive={isTabActive}
            isLoading={videosQ.isLoading}
            isEmpty={!videosQ.isLoading && videosIds.length === 0}
          />
        </View>
      );
    },
    [
      windowWidth,
      pagerIndex,
      latestIds,
      latestQ.refetch,
      latestQ.isRefetching,
      latestQ.fetchNextPage,
      latestQ.hasNextPage,
      latestQ.isFetchingNextPage,
      latestQ.isLoading,
      peopleList,
      peopleQ.isLoading,
      peopleQ.isFetchingNextPage,
      peopleQ.hasNextPage,
      peopleQ.fetchNextPage,
      photosIds,
      photosQ.refetch,
      photosQ.isRefetching,
      photosQ.fetchNextPage,
      photosQ.hasNextPage,
      photosQ.isFetchingNextPage,
      photosQ.isLoading,
      videosIds,
      videosQ.refetch,
      videosQ.isRefetching,
      videosQ.fetchNextPage,
      videosQ.hasNextPage,
      videosQ.isFetchingNextPage,
      videosQ.isLoading,
    ],
  );

  if (q.length === 0) {
    return null;
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Search",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <View style={styles.root}>
        <ExploreSearchBar
          value={searchDraft}
          onChangeText={setSearchDraft}
          onFocus={handleBarFocus}
          onBlur={handleBarBlur}
          onClear={handleBarClear}
          isFocused={isSearchFocused}
          onSubmitSearch={handleSubmitSearch}
        />
        <View style={styles.tabBar}>
          {TAB_LABELS.map((label, i) => (
            <Pressable
              key={label}
              style={styles.tabPressable}
              onPress={() => goToPage(i)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  pagerIndex === i && styles.tabLabelActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tabUnderlineTrack}>
          <Animated.View style={[styles.tabUnderline, underlineStyle]} />
        </View>

        <AnimatedFlatList
          ref={pagerRef}
          data={[...PAGER_INDICES]}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => String(item)}
          renderItem={renderPagerPage}
          getItemLayout={(_, index) => ({
            length: windowWidth,
            offset: windowWidth * index,
            index,
          })}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          style={styles.pager}
        />
      </View>
    </>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    tabBar: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    tabPressable: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
    },
    tabLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    tabLabelActive: {
      color: theme.colors.textPrimary,
      fontWeight: "600",
    },
    tabUnderlineTrack: {
      height: 2,
      backgroundColor: theme.colors.border,
    },
    tabUnderline: {
      height: 2,
      backgroundColor: theme.colors.textPrimary,
      position: "absolute",
      left: 0,
      top: 0,
    },
    pager: {
      flex: 1,
    },
    tabCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    emptyText: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.border,
    },
    userTextCol: {
      flex: 1,
      marginLeft: 12,
      minWidth: 0,
    },
    userName: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    userUsername: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    viewProfileBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    viewProfileLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
  });
