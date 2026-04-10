import { ExploreSearchBar } from "@/src/components/explore/ExploreSearchBar";
import { ProfileFeedView } from "@/src/components/profile/ProfileFeedView";
import {
  useGlobalSearchPostsQuery,
  useGlobalSearchQuery,
} from "@/src/features/post/explore.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import type { SearchResultUser } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const TAB_LABELS = ["Latest", "People", "Photos", "Videos"] as const;

function useNormalizedQueryParam(): string {
  const { q } = useLocalSearchParams<{ q?: string | string[] }>();
  return useMemo(() => {
    if (typeof q === "string") return q.trim();
    if (Array.isArray(q)) return q[0]?.trim() ?? "";
    return "";
  }, [q]);
}

function flattenPostIds(data: any): number[] {
  if (!data?.pages) return [];
  return data.pages.flatMap((page: any) =>
    page.data.filter === "people" ? [] : page.data.posts,
  );
}

function flattenPeople(data: any): SearchResultUser[] {
  if (!data?.pages) return [];
  return data.pages.flatMap((page: any) =>
    page.data.filter === "people" ? page.data.users : [],
  );
}

function SearchPostsTab(props: any) {
  const {
    postIds,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isEmpty,
  } = props;

  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage]);

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
      onRefresh={refetch}
      isRefreshing={isRefetching}
      onEndReached={onEndReached}
      isFetchingNextPage={isFetchingNextPage}
      isTabActive={true}
    />
  );
}

function PeopleSearchTab({
  users,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
}: any) {
  const { theme } = useTheme();
  const { data: profileData } = useGetProfile();
  const me = profileData?.data;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage]);

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
          onPress={() => {
            if (item.id === me?.id) {
              router.push("/(app)/(tabs)/profile");
              return;
            }
            router.push({
              pathname: "/user/[username]",
              params: { username: item.username },
            });
          }}
        >
          <Text style={styles.viewProfileLabel}>View profile</Text>
        </Pressable>
      </View>
    ),
    [me, styles],
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
      removeClippedSubviews
      windowSize={5}
      maxToRenderPerBatch={5}
      initialNumToRender={5}
      updateCellsBatchingPeriod={100}
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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [searchDraft, setSearchDraft] = useState(q);
  const [pagerIndex, setPagerIndex] = useState(0);

  useEffect(() => setSearchDraft(q), [q]);

  useEffect(() => {
    if (!q) router.back();
  }, [q]);

  const handleSubmitSearch = useCallback(() => {
    const trimmed = searchDraft.trim();
    Keyboard.dismiss();
    if (!trimmed) return router.back();
    router.setParams({ q: trimmed });
  }, [searchDraft]);

  // ✅ Lazy queries
  const latestQ = useGlobalSearchPostsQuery(q, "latest");

  const peopleQ = useGlobalSearchQuery(q, "people");

  const photosQ = useGlobalSearchPostsQuery(q, "photos");

  const videosQ = useGlobalSearchPostsQuery(q, "videos");

  // ✅ Only compute active tab
  const latestIds = useMemo(
    () => (pagerIndex === 0 ? flattenPostIds(latestQ.data) : []),
    [latestQ.data, pagerIndex],
  );

  const peopleList = useMemo(
    () => (pagerIndex === 1 ? flattenPeople(peopleQ.data) : []),
    [peopleQ.data, pagerIndex],
  );

  const photosIds = useMemo(
    () => (pagerIndex === 2 ? flattenPostIds(photosQ.data) : []),
    [photosQ.data, pagerIndex],
  );

  const videosIds = useMemo(
    () => (pagerIndex === 3 ? flattenPostIds(videosQ.data) : []),
    [videosQ.data, pagerIndex],
  );

  if (!q) return null;

  return (
    <>
      <Stack.Screen options={{ title: "Search" }} />

      <View style={styles.root}>
        <ExploreSearchBar
          value={searchDraft}
          onChangeText={setSearchDraft}
          isFocused={false}
          onSubmitSearch={handleSubmitSearch}
          onFocus={() => {}}
          onBlur={() => {}}
          onClear={() => {
            setSearchDraft("");
          }}
          // onClear={() => {}}
        />

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TAB_LABELS.map((label, i) => (
            <Pressable
              key={label}
              style={styles.tabPressable}
              onPress={() => setPagerIndex(i)}
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

        {/* Underline */}
        <View style={styles.tabUnderlineTrack}>
          <View
            style={[
              styles.tabUnderline,
              {
                width: `${100 / TAB_LABELS.length}%`,
                left: `${(100 / TAB_LABELS.length) * pagerIndex}%`,
              },
            ]}
          />
        </View>

        {/* Active Tab */}
        <View style={{ flex: 1 }}>
          {pagerIndex === 0 && (
            <SearchPostsTab
              postIds={latestIds}
              {...latestQ}
              isEmpty={!latestQ.isLoading && latestIds.length === 0}
            />
          )}

          {pagerIndex === 1 && (
            <PeopleSearchTab users={peopleList} {...peopleQ} />
          )}

          {pagerIndex === 2 && (
            <SearchPostsTab
              postIds={photosIds}
              {...photosQ}
              isEmpty={!photosQ.isLoading && photosIds.length === 0}
            />
          )}

          {pagerIndex === 3 && (
            <SearchPostsTab
              postIds={videosIds}
              {...videosQ}
              isEmpty={!videosQ.isLoading && videosIds.length === 0}
            />
          )}
        </View>
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
