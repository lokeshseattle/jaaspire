import { useDebounce } from "@/hooks/use-debounce";
import ExploreGrid from "@/src/components/explore/ExploreGrid";
import { ExploreSearchBar } from "@/src/components/explore/ExploreSearchBar";
import {
  ProfileSuggestion,
  ProfileSuggestions,
} from "@/src/components/explore/ProfileSuggestions";
import { useGetExploreQuery } from "@/src/features/post/explore.hooks";
import {
  useGetProfile,
  useSearchUserQuery,
} from "@/src/features/profile/profile.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { router, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";

export default function SearchScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { data: profileData } = useGetProfile();
  const me = profileData?.data;
  const [searchText, setSearchText] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debouncedSearch = useDebounce(searchText, 500);

  const searchUserQuery = useSearchUserQuery(debouncedSearch);

  const {
    gridItems,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    refetch,
    fetchNextPage,
  } = useGetExploreQuery();

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
    Keyboard.dismiss();
  }, []);

  const handleSearchClear = useCallback(() => {
    setSearchText("");
  }, []);

  const handleSubmitSearch = useCallback(() => {
    const trimmed = searchText.trim();
    Keyboard.dismiss();
    setIsSearchFocused(false);
    if (trimmed.length === 0) return;
    router.push({
      pathname: "/global-search",
      params: { q: trimmed },
    });
  }, [searchText]);

  const handleProfileSelect = useCallback(
    (profile: ProfileSuggestion) => {
      handleSearchBlur();
      if (profile.id === me?.id) {
        router.push({
          pathname: "/(app)/(tabs)/profile",
        });
        return;
      }
      router.push({
        pathname: "/user/[username]",
        params: {
          username: profile.username,
        },
      });
    },
    [handleSearchBlur],
  );

  const handlePostPress = useCallback((postId: number) => {
    router.push({
      pathname: "/post/[postId]",
      params: {
        postId: postId.toString(),
      },
    });
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as any, () => {
      if (navigation.isFocused()) {
        handleRefresh();
      }
    });
    return unsubscribe;
  }, [navigation, handleRefresh]);

  const handleLoadMore = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  return (
    <View style={styles.container}>
      {/* <SafeAreaView style={styles.container} edges={['top']}> */}
      <ExploreSearchBar
        value={searchText}
        onChangeText={setSearchText}
        onFocus={handleSearchFocus}
        onBlur={handleSearchBlur}
        onClear={handleSearchClear}
        isFocused={isSearchFocused}
        onSubmitSearch={handleSubmitSearch}
      />

      <View style={styles.content}>
        {isSearchFocused && (
          <ProfileSuggestions
            query={debouncedSearch}
            suggestions={searchUserQuery.data?.data.users ?? []}
            isLoading={searchUserQuery.isLoading}
            onSelect={handleProfileSelect}
          />
        )}

        <ExploreGrid
          gridItems={gridItems}
          isLoading={isLoading}
          isRefreshing={isRefetching}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage ?? false}
          onRefresh={handleRefresh}
          onLoadMore={handleLoadMore}
          onPostPress={handlePostPress}
        />
      </View>
      {/* // </SafeAreaView> */}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      position: "relative",
    },
  });
